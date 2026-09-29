"use client";

import { useEffect, useRef, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";

/**
 * Oy tanlagichi — o'zbekcha (2026-09-29, foydalanuvchi talabi).
 *
 * ⚠️ Brauzerning `<input type="month">` EMAS: u oy nomini brauzer tilida
 * ("September 2026") chiqaradi va uni o'zgartirib bo'lmaydi. Oddiy `<select>` ham
 * rad etildi (uzun ro'yxat). Ko'rinishi avvalgi maydonga o'xshash, ochilganda
 * yil + 12 oy jadvali.
 *
 * Qiymat GET formaga yashirin `name` maydoni orqali ketadi (`"YYYY-MM"`) — sahifa
 * server tomonda o'qiydi, client JS faqat tanlash qulayligi uchun.
 */

const MONTHS = [
  "Yanvar", "Fevral", "Mart", "Aprel", "May", "Iyun",
  "Iyul", "Avgust", "Sentyabr", "Oktyabr", "Noyabr", "Dekabr",
];
const SHORT = ["Yan", "Fev", "Mar", "Apr", "May", "Iyn", "Iyl", "Avg", "Sen", "Okt", "Noy", "Dek"];

const pad = (n: number) => String(n).padStart(2, "0");

export function MonthPicker({ name, value, min, max }: { name: string; value: string; min: string; max: string }) {
  const [sel, setSel] = useState(value);
  const [open, setOpen] = useState(false);
  const [year, setYear] = useState(Number(value.slice(0, 4)));
  const ref = useRef<HTMLDivElement>(null);

  const minYear = Number(min.slice(0, 4));
  const maxYear = Number(max.slice(0, 4));
  const [selY, selM] = sel.split("-").map(Number);

  // Tashqarida bosilsa yoki Esc — yopiladi.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <input type="hidden" name={name} value={sel} />
      <button
        type="button"
        aria-label="Oy"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => {
          setYear(selY);
          setOpen((o) => !o);
        }}
        className="flex h-9 min-w-[11rem] items-center justify-between gap-3 rounded-lg border border-slate-300 bg-card px-3 text-sm font-medium text-slate-700 shadow-sm transition hover:border-slate-400 focus:border-[var(--cobalt)] focus:outline-none focus:ring-2 focus:ring-[var(--cobalt)]/20"
      >
        <span>
          {MONTHS[selM - 1]} {selY}
        </span>
        <CalendarDays aria-hidden className="h-4 w-4 text-slate-500" />
      </button>

      {/* Telefonda maydon chapda turadi (forma sarlavha ostiga tushadi) — oyna chapga
          bog'lanadi, aks holda ekrandan chiqib ketardi; `sm` dan boshlab maydon o'ngda. */}
      {open ? (
        <div
          role="dialog"
          aria-label="Oyni tanlang"
          className="absolute left-0 z-30 mt-1.5 w-64 sm:left-auto sm:right-0 rounded-xl border border-slate-200 bg-card p-3 shadow-[0_12px_32px_-12px_rgba(15,23,42,0.35)]"
        >
          <div className="mb-2 flex items-center justify-between">
            <button
              type="button"
              aria-label="Oldingi yil"
              disabled={year <= minYear}
              onClick={() => setYear((y) => y - 1)}
              className="grid h-7 w-7 place-items-center rounded-md text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 disabled:pointer-events-none disabled:opacity-30"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-sm font-semibold" style={{ color: "var(--navy)" }}>
              {year}
            </span>
            <button
              type="button"
              aria-label="Keyingi yil"
              disabled={year >= maxYear}
              onClick={() => setYear((y) => y + 1)}
              className="grid h-7 w-7 place-items-center rounded-md text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 disabled:pointer-events-none disabled:opacity-30"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <div className="grid grid-cols-3 gap-1.5">
            {SHORT.map((label, i) => {
              const ym = `${year}-${pad(i + 1)}`;
              const outOfRange = ym < min || ym > max;
              const active = year === selY && i + 1 === selM;
              return (
                <button
                  key={label}
                  type="button"
                  disabled={outOfRange}
                  aria-pressed={active}
                  title={`${MONTHS[i]} ${year}`}
                  onClick={() => {
                    setSel(ym);
                    setOpen(false);
                  }}
                  className={[
                    "h-9 rounded-lg text-sm font-medium transition",
                    active
                      ? "text-white shadow-[0_2px_10px_-3px_rgba(26,58,124,0.6)]"
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
                    "disabled:pointer-events-none disabled:text-slate-300",
                  ].join(" ")}
                  style={active ? { background: "var(--cobalt)" } : undefined}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
