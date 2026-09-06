"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";

// Kadastr javobidagi maydon maydonlari — kod nomlari xom holda ko'rsatiladi,
// chunki ayrim suffikslar (_i, _b, _f, _z, _d, _bd, _nz, _legal) ma'nosi jonli
// javobda ham hujjatlashtirilmagan (CLAUDE.md: parametr nomlariga taxminga tayanmaslik).
//
// ⚠️ ESKI (API 2) shakli — yassi maydonlar.
const AREA_KEYS = [
  "land_area",
  "land_area_i",
  "land_area_b",
  "land_area_f",
  "land_area_z",
  "land_area_d",
  "object_area",
  "object_area_l",
  "object_area_u",
  "object_area_legal",
  "object_area_bd",
  "object_area_nz",
  "object_area_p",
  "object_area_p_bd",
  "object_area_p_legal",
  "object_area_p_nz",
] as const;

/**
 * ⚠️ YANGI (`cad_data`) shakli — maydonlar `land`/`object` bloklari ichida.
 * Nomlar ham boshqacha, shuning uchun alohida ro'yxat: `object_pl_obfull` va
 * `object_area_p` bir xil narsani bildiradi, lekin ikkalasini bitta ro'yxatga
 * qo'shish qaysi javob ko'rilayotganini chalkashtirardi.
 */
const NEW_AREA_KEYS: [string, string][] = [
  ["land.area", "land"],
  ["land.area_u", "land"],
  ["land.area_z", "land"],
  ["land.area_b", "land"],
  ["object.object_pl_obfull", "object"],
  ["object.object_pl_polezfull", "object"],
  ["object.pl_obzd", "object"],
  ["object.pl_polezzd", "object"],
  ["object.pl_obsoor", "object"],
  ["object.pl_polezsoor", "object"],
  ["object.rooms", "object"],
];

/** Javob yangi shakldami — `lib/area.ts` dagi bilan bir xil mezon. */
function isNewShape(raw: Record<string, unknown>): boolean {
  const isObj = (v: unknown) => typeof v === "object" && v !== null && !Array.isArray(v);
  return isObj(raw.object) || isObj(raw.land);
}

function dig(raw: Record<string, unknown>, path: string): unknown {
  return path.split(".").reduce<unknown>((acc, k) => {
    if (acc && typeof acc === "object") return (acc as Record<string, unknown>)[k];
    return undefined;
  }, raw);
}

function formatValue(v: unknown): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "number") return `${v.toLocaleString("uz")} m²`;
  const n = Number(v);
  if (typeof v === "string" && v.trim() !== "" && Number.isFinite(n)) return `${n.toLocaleString("uz")} m²`;
  return String(v);
}

export function CadastreRawData({ rawApi2 }: { rawApi2: unknown }) {
  const [open, setOpen] = useState(false);
  const raw = (rawApi2 as Record<string, unknown> | null) ?? null;
  if (!raw) return null;

  return (
    <div className="mt-4 border-t border-border pt-3">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 text-sm font-medium hover:underline"
        style={{ color: "var(--cobalt)" }}
      >
        <ChevronDown className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} />
        Barcha kadastr ma&apos;lumotlari
      </button>
      {open ? (
        <dl className="mt-3 grid grid-cols-2 gap-4 md:grid-cols-4">
          {isNewShape(raw)
            ? NEW_AREA_KEYS.map(([path]) => (
                <div key={path}>
                  <dt className="font-mono text-xs text-muted-foreground">{path}</dt>
                  <dd className="mt-0.5 text-sm">{formatValue(dig(raw, path))}</dd>
                </div>
              ))
            : AREA_KEYS.map((key) => (
                <div key={key}>
                  <dt className="font-mono text-xs text-muted-foreground">{key}</dt>
                  <dd className="mt-0.5 text-sm">{formatValue(raw[key])}</dd>
                </div>
              ))}
        </dl>
      ) : null}
    </div>
  );
}
