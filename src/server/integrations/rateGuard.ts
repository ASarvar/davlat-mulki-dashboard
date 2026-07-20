import { RateLimiterMemory, type RateLimiterRes } from "rate-limiter-flexible";
import { env } from "@/lib/env";

// Har bir tashqi API uchun in-memory token-bucket (Redis YO'Q).
// Tashqi API chaqiruvlari WORKER (bitta process) ichida bo'lgani uchun in-memory limiter
// butun bulk-sync bo'ylab global rate-limit'ni ta'minlaydi.
const limiters = new Map<string, RateLimiterMemory>();

function getLimiter(apiKey: string): RateLimiterMemory {
  let limiter = limiters.get(apiKey);
  if (!limiter) {
    limiter = new RateLimiterMemory({
      points: env.API_RATE_MAX, // duration ichida maksimal so'rov
      duration: Math.max(1, Math.round(env.API_RATE_DURATION_MS / 1000)),
    });
    limiters.set(apiKey, limiter);
  }
  return limiter;
}

// Tashqi so'rovdan OLDIN chaqiriladi. Limit tugagan bo'lsa — bo'shaguncha kutadi.
export async function acquireRateSlot(apiKey: string): Promise<void> {
  const limiter = getLimiter(apiKey);
  for (let i = 0; i < 50; i++) {
    try {
      await limiter.consume(apiKey, 1);
      return;
    } catch (res) {
      const waitMs = (res as RateLimiterRes)?.msBeforeNext ?? env.API_RATE_DURATION_MS;
      await new Promise((r) => setTimeout(r, Math.max(50, waitMs)));
    }
  }
  throw new Error(`Rate limit slot olinmadi: ${apiKey}`);
}
