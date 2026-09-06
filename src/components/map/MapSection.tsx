"use client";

import dynamic from "next/dynamic";
import type { PropertyMapProps } from "./PropertyMap";

/**
 * Xaritaning client o'rami.
 *
 * ⚠️ NIMA UCHUN ALOHIDA FAYL: `dynamic(..., { ssr: false })` Next 15 da Server
 * Component ICHIDA ishlatib bo'lmaydi — build xatosi beradi. Leaflet esa `window` ga
 * tayanadi, ya'ni serverda render qilib bo'lmaydi. Shuning uchun oraliq
 * `"use client"` o'ram kerak.
 */
const PropertyMap = dynamic(() => import("./PropertyMap").then((m) => m.PropertyMap), {
  ssr: false,
  loading: () => (
    // ⚠️ Balandlik `PropertyMap` dagi xarita qutisi bilan bir xil bo'lishi kerak —
    // aks holda yuklanish tugagach sahifa sakrab qoladi.
    <div className="grid h-[520px] w-full place-items-center rounded-b-xl bg-slate-100 text-sm text-muted-foreground md:h-[620px]">
      Xarita yuklanmoqda…
    </div>
  ),
});

export function MapSection(props: PropertyMapProps) {
  return <PropertyMap {...props} />;
}
