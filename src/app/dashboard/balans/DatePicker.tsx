"use client";

import { useEffect, useRef, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";

/**
 * Kun tanlagichi — o'zbekcha (2026-09-30). Tanlangan kun hisobotning oyini ham
 * belgilaydi (o'tgan oy shundan hisoblanadi).
 *
 * ⚠️ Brauzerning `<input type="date">` EMAS: oy nomlari brauzer tilida chiqadi.
 * Ko'rinishi avvalgi oy tanlagichi bilan bir xil (u rad etilgan `<select>` o'rniga
 * foydalanuvchi tasdiqlagan dizayn), ochilganda oy + kunlar jadvali.
 *
 * Qiymat GET formaga yashirin `name` maydoni orqali ketadi (`"YYYY-MM-DD"`).
 */

const MONTHS = [
  "Yanvar", "Fevral", "Mart", "Aprel", "May", "Iyun",
  "Iyul", "Avgust", "Sentyabr", "Oktyabr", "Noyabr", "Dekabr",
];
const WEEKDAYS = ["Du", "Se", "Ch", "Pa", "Ju", "Sh", "Ya"];

const pad = (n: number) => String(n).padStart(2, "0");
const ymOf = (y: number, m: number) => `${y}-${pad(m)}`;

const NAV =
  "grid h-7 w-7 place-items-center rounded-md text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 disabled:pointer-events-none disabled:opacity-30";

export function DatePicker({ name, value, min, max }: { name: string; value: string; min: string; max: string }) {
  const [sel, setSel] = useState(value);
  const [open, setOpen] = useState(false);
  const [view, setView] = useState(() => ({ y: Number(value.slice(0, 4)), m: Number(value.slice(5, 7)) }));
  const ref = useRef<HTMLDivElement>(null);

  const [selY, selM, selD] = sel.split("-").map(Number);

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

  const shift = (delta: number) =>
    setView(({ y, m }) => {
      const d = new Date(Date.UTC(y, m - 1 + delta, 1));
      return { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1 };
    });

  const viewYm = ymOf(view.y, view.m);
  const daysInMonth = new Date(Date.UTC(view.y, view.m, 0)).getUTCDate();
  // Dushanbadan boshlanadi: getUTCDay() 0 = yakshanba.
  const lead = (new Date(Date.UTC(view.y, view.m - 1, 1)).getUTCDay() + 6) % 7;

  return (
    <div ref={ref} className="relative">
      <input type="hidden" name={name} value={sel} />
      <button
        type="button"
        aria-label="Sana"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => {
          setView({ y: selY, m: selM });
          setOpen((o) => !o);
        }}
        className="flex h-9 min-w-[11rem] items-center justify-between gap-3 rounded-lg border border-slate-300 bg-card px-3 text-sm font-medium text-slate-700 shadow-sm transition hover:border-slate-400 focus:border-[var(--cobalt)] focus:outline-none focus:ring-2 focus:ring-[var(--cobalt)]/20"
      >
        <span>
          {selD} {MONTHS[selM - 1]?.toLowerCase()} {selY}
        </span>
        <CalendarDays aria-hidden className="h-4 w-4 text-slate-500" />
      </button>

      {/* Telefonda maydon chapda turadi — oyna chapga bog'lanadi, `sm` dan boshlab o'ngga. */}
      {open ? (
        <div
          role="dialog"
          aria-label="Sanani tanlang"
          className="absolute left-0 z-30 mt-1.5 w-72 sm:left-auto sm:right-0 rounded-xl border border-slate-200 bg-card p-3 shadow-[0_12px_32px_-12px_rgba(15,23,42,0.35)]"
        >
          <div className="mb-2 flex items-center justify-between">
            <button
              type="button"
              aria-label="Oldingi oy"
              disabled={viewYm <= min.slice(0, 7)}
              onClick={() => shift(-1)}
              className={NAV}
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-sm font-semibold" style={{ color: "var(--navy)" }}>
              {MONTHS[view.m - 1]} {view.y}
            </span>
            <button
              type="button"
              aria-label="Keyingi oy"
              disabled={viewYm >= max.slice(0, 7)}
              onClick={() => shift(1)}
              className={NAV}
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1 text-center">
            {WEEKDAYS.map((w) => (
              <span key={w} className="pb-1 text-[11px] font-semibold uppercase text-slate-400">
                {w}
              </span>
            ))}
            {Array.from({ length: lead }, (_, i) => (
              <span key={`e${i}`} />
            ))}
            {Array.from({ length: daysInMonth }, (_, i) => {
              const day = `${viewYm}-${pad(i + 1)}`;
              const outOfRange = day < min || day > max;
              const active = day === sel;
              const today = day === max;
              return (
                <button
                  key={day}
                  type="button"
                  disabled={outOfRange}
                  aria-pressed={active}
                  onClick={() => {
                    setSel(day);
                    setOpen(false);
                  }}
                  className={[
                    "h-8 rounded-lg text-sm tabular-nums transition",
                    active
                      ? "font-semibold text-white shadow-[0_2px_10px_-3px_rgba(26,58,124,0.6)]"
                      : today
                        ? "font-semibold text-[var(--cobalt)] ring-1 ring-inset ring-[var(--cobalt)]/40 hover:bg-slate-100"
                        : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
                    "disabled:pointer-events-none disabled:text-slate-300 disabled:ring-0",
                  ].join(" ")}
                  style={active ? { background: "var(--cobalt)" } : undefined}
                >
                  {i + 1}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
