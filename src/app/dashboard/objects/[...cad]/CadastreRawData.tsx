"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";

// API 2 (UZKAD) javobidagi maydon maydonlari — kod nomlari xom holda ko'rsatiladi,
// chunki ayrim suffikslar (_i, _b, _f, _z, _d, _bd, _nz, _legal) ma'nosi jonli
// javobda ham hujjatlashtirilmagan (CLAUDE.md: parametr nomlariga taxminga tayanmaslik).
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
          {AREA_KEYS.map((key) => (
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
