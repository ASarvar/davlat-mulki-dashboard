"use client";

import { useEffect, useRef, useState } from "react";
import { Maximize2, Minimize2 } from "lucide-react";
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
 * `PropertyMap` dan ATAYLAB alohida: u yerda klaster, rejimlar va 520–620px quti bor;
 * bu yerda bitta pin va yon ustundagi kichik quti. Umumiy qismi — belgi (`pin.ts`),
 * ya'ni ikkala xaritada pin bir xil. To'liq ekran (2026-10-21) — `PropertyMap` dagi
 * mexanika + API ishlamaydigan joylar uchun `position: fixed` zaxirasi.
 *
 * ⚠️ G'ildirak bilan kattalashtirish ODDIY holatda O'CHIQ — xarita sahifa o'rtasida
 * turadi, aks holda sahifani aylantirayotgan foydalanuvchi xaritani kattalashtirib
 * yuborardi. To'liq ekranda sahifa aylanmaydi — u yerda YOQILADI.
 * ⚠️ Pin `interactive: false` — popup yo'q (sahifaning o'zi o'sha obyekt haqida).
 * ⚠️ `ResizeObserver` + `invalidateSize()` MAJBURIY — `dynamic({ssr:false})` bilan
 * yuklanganda Leaflet konteyner o'lchamini layout tugamasdan o'lchab olishi mumkin
 * (`PropertyMap` dagi izohga qarang).
 * ⚠️ Xarita qutisining `className` i O'ZGARMAS — Leaflet unga o'z klasslarini qo'shadi,
 * React esa o'zgargan `className` bilan ularni o'chirib yuborardi. Shuning uchun
 * o'lcham (240px ↔ to'liq ekran) TASHQI divda.
 */
export function ObjectLocationMap({ lat, lng, cat, tileUrl, tileAttribution }: ObjectLocationMapProps) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const boxRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const tileRef = useRef<L.TileLayer | null>(null);
  const fsEnteredRef = useRef(false);
  const [tileFailed, setTileFailed] = useState(false);
  /** Brauzerning haqiqiy to'liq ekrani (Fullscreen API). */
  const [nativeFull, setNativeFull] = useState(false);
  /**
   * Zaxira: API yo'q yoki so'rovni rad etdi (iPhone Safari, ichki oyna/iframe) —
   * xarita `position: fixed` bilan butun oynani egallaydi, Esc bilan yopiladi.
   */
  const [pseudoFull, setPseudoFull] = useState(false);
  const isFull = nativeFull || pseudoFull;

  useEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    const map = L.map(box, {
      center: [lat, lng],
      zoom: 16,
      scrollWheelZoom: false,
      attributionControl: true,
    });
    mapRef.current = map;
    tileRef.current = L.tileLayer(tileUrl, { attribution: tileAttribution, maxZoom: 19 })
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
      mapRef.current = null;
      tileRef.current = null;
    };
  }, [lat, lng, cat, tileUrl, tileAttribution]);

  // ⚠️ `invalidateSize()` YETARLI EMAS va kechikish SHART — `PropertyMap` dagi izoh:
  // to'liq ekran animatsiyasi tugamasdan o'lchansa plitkalar kulrang qotib qoladi.
  useEffect(() => {
    const onFsChange = () => {
      const full = document.fullscreenElement === wrapRef.current;
      if (full) fsEnteredRef.current = true;
      setNativeFull(full);
    };
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, []);

  // Zaxira rejimidan Esc bilan chiqish (haqiqiy to'liq ekranda Esc'ni brauzer o'zi ushlaydi).
  useEffect(() => {
    if (!pseudoFull) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPseudoFull(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pseudoFull]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (isFull) map.scrollWheelZoom.enable();
    else map.scrollWheelZoom.disable();
    const t = setTimeout(() => {
      mapRef.current?.invalidateSize();
      tileRef.current?.redraw();
      // Chiqqanda obyekt yana markazda bo'lsin (to'liq ekranda surilgan bo'lishi mumkin).
      if (!isFull) mapRef.current?.setView([lat, lng], mapRef.current.getZoom());
    }, 250);
    return () => clearTimeout(t);
  }, [isFull, lat, lng]);

  const toggleFullscreen = () => {
    if (document.fullscreenElement) {
      void document.exitFullscreen?.();
      return;
    }
    if (pseudoFull) {
      setPseudoFull(false);
      return;
    }
    const el = wrapRef.current;
    if (!el?.requestFullscreen) {
      setPseudoFull(true);
      return;
    }
    el.requestFullscreen().catch(() => setPseudoFull(true));
    // ⚠️ Ba'zi ichki oynalarda (webview) so'rov rad ham etilmaydi, bajarilmaydi ham —
    // promise osilib qoladi. 1 soniyada to'liq ekran bo'lmasa — zaxira rejim.
    // `fsEnteredRef` — foydalanuvchi shu soniya ichida kirib-chiqqan bo'lsa zaxira yoqilmasin.
    fsEnteredRef.current = false;
    setTimeout(() => {
      if (!fsEnteredRef.current && !document.fullscreenElement) setPseudoFull(true);
    }, 1000);
  };

  return (
    <div
      ref={wrapRef}
      className="relative"
      style={
        pseudoFull
          ? { position: "fixed", inset: 0, zIndex: 2000, background: "hsl(var(--card))" }
          : nativeFull
            ? { width: "100vw", height: "100vh", background: "hsl(var(--card))" }
            : undefined
      }
    >
      {tileFailed ? (
        <div
          className="absolute left-2 right-12 top-2 z-[500] rounded-lg border px-3 py-2 text-xs"
          style={{ background: "var(--gold-lighter)", borderColor: "var(--gold-light)", color: "#7a5f28" }}
        >
          Xarita foni yuklanmadi (tashqi manzilga ulanib bo&apos;lmadi) — belgi baribir
          ko&apos;rsatilyapti.
        </div>
      ) : null}
      <button
        type="button"
        onClick={toggleFullscreen}
        aria-label={isFull ? "To'liq ekrandan chiqish" : "To'liq ekran"}
        title={isFull ? "To'liq ekrandan chiqish (Esc)" : "To'liq ekran"}
        className="absolute right-2 top-2 z-[1001] inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-card/95 text-slate-600 shadow-sm backdrop-blur transition-colors hover:bg-muted"
      >
        {isFull ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
      </button>
      <div className={isFull ? "h-full w-full" : "h-[240px] w-full"}>
        <div ref={boxRef} className="h-full w-full rounded-lg bg-slate-100" />
      </div>
    </div>
  );
}
