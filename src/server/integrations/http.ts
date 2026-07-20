import { env } from "@/lib/env";
import { acquireRateSlot } from "./rateGuard";

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

// 404 => "topilmadi" (fallback trigger), retry qilinmaydi.
export class NotFoundError extends HttpError {
  constructor(message = "not found") {
    super(404, message);
    this.name = "NotFoundError";
  }
}

interface RequestOptions {
  baseUrl: string;
  path?: string;
  // Query parametrlari (to'g'ri encode qilinadi). undefined qiymatlar tushib qoladi.
  query?: Record<string, string | number | undefined>;
  token?: string;
  method?: "GET" | "POST";
  body?: unknown;
  timeoutMs?: number;
  maxAttempts?: number;
  // Per-API global rate-limit kaliti (masalan "API3"). Berilsa, so'rovdan oldin slot olinadi.
  rateKey?: string;
}

// baseUrl + path + query -> to'liq URL. path bo'sh bo'lishi mumkin.
function buildUrl(baseUrl: string, path?: string, query?: RequestOptions["query"]): string {
  const base = baseUrl.replace(/\/$/, "");
  const seg = path ? `/${path.replace(/^\//, "")}` : "";
  const url = new URL(base + seg);
  for (const [k, v] of Object.entries(query ?? {})) {
    if (v !== undefined && v !== "") url.searchParams.set(k, String(v));
  }
  return url.toString();
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Timeout + retry/backoff (429/5xx/network) + Retry-After hurmati bilan JSON so'rov.
// 404 => NotFoundError (fallback logikasi buni ushlaydi, retry yo'q).
export async function httpJson<T>(opts: RequestOptions): Promise<T> {
  const {
    baseUrl,
    path,
    query,
    token,
    method = "GET",
    body,
    timeoutMs = env.API_TIMEOUT_MS,
    maxAttempts = env.API_MAX_ATTEMPTS,
    rateKey,
  } = opts;

  const url = buildUrl(baseUrl, path, query);
  let lastErr: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    // Per-API rate-limit: har urinishdan oldin bo'sh slot kutamiz.
    if (rateKey) await acquireRateSlot(rateKey);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        method,
        headers: {
          "content-type": "application/json",
          ...(token ? { authorization: `Bearer ${token}` } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      if (res.status === 404) throw new NotFoundError();

      if (res.status === 429 || res.status >= 500) {
        const retryAfter = Number(res.headers.get("retry-after"));
        const backoff = Number.isFinite(retryAfter) && retryAfter > 0
          ? retryAfter * 1000
          : baseBackoff(attempt);
        lastErr = new HttpError(res.status, `HTTP ${res.status}`);
        if (attempt < maxAttempts) {
          await sleep(backoff);
          continue;
        }
        throw lastErr;
      }

      if (!res.ok) throw new HttpError(res.status, `HTTP ${res.status}`);

      return (await res.json()) as T;
    } catch (err) {
      // 404 va boshqa retry qilinmaydigan HTTP xatolarni yuqoriga uzatamiz.
      if (err instanceof NotFoundError) throw err;
      if (err instanceof HttpError && err.status < 500 && err.status !== 429) throw err;

      lastErr = err;
      if (attempt < maxAttempts) {
        await sleep(baseBackoff(attempt));
        continue;
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }

  throw lastErr ?? new Error("http retry tugadi");
}

// Exponential backoff + jitter.
function baseBackoff(attempt: number): number {
  const base = Math.min(1000 * 2 ** (attempt - 1), 30_000);
  return base + Math.floor(Math.random() * 250);
}
