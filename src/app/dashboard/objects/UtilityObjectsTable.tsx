"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown, Droplets, Flame, Zap } from "lucide-react";
import type { PropertyUtilityCells, UtilityCell } from "@/server/services/properties";

// ─────────────────────────────────────────────────────────────────────────────
// Kommunal filtri (`?utility=`) qo'llanganda ko'rsatiladigan IXCHAM ro'yxat.
//
// Foydalanuvchi talabi (2026-08-17): faqat kadastr + suv/gaz/elektr ustunlari qolsin,
// xizmat katakchasi bosilganda o'sha xizmatning asosiy ma'lumotlari QATOR OSTIDA
// ochilsin, va obyekt sahifasiga FAQAT kadastr raqami orqali o'tilsin.
//
// ⚠️ Shu sababli xizmat katakchasi <button>, kadastr esa <Link> — ikkalasi bitta
// qatorda bo'lgani uchun katakchani <Link> ichiga solib bo'lmaydi (ichma-ich havola
// hosil bo'lardi va bosilganda obyekt sahifasiga o'tib ketardi).
// ─────────────────────────────────────────────────────────────────────────────

export interface UtilityRowItem {
  id: string;
  cadNumber: string;
  cadNumberOld: string | null;
  href: string;
  regionName: string;
  cells: PropertyUtilityCells;
}

type Kind = "WATER" | "GAS" | "ELECTRIC";

const KINDS: { key: Kind; label: string; icon: typeof Droplets; tone: string }[] = [
  { key: "WATER", label: "Suv", icon: Droplets, tone: "text-sky-600" },
  { key: "GAS", label: "Gaz", icon: Flame, tone: "text-orange-600" },
  { key: "ELECTRIC", label: "Elektr", icon: Zap, tone: "text-amber-600" },
];

export function UtilityObjectsTable({ rows }: { rows: UtilityRowItem[] }) {
  // Ochilgan panel kaliti: `${propertyId}:${kind}`. Bir vaqtda bir nechtasi ochiq
  // bo'lishi mumkin — obyektlarni solishtirish uchun (foydalanuvchi tanlovi).
  const [open, setOpen] = useState<Set<string>>(new Set());

  const toggle = (key: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  if (rows.length === 0) {
    return (
      <div className="rounded-xl bg-slate-50 px-5 py-10 text-center text-sm text-muted-foreground ring-1 ring-slate-200">
        Tanlangan shart bo&apos;yicha obyekt topilmadi.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl ring-1 ring-slate-200">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b bg-slate-50 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <th className="px-4 py-3 font-medium">Kadastr</th>
            {KINDS.map((k) => (
              <th key={k.key} className="px-4 py-3 text-center font-medium">
                {k.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const openKinds = KINDS.filter((k) => open.has(`${r.id}:${k.key}`) && r.cells[k.key].found);
            return (
              <tr key={r.id} className="border-b align-top last:border-0">
                <td className="px-4 py-3">
                  {/* Obyekt sahifasiga YAGONA kirish nuqtasi. */}
                  <Link
                    href={r.href}
                    className="font-medium hover:underline"
                    style={{ color: "var(--cobalt)" }}
                  >
                    {r.cadNumber}
                  </Link>
                  <div className="mt-0.5 text-xs text-muted-foreground">{r.regionName}</div>
                  {/* Ochilgan panellar shu ustun ostida, butun kenglikda emas —
                      shunda qaysi obyektga tegishli ekani aniq ko'rinadi. */}
                  {openKinds.length > 0 ? (
                    <div className="mt-2 space-y-2">
                      {openKinds.map((k) => (
                        <Panel key={k.key} title={k.label} icon={k.icon} tone={k.tone} cell={r.cells[k.key]} />
                      ))}
                    </div>
                  ) : null}
                </td>
                {KINDS.map((k) => {
                  const cell = r.cells[k.key];
                  const key = `${r.id}:${k.key}`;
                  const isOpen = open.has(key);
                  if (!cell.found) {
                    return (
                      <td key={k.key} className="px-4 py-3 text-center text-slate-300">
                        —
                      </td>
                    );
                  }
                  return (
                    <td key={k.key} className="px-4 py-3 text-center">
                      <button
                        type="button"
                        onClick={() => toggle(key)}
                        aria-expanded={isOpen}
                        className="inline-flex flex-col items-center rounded-lg px-2 py-1 transition hover:bg-slate-100"
                      >
                        <span className={`inline-flex items-center gap-1 font-medium ${k.tone}`}>
                          {cell.short}
                          <ChevronDown
                            className={`h-3.5 w-3.5 transition-transform ${isOpen ? "rotate-180" : ""}`}
                          />
                        </span>
                        {cell.hint ? (
                          <span className="text-[11px] text-muted-foreground">{cell.hint}</span>
                        ) : null}
                      </button>
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function Panel({
  title,
  icon: Icon,
  tone,
  cell,
}: {
  title: string;
  icon: typeof Droplets;
  tone: string;
  cell: UtilityCell;
}) {
  return (
    <div className="rounded-lg bg-slate-50 p-3 ring-1 ring-slate-200">
      <div className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold">
        <Icon className={`h-3.5 w-3.5 ${tone}`} />
        <span style={{ color: "var(--navy)" }}>{title}</span>
        {cell.matchedByOldCad ? (
          <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-normal text-amber-800">
            eski kadastr orqali
          </span>
        ) : null}
      </div>
      <dl className="grid gap-x-4 gap-y-1 text-xs sm:grid-cols-[auto_1fr]">
        {cell.rows.map((row) => (
          <div key={row.label} className="contents">
            <dt className="text-muted-foreground">{row.label}:</dt>
            <dd className="break-words font-medium text-slate-800">{row.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
