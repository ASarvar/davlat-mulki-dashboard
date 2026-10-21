"use client";

import { useMemo, useState } from "react";
import { X } from "lucide-react";
import { CATEGORIES } from "@/lib/categories";
import { categoryColor } from "@/lib/chartColors";
import type { MapDistrict, MapPoint, MapRegion } from "@/server/services/map";
import { Dropdown } from "@/components/ui/Dropdown";
import { MapSection } from "./MapSection";

interface Props {
  points: MapPoint[];
  regions: MapRegion[];
  districts: MapDistrict[];
  tileUrl: string;
  tileAttribution: string;
  basePath: string;
}

// ⚠️ `toLocaleString` EMAS — Node va brauzer turlicha formatlab gidratsiyani buzardi
// (`dashboard/page.tsx` dagi izohlarga qarang).
const nf = (n: number) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, " ");

/**
 * Panel xaritasi + uning filtri (kategoriya, hudud, tuman) — 2026-10-21.
 *
 * ⚠️ Filtr FAQAT XARITAGA ta'sir qiladi (foydalanuvchi tanlovi): kartalar, grafiklar
 * va reyting o'zgarmaydi. Shuning uchun u server so'rovi emas, client'da — nuqtalar
 * allaqachon yuklangan, filtr bir zumda ishlaydi.
 * ⚠️ Kategoriya — PIN RANGI bilan bir xil effektiv kategoriya (`MapPoint.cat`). Bu
 * dashboard jadvalidagi 3/4/5/6/12 ustunlaridan farq qilishi mumkin: ular kategoriyadan
 * emas, xususiyatdan sanaladi (CLAUDE.md → "Kategoriyalar").
 * ⚠️ Hudud o'zgarsa tuman TOZALANADI — eski tuman yangi hudud bilan birga qolsa
 * natija jimgina bo'sh chiqardi (obyektlar filtridagi 1-qoida bilan bir xil).
 * Kategoriya sanoqlari hudud/tuman tanlovini HISOBGA OLADI, kategoriya tanlovini emas.
 */
export function MapExplorer({ points, regions, districts, tileUrl, tileAttribution, basePath }: Props) {
  const [cats, setCats] = useState<Set<number>>(new Set());
  const [region, setRegion] = useState(-1);
  const [district, setDistrict] = useState(-1);

  const inArea = useMemo(
    () => points.filter((p) => (region < 0 || p.r === region) && (district < 0 || p.d === district)),
    [points, region, district],
  );
  const visible = useMemo(
    () => (cats.size === 0 ? inArea : inArea.filter((p) => cats.has(p.cat))),
    [inArea, cats],
  );
  const catCounts = useMemo(() => {
    const m = new Map<number, number>();
    for (const p of inArea) m.set(p.cat, (m.get(p.cat) ?? 0) + 1);
    return m;
  }, [inArea]);

  const regionDistricts = useMemo(
    () => (region < 0 ? [] : districts.map((d, i) => ({ ...d, i })).filter((d) => d.r === region)),
    [districts, region],
  );

  const toggleCat = (code: number) =>
    setCats((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });

  const filtered = cats.size > 0 || region >= 0 || district >= 0;
  const reset = () => {
    setCats(new Set());
    setRegion(-1);
    setDistrict(-1);
  };
  const focusKey = `${region}:${district}:${[...cats].sort((a, b) => a - b).join(",")}`;

  return (
    <>
      <div className="mx-4 mb-3 space-y-2.5 md:mx-5">
        <div className="flex flex-wrap items-center gap-2">
          <Dropdown
            ariaLabel="Hudud"
            value={region}
            onChange={(v) => {
              setRegion(v);
              setDistrict(-1);
            }}
            options={[{ value: -1, label: "Barcha hududlar" }, ...regions.map((g, i) => ({ value: i, label: g.name }))]}
            size="sm"
            className="w-48"
          />
          <Dropdown
            ariaLabel="Tuman"
            value={district}
            onChange={setDistrict}
            disabled={region < 0 || regionDistricts.length === 0}
            options={[
              { value: -1, label: region < 0 ? "Avval hududni tanlang" : "Barcha tumanlar" },
              ...regionDistricts.map((d) => ({ value: d.i, label: d.name })),
            ]}
            size="sm"
            className="w-52"
          />
          <span className="ml-auto text-[12px] text-muted-foreground">
            Xaritada: <b className="text-slate-700">{nf(visible.length)}</b> obyekt
          </span>
          {filtered ? (
            <button
              type="button"
              onClick={reset}
              className="inline-flex h-8 items-center gap-1 rounded-lg border border-border bg-card px-2.5 text-[12px] font-medium text-slate-600 transition-colors hover:bg-muted"
            >
              <X className="h-3.5 w-3.5" />
              Tozalash
            </button>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-1.5">
          {CATEGORIES.filter((c) => (catCounts.get(c.code) ?? 0) > 0 || cats.has(c.code)).map((c) => {
            const on = cats.has(c.code);
            const color = categoryColor(c.code);
            return (
              <button
                key={c.code}
                type="button"
                aria-pressed={on}
                onClick={() => toggleCat(c.code)}
                className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12px] transition-colors ${
                  on ? "font-medium text-slate-800" : "border-border bg-card text-slate-600 hover:bg-muted"
                }`}
                style={on ? { borderColor: color, background: `${color}1f` } : undefined}
              >
                <i className="h-2.5 w-2.5 rounded-full" style={{ background: color }} />
                {c.short}
                <span className="text-slate-400">{nf(catCounts.get(c.code) ?? 0)}</span>
              </button>
            );
          })}
        </div>
      </div>

      <MapSection
        points={visible}
        bubbles={[]}
        mode="nuqta"
        tileUrl={tileUrl}
        tileAttribution={tileAttribution}
        basePath={basePath}
        focusKey={focusKey}
      />
    </>
  );
}
