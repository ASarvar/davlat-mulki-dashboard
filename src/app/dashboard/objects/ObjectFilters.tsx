"use client";

import { useState } from "react";
import { Search, RotateCcw, SlidersHorizontal, X, ChevronDown } from "lucide-react";
import { CATEGORIES, CAT_REMOVED_FROM_BALANCE, REMOVED_FROM_BALANCE_LABEL } from "@/lib/categories";
import { formatNumber } from "@/lib/utils";

const selectCls =
  "rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm outline-none transition focus:border-cobalt focus:ring-2 focus:ring-cobalt/20";

/**
 * Dashboard'dan kelgan maxsus filtr (Auksion savdolarida, To'liq ijara berilgan,
 * Ijaraga berilgan, Sinxronizatsiya holati). Ular formada TANLAGICH sifatida yo'q —
 * yorliq (chip) ko'rinishida chiqadi va yashirin maydon orqali saqlanadi.
 * ⚠️ Yashirin maydon SHART: GET forma faqat o'z maydonlarini yuboradi, ya'ni bularsiz
 * boshqa filtrni o'zgartirgan zahoti bu filtr jimgina yo'qolib ketardi.
 */
export interface FilterChip {
  key: string;
  value: string;
  label: string;
  /** Shu filtrni olib tashlaydigan URL (server tomonda quriladi). */
  removeHref: string;
}

export interface ObjectFiltersProps {
  regions: { id: string; name: string }[];
  /** Tanlangan hududning tumanlari. Hudud tanlanmagan bo'lsa bo'sh — tanlagich ko'rinmaydi. */
  districts: { id: string; name: string }[];
  sohaList: string[];
  /** Tanlangan sohaning tashkilotlari. Soha tanlanmagan bo'lsa bo'sh. */
  orgs: { id: string; label: string }[];
  /** MODERATOR uchun: "Faqat mening tashkilotlarim" — Hudud select'ining birinchi varianti. */
  showMyRegionsToggle?: boolean;
  /**
   * ADMIN uchun: Kategoriya ro'yxatiga "Balansdan chiqarilgan" varianti qo'shiladi.
   * Bunday obyektlar boshqa hech qayerda (dashboard, standart ro'yxat) ko'rinmaydi.
   */
  canSeeRemoved?: boolean;
  chips: FilterChip[];
  /** Topilgan obyektlar soni — filtr ta'sirini darhol ko'rsatadi. */
  total: number;
  clearHref: string;
  current: {
    q?: string;
    region?: string;
    district?: string;
    soha?: string;
    tashkilot?: string;
    category?: string;
    inefficient?: string;
  };
}

/**
 * Obyektlar ro'yxati filtri — server-rendered GET forma (client JS shart emas, faqat
 * qulaylik uchun ishlatiladi).
 *
 * Tuzilishi: asosiy qator (Kadastr, Soha, Tashkilot, Hudud) + "Qo'shimcha" ochiladigan
 * bo'lim (Tuman, Kategoriya, Samaradorlik). Qo'shimcha bo'lim YASHIRILADI, lekin DOM'dan
 * olib tashlanMAYDI — aks holda yopiq holatda uning qiymatlari yuborilmay qolardi.
 */
export function ObjectFilters({
  regions,
  districts,
  sohaList,
  orgs,
  showMyRegionsToggle,
  canSeeRemoved,
  chips,
  total,
  clearHref,
  current,
}: ObjectFiltersProps) {
  const advancedValues = [current.district, current.category, current.inefficient].filter(Boolean);
  // Qo'shimcha ichida faol filtr bo'lsa — ochiq holda boshlanadi, aks holda foydalanuvchi
  // qayerdan kelganini tushunmay qolardi.
  const [open, setOpen] = useState(advancedValues.length > 0);

  const hasAnyFilter =
    Boolean(current.q || current.region || current.soha || current.tashkilot) ||
    advancedValues.length > 0 ||
    chips.length > 0;

  /**
   * Ota filtr o'zgarganda BOLA filtrni tozalab yuboradi.
   * ⚠️ Busiz: soha "Ijara markazi"dan "Direksiya"ga almashtirilsa, eski `tashkilot`
   * (Andijon Ijara markazi) ham yuborilardi — ikkalasi AND bilan birikib natija bo'sh
   * chiqardi, sababi esa ekranda ko'rinmasdi. Hudud → tuman juftligida ham xuddi shunday.
   */
  const submitResetting = (form: HTMLFormElement | null, childName: string) => {
    if (!form) return;
    const child = form.elements.namedItem(childName);
    if (child instanceof HTMLSelectElement) child.value = "";
    form.requestSubmit();
  };

  return (
    <form
      method="get"
      action="/dashboard/objects"
      className="mb-4 rounded-xl border border-border bg-card p-4 shadow-sm"
    >
      {/* Dashboard'dan kelgan filtrlarni saqlab qolamiz (yuqoridagi izohga qarang). */}
      {chips.map((c) => (
        <input key={c.key} type="hidden" name={c.key} value={c.value} />
      ))}

      {/* ── Asosiy qator ── */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col">
          <label className="mb-1 text-xs font-medium text-muted-foreground">Kadastr (yangi/eski)</label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              name="q"
              defaultValue={current.q ?? ""}
              placeholder="Qidirish..."
              className={`${selectCls} w-56 pl-9`}
            />
          </div>
        </div>

        <div className="flex flex-col">
          <label className="mb-1 text-xs font-medium text-muted-foreground">Soha (manba)</label>
          <select
            name="soha"
            defaultValue={current.soha ?? ""}
            onChange={(e) => submitResetting(e.currentTarget.form, "tashkilot")}
            className={`${selectCls} w-52`}
          >
            <option value="">Barchasi</option>
            {sohaList.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>

        {/* Tashkilot ro'yxati tanlangan SOHAGA bog'liq — soha tanlanmasa ko'rinmaydi. */}
        {orgs.length > 1 ? (
          <div className="flex flex-col">
            <label className="mb-1 text-xs font-medium text-muted-foreground">Tashkilot</label>
            <select
              name="tashkilot"
              defaultValue={current.tashkilot ?? ""}
              onChange={(e) => e.currentTarget.form?.requestSubmit()}
              className={`${selectCls} w-48`}
            >
              <option value="">Barchasi</option>
              {orgs.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        ) : null}

        <div className="flex flex-col">
          <label className="mb-1 text-xs font-medium text-muted-foreground">Hudud</label>
          <select
            name="region"
            defaultValue={current.region ?? ""}
            onChange={(e) => submitResetting(e.currentTarget.form, "district")}
            className={`${selectCls} w-48`}
          >
            {showMyRegionsToggle ? <option value="mine">Faqat mening tashkilotlarim</option> : null}
            <option value="">Barchasi</option>
            {regions.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </div>

        <button
          type="submit"
          className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:opacity-90"
          style={{ background: "var(--cobalt)" }}
        >
          <Search className="h-4 w-4" />
          Qidirish
        </button>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 shadow-sm transition hover:bg-slate-50"
        >
          <SlidersHorizontal className="h-4 w-4" />
          Qo&apos;shimcha
          {advancedValues.length > 0 ? (
            <span
              className="rounded-full px-1.5 text-xs font-semibold text-white"
              style={{ background: "var(--cobalt)" }}
            >
              {advancedValues.length}
            </span>
          ) : null}
          <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
        </button>

        {hasAnyFilter ? (
          <a
            href={clearHref}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 shadow-sm transition hover:bg-slate-50"
          >
            <RotateCcw className="h-4 w-4" />
            Tozalash
          </a>
        ) : null}

        <span className="ml-auto self-center text-sm text-muted-foreground">
          {formatNumber(total)} ta obyekt
        </span>
      </div>

      {/* ── Qo'shimcha filtrlar ──
          `hidden` bilan yashiriladi (shartli render EMAS) — yopiq holatda ham
          qiymatlari forma bilan birga yuborilishi kerak. */}
      <div className={`mt-3 flex flex-wrap items-end gap-3 border-t border-border pt-3 ${open ? "" : "hidden"}`}>
        {/* Tuman tanlagichi tanlangan HUDUDGA bog'liq — hudud tanlanmasa 205 ta tuman
            bitta ro'yxatga tushib ketardi. */}
        {districts.length > 0 ? (
          <div className="flex flex-col">
            <label className="mb-1 text-xs font-medium text-muted-foreground">Tuman</label>
            <select
              name="district"
              defaultValue={current.district ?? ""}
              onChange={(e) => e.currentTarget.form?.requestSubmit()}
              className={`${selectCls} w-48`}
            >
              <option value="">Barchasi</option>
              {districts.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <p className="pb-2 text-xs text-muted-foreground">Tuman bo&apos;yicha filtrlash uchun avval hududni tanlang.</p>
        )}

        <div className="flex flex-col">
          <label className="mb-1 text-xs font-medium text-muted-foreground">Kategoriya</label>
          <select
            name="category"
            defaultValue={current.category ?? ""}
            onChange={(e) => e.currentTarget.form?.requestSubmit()}
            className={`${selectCls} w-56`}
          >
            <option value="">Barchasi</option>
            {CATEGORIES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.short}
              </option>
            ))}
            {/* Haqiqiy kategoriya emas — `Property.removedFromBalance` bayrog'i bo'yicha
                filtr. Faqat adminga ko'rsatiladi (server tomonda ham tekshiriladi). */}
            {canSeeRemoved ? (
              <option value={CAT_REMOVED_FROM_BALANCE}>{REMOVED_FROM_BALANCE_LABEL}</option>
            ) : null}
          </select>
        </div>

        <div className="flex flex-col">
          <label className="mb-1 text-xs font-medium text-muted-foreground">Samaradorlik</label>
          <select
            name="inefficient"
            defaultValue={current.inefficient ?? ""}
            onChange={(e) => e.currentTarget.form?.requestSubmit()}
            className={`${selectCls} w-40`}
          >
            <option value="">Barchasi</option>
            <option value="1">Samarasiz</option>
            <option value="0">Samarali</option>
          </select>
        </div>
      </div>

      {/* ── Dashboard'dan kelgan filtrlar (yorliq) ── */}
      {chips.length > 0 ? (
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-3">
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Qo&apos;llangan</span>
          {chips.map((c) => (
            <a
              key={c.key}
              href={c.removeHref}
              title="Olib tashlash"
              className="inline-flex items-center gap-1.5 rounded-full border border-cobalt/30 bg-cobalt/5 px-3 py-1 text-xs font-medium transition hover:bg-cobalt/10"
              style={{ color: "var(--cobalt)" }}
            >
              {c.label}
              <X className="h-3 w-3" />
            </a>
          ))}
        </div>
      ) : null}
    </form>
  );
}
