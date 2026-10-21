"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown } from "lucide-react";

type Val = string | number;

export interface DropdownOption<V extends Val> {
  value: V;
  label: string;
  /** Guruh sarlavhasi (`<optgroup>` o'rniga) — ketma-ket bir xil guruhlar bitta sarlavha ostida. */
  group?: string;
}

interface Props<V extends Val> {
  options: DropdownOption<V>[];
  /** Boshqariladigan rejim. Berilmasa — `defaultValue` bilan ichki holat. */
  value?: V;
  defaultValue?: V;
  onChange?: (value: V) => void;
  ariaLabel: string;
  /** Forma maydoni nomi — qiymat yashirin `input` orqali yuboriladi. */
  name?: string;
  /** Bo'sh qiymat (`""`) bilan forma yuborilmaydi (brauzer ogohlantirishi chiqadi). */
  required?: boolean;
  /** Tanlangach formani darhol yuborish (filtr formalari). */
  submitOnChange?: boolean;
  /**
   * `submitOnChange` bilan: yuborishdan oldin shu nomdagi BOLA maydonlar tozalanadi.
   * ⚠️ Kaskad filtrlarda (soha → tashkilot, hudud → tuman) SHART — eski bola qiymati
   * yangi ota bilan AND bo'lib natija jimgina bo'sh chiqardi.
   */
  resetOnChange?: string[];
  disabled?: boolean;
  size?: "sm" | "md";
  className?: string;
}

const SIZE = {
  sm: "h-8 rounded-lg px-2.5 text-[12.5px]",
  md: "h-[38px] rounded-lg px-3 text-sm shadow-sm",
};

/**
 * Ilova uslubidagi ochiladigan ro'yxat — BARCHA native `<select>` o'rniga (2026-10-21).
 *
 * ⚠️ Nima uchun: native `<select>` ning ochilgan ro'yxatini brauzer/OS chizadi va uni
 * CSS bilan bezab bo'lmaydi (foydalanuvchi: "to'rtburchakni stilga mosla").
 * ⚠️ Ro'yxat `body` ga PORTAL qilinadi (`position: fixed`) — jadvallar `overflow-x-auto`
 * ichida (UserRow), u yerda absolute ro'yxat kesilib qolardi. Pastda joy bo'lmasa
 * yuqoriga ochiladi. `z-[1100]` — Leaflet boshqaruvlari (1000/1001) ustida.
 * ⚠️ Forma bilan: qiymat yashirin `input` da. Uncontrolled rejimda `form.reset()`
 * (React 19 action'dan keyin o'zi chaqiradi) va `defaultValue` o'zgarishi kuzatiladi —
 * aks holda native select'dan farqli ravishda eski tanlov qolib ketardi.
 * Klaviatura: ↑/↓ — tanlash, Enter/Space — qabul, Esc/Tab — yopish, harf — o'sha
 * harfdan boshlanuvchi variantga o'tish.
 */
export function Dropdown<V extends Val>({
  options,
  value,
  defaultValue,
  onChange,
  ariaLabel,
  name,
  required,
  submitOnChange,
  resetOnChange,
  disabled,
  size = "md",
  className = "",
}: Props<V>) {
  const controlled = value !== undefined;
  const [inner, setInner] = useState<V | undefined>(defaultValue);
  const current = controlled ? value : inner;

  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [pos, setPos] = useState<{ left: number; top: number; minWidth: number; up: boolean } | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const btnRef = useRef<HTMLButtonElement | null>(null);
  const listRef = useRef<HTMLUListElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const listId = useId();

  // Server yangi `defaultValue` bersa (filtr formasi qayta chizilganda) — unga ergashamiz.
  useEffect(() => {
    if (!controlled) setInner(defaultValue);
  }, [controlled, defaultValue]);

  // `form.reset()` — native select o'z boshlang'ich qiymatiga qaytgani kabi.
  useEffect(() => {
    const form = rootRef.current?.closest("form");
    if (!form || controlled) return;
    const onReset = () => setInner(defaultValue);
    form.addEventListener("reset", onReset);
    return () => form.removeEventListener("reset", onReset);
  }, [controlled, defaultValue]);

  const foundIdx = options.findIndex((o) => o.value === current);
  const selectedIdx = foundIdx < 0 ? 0 : foundIdx;
  const selected = options[selectedIdx];

  const place = useCallback(() => {
    const r = btnRef.current?.getBoundingClientRect();
    if (!r) return;
    const below = window.innerHeight - r.bottom;
    const up = below < 240 && r.top > below;
    setPos({ left: r.left, top: up ? r.top - 4 : r.bottom + 4, minWidth: r.width, up });
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    place();
    // Sahifa aylansa ro'yxat tugma bilan birga yursin (ro'yxatning o'zi aylanganda emas).
    const onScroll = (e: Event) => {
      if (listRef.current && e.target instanceof Node && listRef.current.contains(e.target)) return;
      place();
    };
    window.addEventListener("resize", place);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [open, place]);

  // Tashqariga bosilganda yopish (ro'yxat portalda — uni ham "ichki" deb hisoblaymiz).
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (rootRef.current?.contains(t) || listRef.current?.contains(t)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  // Faol qator ko'rinib tursin (uzun ro'yxatda pastga aylantirish).
  useEffect(() => {
    if (!open) return;
    listRef.current?.querySelector<HTMLElement>(`[data-idx="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [open, active, pos]);

  const openList = () => {
    if (disabled) return;
    setActive(selectedIdx);
    setOpen(true);
  };

  const choose = (i: number) => {
    const o = options[i];
    setOpen(false);
    btnRef.current?.focus();
    if (!o || o.value === current) return;
    if (!controlled) setInner(o.value);
    onChange?.(o.value);
    if (submitOnChange) {
      const form = rootRef.current?.closest("form");
      if (!form) return;
      // React qayta chizishini kutmasdan DOM qiymatini yozamiz — yuborish shu zahoti.
      if (inputRef.current) inputRef.current.value = String(o.value);
      for (const child of resetOnChange ?? []) {
        const el = form.elements.namedItem(child);
        if (el instanceof HTMLInputElement || el instanceof HTMLSelectElement) el.value = "";
      }
      form.requestSubmit();
    }
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;
    if (!open) {
      if (["ArrowDown", "ArrowUp", "Enter", " "].includes(e.key)) {
        e.preventDefault();
        openList();
      }
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, options.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      choose(active);
    } else if (e.key === "Escape" || e.key === "Tab") {
      if (e.key === "Escape") e.preventDefault();
      setOpen(false);
    } else if (e.key.length === 1) {
      const ch = e.key.toLocaleLowerCase();
      const n = options.length;
      for (let k = 1; k <= n; k++) {
        const i = (active + k) % n;
        if (options[i].label.toLocaleLowerCase().startsWith(ch)) {
          setActive(i);
          break;
        }
      }
    }
  };

  const list =
    open && pos
      ? createPortal(
          <ul
            ref={listRef}
            id={listId}
            role="listbox"
            aria-label={ariaLabel}
            style={{
              position: "fixed",
              left: pos.left,
              top: pos.up ? undefined : pos.top,
              bottom: pos.up ? window.innerHeight - pos.top : undefined,
              minWidth: pos.minWidth,
            }}
            className="z-[1100] max-h-72 w-max max-w-[min(32rem,calc(100vw-2rem))] overflow-auto rounded-xl border border-border bg-card p-1 shadow-lg"
          >
            {options.map((o, i) => {
              const isSel = i === selectedIdx;
              const header = o.group && o.group !== options[i - 1]?.group ? o.group : null;
              return (
                <li key={`${o.group ?? ""}|${String(o.value)}`} role="presentation">
                  {header ? (
                    <div className="px-2.5 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      {header}
                    </div>
                  ) : null}
                  <div
                    data-idx={i}
                    role="option"
                    aria-selected={isSel}
                    onMouseEnter={() => setActive(i)}
                    onMouseDown={(e) => e.preventDefault()} // fokus tugmada qolsin
                    onClick={() => choose(i)}
                    className={`flex cursor-pointer items-center justify-between gap-3 rounded-lg py-1.5 ${
                      o.group ? "pl-4 pr-2.5" : "px-2.5"
                    } ${size === "sm" ? "text-[12.5px]" : "text-sm"} ${
                      isSel ? "font-medium text-[color:var(--navy)]" : "text-slate-700"
                    } ${i === active ? "bg-muted" : ""}`}
                    style={isSel && i !== active ? { background: "var(--gold-lighter)" } : undefined}
                  >
                    {o.label}
                    {isSel ? <Check className="h-3.5 w-3.5 shrink-0" style={{ color: "var(--gold)" }} /> : null}
                  </div>
                </li>
              );
            })}
          </ul>,
          document.body,
        )
      : null;

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        ref={btnRef}
        type="button"
        role="combobox"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        disabled={disabled}
        onClick={() => (open ? setOpen(false) : openList())}
        onKeyDown={onKeyDown}
        className={`flex w-full items-center justify-between gap-2 border bg-card text-left text-slate-700 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--gold-light)] disabled:cursor-not-allowed disabled:opacity-50 ${
          SIZE[size]
        } ${open ? "border-[color:var(--gold)]" : "border-slate-200 hover:bg-muted/60"}`}
      >
        <span className={`truncate ${foundIdx < 0 || (required && current === "") ? "text-slate-400" : ""}`}>{selected?.label}</span>
        <ChevronDown
          className={`h-3.5 w-3.5 shrink-0 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      {name ? (
        required ? (
          // `type="hidden"` `required`ni tekshirmaydi — shuning uchun ko'rinmas matn maydoni,
          // tugma ustida: brauzer ogohlantirishi aynan tanlagich ostida chiqadi.
          <input
            ref={inputRef}
            name={name}
            required
            tabIndex={-1}
            aria-hidden
            value={current === undefined ? "" : String(current)}
            onChange={() => {}}
            className="pointer-events-none absolute inset-0 h-full w-full opacity-0"
          />
        ) : (
          <input ref={inputRef} type="hidden" name={name} value={current === undefined ? "" : String(current)} />
        )
      ) : null}
      {list}
    </div>
  );
}
