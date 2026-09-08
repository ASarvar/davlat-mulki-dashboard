"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle, Loader2, Search } from "lucide-react";
import { withBase } from "@/lib/basePath";
import { classifySubject, defaultPeriod, type ImtiyozResult } from "@/lib/imtiyoz";
import { ResultView } from "./ResultView";
import { HealthPanel } from "./HealthPanel";

/**
 * Tekshirish sahifasining interaktiv qismi.
 *
 * ⚠️ Server Action emas, `fetch`: tekshiruv 400 xodimli korxonada daqiqalarga
 * cho'zilishi mumkin va bu yerda jonli sekundomer hamda bekor qilish
 * (`AbortController`) kerak — ular Server Action bilan berilmaydi.
 */

/** Brauzer tomonidagi chegara — server tomonda cheklov yo'q. */
const CLIENT_TIMEOUT_MS = 120_000;

const DEFAULT_HINT = "Yuridik shaxs uchun 9 xonali, YATT uchun 14 xonali raqam";

interface Fatal {
  message: string;
  detail?: string;
}

export function CheckForm({ operator }: { operator: string }) {
  const [raw, setRaw] = useState("");
  const [result, setResult] = useState<ImtiyozResult | null>(null);
  const [fatal, setFatal] = useState<Fatal | null>(null);
  const [busy, setBusy] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [attempts, setAttempts] = useState(0);
  const [lastAttemptAt, setLastAttemptAt] = useState<string | null>(null);
  const [healthTick, setHealthTick] = useState(0);

  // Standart davr — O'TGAN oy (joriy oy hali to'liq yakunlanmagan bo'lishi mumkin).
  const [year, setYear] = useState("");
  const [period, setPeriod] = useState("");
  // ⚠️ Hisoblash `defaultPeriod()` da — ochiq endpoint ham SHU funksiyani
  // ishlatadi, ya'ni sahifa va forma hech qachon ajralib qolmaydi.
  useEffect(() => {
    const d = defaultPeriod();
    setYear(String(d.year));
    setPeriod(String(d.period));
  }, []);

  const subject = classifySubject(raw);
  const currentRef = useRef<string | null>(null);

  const runCheck = useCallback(
    async (subjectId: string, isRetry: boolean) => {
      if (busy) return;

      if (!isRetry) {
        currentRef.current = subjectId;
        setAttempts(1);
      } else {
        setAttempts((a) => a + 1);
      }
      setLastAttemptAt(new Date().toISOString());
      setFatal(null);
      setResult(null);
      setBusy(true);
      setElapsed(0);

      const startedAt = Date.now();
      const timer = setInterval(() => setElapsed(Math.round((Date.now() - startedAt) / 1000)), 250);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), CLIENT_TIMEOUT_MS);

      const params = new URLSearchParams();
      if (year) params.set("year", year);
      if (period) params.set("period", period);
      // ⚠️ Qayta urinishda natija keshi chetlab o'tiladi, lekin TIEK keshi saqlanadi —
      // shuning uchun so'rov amalda FAQAT muvaffaqiyatsiz PINFL'lar uchun ketadi.
      if (isRetry) params.set("refresh", "1");

      try {
        const res = await fetch(
          withBase(`/api/imtiyoz/app/check/${encodeURIComponent(subjectId)}?${params}`),
          { signal: controller.signal },
        );
        const body = await res.json().catch(() => null);

        if (!res.ok || !body?.success) {
          const code = body?.error?.code;
          const message = body?.error?.message ?? `Server ${res.status} qaytardi`;
          setFatal(
            code === "INVALID_ID" ? { message } : { message: "Tekshiruvda xatolik yuz berdi.", detail: message },
          );
        } else {
          setResult(body.data as ImtiyozResult);
        }
      } catch (err) {
        if (controller.signal.aborted) {
          setFatal({
            message: "Tekshiruv juda uzoq davom etdi (2 daqiqa) va to'xtatildi.",
            detail: "Tashqi bazalar sekin javob berayotgan bo'lishi mumkin. Birozdan so'ng qayta urinib ko'ring.",
          });
        } else {
          console.error("[imtiyoz] tekshiruv so'rovi:", err);
          setFatal({
            message: "Server bilan bog'lanib bo'lmadi.",
            detail:
              "Bu tashqi baza uzilishi emas — ilovaning o'z serveriga ulanib bo'lmadi. Tarmoqni tekshiring.",
          });
        }
      } finally {
        clearTimeout(timeoutId);
        clearInterval(timer);
        setBusy(false);
        // Tekshiruvdan keyin holat aniq yangi bo'ladi.
        setHealthTick((t) => t + 1);
      }
    },
    [busy, year, period],
  );

  return (
    <div className="space-y-6">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (subject.valid) void runCheck(subject.normalized, false);
        }}
        className="rounded-xl border border-border bg-card p-4 shadow-sm"
      >
        <label htmlFor="subject-id" className="mb-1 block text-xs font-medium text-muted-foreground">
          Ijarachining STIR yoki JSHSHIR raqami
        </label>
        <div className="flex flex-wrap gap-3">
          <input
            id="subject-id"
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
            inputMode="numeric"
            autoComplete="off"
            autoFocus
            disabled={busy}
            placeholder="masalan, 306781314"
            className="w-64 rounded-lg border border-slate-200 bg-white px-3 py-2 font-mono text-sm shadow-sm outline-none transition focus:border-cobalt focus:ring-2 focus:ring-cobalt/20 disabled:bg-slate-50"
          />
          <button
            type="submit"
            disabled={busy || !subject.valid}
            className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:opacity-90 disabled:opacity-50"
            style={{ background: "var(--cobalt)" }}
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            Tekshirish
          </button>
        </div>

        <p className={`mt-1.5 text-xs ${raw && !subject.valid ? "text-red-600" : "text-muted-foreground"}`}>
          {!raw.trim()
            ? DEFAULT_HINT
            : subject.valid
              ? subject.label
              : `${subject.normalized.length} ta raqam kiritildi — 9 yoki 14 bo'lishi kerak`}
        </p>

        <details className="mt-3">
          <summary className="cursor-pointer text-xs font-medium text-muted-foreground hover:text-slate-700">
            Davr sozlamalari
          </summary>
          <div className="mt-2 flex gap-3">
            <div className="flex flex-col">
              <label className="mb-1 text-xs text-muted-foreground">Yil</label>
              <input
                type="number"
                min={2000}
                max={2100}
                value={year}
                onChange={(e) => setYear(e.target.value)}
                className="w-24 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm shadow-sm outline-none focus:border-cobalt"
              />
            </div>
            <div className="flex flex-col">
              <label className="mb-1 text-xs text-muted-foreground">Oy</label>
              <input
                type="number"
                min={1}
                max={12}
                value={period}
                onChange={(e) => setPeriod(e.target.value)}
                className="w-20 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm shadow-sm outline-none focus:border-cobalt"
              />
            </div>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Standart — o&apos;tgan oy: joriy oy hali to&apos;liq yakunlanmagan bo&apos;lishi mumkin.
          </p>
        </details>
      </form>

      {busy ? (
        <div className="flex items-center gap-4 rounded-xl border border-border bg-card p-5 shadow-sm">
          <Loader2 className="h-6 w-6 animate-spin" style={{ color: "var(--cobalt)" }} />
          <div>
            <p className="text-sm font-semibold text-slate-800">Xodimlar tekshirilmoqda...</p>
            <p className="text-xs text-muted-foreground">
              Har bir xodim nogironlik reyestridan alohida so&apos;raladi.{" "}
              <span className="font-mono">{elapsed} s</span>
            </p>
          </div>
        </div>
      ) : fatal ? (
        <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-medium">{fatal.message}</p>
            {fatal.detail ? <p className="mt-0.5">{fatal.detail}</p> : null}
          </div>
        </div>
      ) : result ? (
        <ResultView
          data={result}
          opts={{
            attempts,
            lastAttemptAt,
            operator,
            onRetry: () => {
              if (currentRef.current) void runCheck(currentRef.current, true);
            },
          }}
        />
      ) : (
        <p className="rounded-xl border border-border bg-card p-6 text-center text-sm text-muted-foreground shadow-sm">
          Xodimlarning kamida 30% ini nogironligi bo&apos;lgan shaxslar tashkil etsa, ijara to&apos;lovi
          auksion summasining 50% i etib belgilanadi.
        </p>
      )}

      <HealthPanel refreshKey={healthTick} />
    </div>
  );
}
