"use client";

import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster";
import "leaflet.markercluster/dist/MarkerCluster.css";
import { categoryColor, BRAND } from "@/lib/chartColors";
import { UZ_CENTER, UZ_ZOOM } from "@/lib/geo";
import { objectHref } from "@/lib/cadastre";
import type { MapPoint, RegionBubble } from "@/server/services/map";

export interface PropertyMapProps {
  points: MapPoint[];
  bubbles: RegionBubble[];
  mode: "nuqta" | "hudud";
  tileUrl: string;
  tileAttribution: string;
  /** Obyekt sahifasi manzilini qurish uchun (production'da `/obyektlar`). */
  basePath: string;
}

/**
 * Leaflet xaritasi.
 *
 * ⚠️ STANDART Leaflet markeri ISHLATILMAYDI. U `marker-icon.png` ni ildizdan qidiradi
 * va `/obyektlar` sub-path ostida 404 beradi (klassik tuzoq) — natijada nuqtalar
 * ko'rinmay qolardi. O'rniga `L.circleMarker` (vektor): rasm umuman kerak emas,
 * kategoriya rangi bilan bo'yaladi va 1800 nuqta uchun yengilroq.
 *
 * ⚠️ Leaflet DOM'ga to'g'ridan-to'g'ri tegadi, shuning uchun butun komponent
 * `useEffect` ichida qo'lda boshqariladi (react-leaflet o'rniga) — klaster
 * plaginining tipi va React 19 bilan mosligi shu yo'lda eng barqaror.
 */
export function PropertyMap({
  points,
  bubbles,
  mode,
  tileUrl,
  tileAttribution,
  basePath,
}: PropertyMapProps) {
  const boxRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.Layer | null>(null);
  const [tileFailed, setTileFailed] = useState(false);

  // Xaritani bir marta yaratamiz.
  useEffect(() => {
    if (!boxRef.current || mapRef.current) return;
    const map = L.map(boxRef.current, {
      center: [UZ_CENTER.lat, UZ_CENTER.lng],
      zoom: UZ_ZOOM,
      scrollWheelZoom: false, // sahifa aylantirilayotganda xarita "ushlab qolmasin"
      attributionControl: true,
    });
    L.tileLayer(tileUrl, { attribution: tileAttribution, maxZoom: 19 })
      .on("tileerror", () => setTileFailed(true))
      .addTo(map);
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [tileUrl, tileAttribution]);

  // Rejim yoki ma'lumot o'zgarganda qatlamni almashtiramiz.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (layerRef.current) {
      map.removeLayer(layerRef.current);
      layerRef.current = null;
    }

    if (mode === "hudud") {
      const group = L.layerGroup();
      const max = Math.max(...bubbles.map((b) => b.total), 1);
      for (const b of bubbles) {
        // Radius √(ulush) — maydon songa mutanosib bo'lsin (ko'z yuzani solishtiradi).
        const r = 12 + 30 * Math.sqrt(b.total / max);
        const vacantPct = b.total > 0 ? b.vacant / b.total : 0;
        L.circleMarker([b.lat, b.lng], {
          radius: r,
          weight: 1.5,
          color: "#fff",
          fillColor: vacantPct > 0.5 ? BRAND.gold : vacantPct > 0.25 ? "#d9c08e" : BRAND.cobalt,
          fillOpacity: 0.78,
        })
          .bindTooltip(
            `<b>${b.name}</b><br>Jami: ${b.total}<br>Bo'sh turgan: ${b.vacant}`,
            { direction: "top" },
          )
          .addTo(group);
      }
      group.addTo(map);
      layerRef.current = group;
      return;
    }

    const cluster = L.markerClusterGroup({
      maxClusterRadius: 48,
      showCoverageOnHover: false,
      iconCreateFunction: (c) => {
        const n = c.getChildCount();
        const size = n < 10 ? 34 : n < 100 ? 42 : 52;
        return L.divIcon({
          html: `<div style="background:${BRAND.navy};color:${BRAND.gold};border:2px solid ${BRAND.gold};border-radius:99px;width:100%;height:100%;display:grid;place-items:center;font:600 12px system-ui">${n}</div>`,
          className: "dm-cluster",
          iconSize: [size, size],
        });
      },
    });

    for (const p of points) {
      const m = L.circleMarker([p.lat, p.lng], {
        radius: 6,
        weight: 1.6,
        color: "#fff",
        fillColor: categoryColor(p.cat),
        fillOpacity: 0.95,
      });
      // ⚠️ Kadastr raqamida `/` bor — URL faqat `lib/cadastre.ts` orqali quriladi.
      const href = `${basePath}${objectHref(p.cad)}`;
      m.bindPopup(
        `<div style="font:13px system-ui;min-width:160px">
           ${p.name ? `<div style="font-weight:600;margin-bottom:2px">${escapeHtml(p.name)}</div>` : ""}
           <div style="color:#64748b;margin-bottom:6px">${escapeHtml(p.cad)}</div>
           <a href="${href}" style="color:#1a3a7c;font-weight:500">Obyekt sahifasi →</a>
         </div>`,
      );
      cluster.addLayer(m);
    }
    cluster.addTo(map);
    layerRef.current = cluster;
  }, [mode, points, bubbles, basePath]);

  return (
    <div className="relative">
      {tileFailed ? (
        <div
          className="absolute left-2 right-2 top-2 z-[500] rounded-lg border px-3 py-2 text-xs"
          style={{ background: "var(--gold-lighter)", borderColor: "var(--gold-light)", color: "#7a5f28" }}
        >
          Xarita foni yuklanmadi (tashqi manzilga ulanib bo&apos;lmadi) — nuqtalar baribir
          ko&apos;rsatilyapti. Ichki tile serveri bo&apos;lsa <code>MAP_TILE_URL</code> orqali
          ulanadi.
        </div>
      ) : null}
      <div ref={boxRef} className="h-[440px] w-full rounded-b-xl bg-slate-100" />
    </div>
  );
}

/** Popup HTML'iga kadastr/nom qo'yishdan oldin — ma'lumot bazadan keladi. */
function escapeHtml(v: string): string {
  return v.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string,
  );
}
