"use client";

import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import { pinIcon } from "./pin";

export interface ObjectLocationMapProps {
  lat: number;
  lng: number;
  /** Effektiv kategoriya — pin rangi (panel xaritasidagi bilan bir xil). */
  cat: number;
  tileUrl: string;
  tileAttribution: string;
}

/**
 * Obyekt sahifasidagi kichik xarita — bitta obyektning joylashuvi ("Kategoriya
 * biriktirish" ustida, 2026-09-22).
 *
 * `PropertyMap` dan ATAYLAB alohida: u yerda klaster, rejimlar, to'liq ekran va
 * 520–620px quti bor; bu yerda bitta pin va yon ustundagi kichik quti. Umumiy
 * qismi — belgi (`pin.ts`), ya'ni ikkala xaritada pin bir xil.
 *
 * ⚠️ G'ildirak bilan kattalashtirish O'CHIQ — xarita sahifa o'rtasida turadi,
 * aks holda sahifani aylantirayotgan foydalanuvchi xaritani kattalashtirib yuborardi.
 * Kattalashtirish +/− tugmalari bilan.
 * ⚠️ Pin `interactive: false` — popup yo'q (sahifaning o'zi o'sha obyekt haqida).
 * ⚠️ `ResizeObserver` + `invalidateSize()` MAJBURIY — `dynamic({ssr:false})` bilan
 * yuklanganda Leaflet konteyner o'lchamini layout tugamasdan o'lchab olishi mumkin
 * (`PropertyMap` dagi izohga qarang).
 * ⚠️ Xarita qutisining `className` i O'ZGARMAS — Leaflet unga o'z klasslarini qo'shadi,
 * React esa o'zgargan `className` bilan ularni o'chirib yuborardi (`PropertyMap` izohi).
 */
export function ObjectLocationMap({ lat, lng, cat, tileUrl, tileAttribution }: ObjectLocationMapProps) {
  const boxRef = useRef<HTMLDivElement | null>(null);
  const [tileFailed, setTileFailed] = useState(false);

  useEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    const map = L.map(box, {
      center: [lat, lng],
      zoom: 16,
      scrollWheelZoom: false,
      attributionControl: true,
    });
    L.tileLayer(tileUrl, { attribution: tileAttribution, maxZoom: 19 })
      .on("tileerror", () => setTileFailed(true))
      .addTo(map);
    L.marker([lat, lng], { icon: pinIcon(cat), interactive: false, keyboard: false }).addTo(map);

    let raf = 0;
    const remeasure = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => map.invalidateSize());
    };
    remeasure();
    const ro = new ResizeObserver(remeasure);
    ro.observe(box);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      map.remove();
    };
  }, [lat, lng, cat, tileUrl, tileAttribution]);

  return (
    <div className="relative">
      {tileFailed ? (
        <div
          className="absolute left-2 right-2 top-2 z-[500] rounded-lg border px-3 py-2 text-xs"
          style={{ background: "var(--gold-lighter)", borderColor: "var(--gold-light)", color: "#7a5f28" }}
        >
          Xarita foni yuklanmadi (tashqi manzilga ulanib bo&apos;lmadi) — belgi baribir
          ko&apos;rsatilyapti.
        </div>
      ) : null}
      <div ref={boxRef} className="h-[240px] w-full rounded-lg bg-slate-100" />
    </div>
  );
}
