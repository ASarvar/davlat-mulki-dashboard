"use client";

import { useEffect, useRef, useState } from "react";
import { Maximize2, Minimize2 } from "lucide-react";
import L from "leaflet";
// ⚠️ Leaflet CSS'i bu yerda EMAS — `app/globals.css` da (sababi o'sha faylda yozilgan:
// lazy chunk bilan kelgan CSS xaritadan kechikib, uni buzib qo'yardi).
import "leaflet.markercluster";
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
 *
 * ⚠️ **G'ildirak bilan kattalashtirish faqat Ctrl bosilganda** (2026-09-06).
 * Xarita sahifaning yarmini egallagani uchun oddiy scroll uni kattalashtirsa,
 * foydalanuvchi sahifani pastga aylantira olmay qolardi. Ctrl'siz g'ildirakda
 * ko'rsatma chiqadi. `preventDefault()` SHART: Ctrl+g'ildirak — brauzerning
 * o'z sahifa-zoom'i, u to'xtatilmasa butun sahifa kattalashib ketardi.
 * Shu sabab listener `{ passive: false }` bilan qo'shiladi.
 *
 * ⚠️ To'liq ekranda `invalidateSize()` MAJBURIY — Leaflet konteyner o'lchamini
 * keshlaydi, usiz tile'lar eski o'lchamda qolib, xarita yarmi kulrang chiqadi.
 */
export function PropertyMap({
  points,
  bubbles,
  mode,
  tileUrl,
  tileAttribution,
  basePath,
}: PropertyMapProps) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const boxRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.Layer | null>(null);
  /** Fon qatlami — to'liq ekranga o'tishda uni MAJBURAN qayta chizish kerak (pastga qarang). */
  const tileRef = useRef<L.TileLayer | null>(null);
  const [tileFailed, setTileFailed] = useState(false);
  const [isFull, setIsFull] = useState(false);
  const [showHint, setShowHint] = useState(false);

  // Xaritani bir marta yaratamiz + g'ildirak boshqaruvini shu yerda ulaymiz
  // (bitta effekt — listener hech qachon eski `map` ga qarab qolmaydi).
  useEffect(() => {
    const box = boxRef.current;
    if (!box || mapRef.current) return;
    const map = L.map(box, {
      center: [UZ_CENTER.lat, UZ_CENTER.lng],
      zoom: UZ_ZOOM,
      scrollWheelZoom: false, // faqat Ctrl bosilganda yoqiladi — pastga qarang
      attributionControl: true,
    });
    const tiles = L.tileLayer(tileUrl, { attribution: tileAttribution, maxZoom: 19 })
      .on("tileerror", () => setTileFailed(true))
      .addTo(map);
    mapRef.current = map;
    tileRef.current = tiles;

    let hintTimer: ReturnType<typeof setTimeout> | undefined;
    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault(); // brauzerning sahifa-zoom'i ishga tushmasin
        if (!map.scrollWheelZoom.enabled()) map.scrollWheelZoom.enable();
        clearTimeout(hintTimer);
        setShowHint(false);
      } else {
        if (map.scrollWheelZoom.enabled()) map.scrollWheelZoom.disable();
        setShowHint(true);
        clearTimeout(hintTimer);
        hintTimer = setTimeout(() => setShowHint(false), 1600);
      }
    };
    box.addEventListener("wheel", onWheel, { passive: false });

    // ⚠️ **O'LCHAMNI KUZATISH — MAJBURIY.** Leaflet konteyner o'lchamini FAQAT
    // yaratilganda o'lchaydi va keshlaydi. Komponent `dynamic({ssr:false})` bilan
    // yuklangani uchun `L.map()` ba'zan layout tugagunicha ishga tushadi va nolga
    // yaqin o'lchamni o'lchab oladi — natijada xarita faqat o'sha kichik maydon
    // uchun plitka so'raydi: ekranda bitta plitka, atrofi bo'sh (2026-09-06 da
    // aynan shu bo'ldi). `ResizeObserver` konteyner o'lchami har o'zgarganda
    // qayta o'lchatadi — bu dastlabki poygani ham, to'liq ekranga o'tishni ham,
    // yon panel/oyna o'zgarishini ham bir yo'la yopadi.
    let raf = 0;
    const remeasure = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => mapRef.current?.invalidateSize());
    };
    remeasure(); // birinchi kadrdan keyin — dastlabki poyga uchun
    const ro = new ResizeObserver(remeasure);
    ro.observe(box);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      clearTimeout(hintTimer);
      box.removeEventListener("wheel", onWheel);
      map.remove();
      mapRef.current = null;
      tileRef.current = null;
    };
  }, [tileUrl, tileAttribution]);

  // To'liq ekran holati.
  //
  // ⚠️ `invalidateSize()` YETARLI EMAS. To'liq ekranga o'tganda o'lcham
  // keskin o'zgaradi va `GridLayer` yangi plitkalarni yaratadi, lekin ular
  // `leaflet-tile-loaded` klassini olmay `visibility:hidden` da qotib qolishi
  // mumkin — natijada vektor qatlamlar (klasterlar, doiralar) chiziladi-yu,
  // FON OQ qoladi va hech qanday xato ham chiqmaydi (2026-09-06 da aynan shu
  // bo'ldi). `redraw()` qatlamni butunlay qayta quradi va buni yopadi.
  //
  // ⚠️ Kechikish ham SHART: brauzer to'liq ekranga o'tishni animatsiya bilan
  // bajaradi, ya'ni `fullscreenchange` paytida element hali yakuniy o'lchamiga
  // yetmagan bo'ladi — bitta kadr yetmaydi.
  useEffect(() => {
    let t: ReturnType<typeof setTimeout>;
    const onFsChange = () => {
      setIsFull(document.fullscreenElement === wrapRef.current);
      clearTimeout(t);
      t = setTimeout(() => {
        mapRef.current?.invalidateSize();
        tileRef.current?.redraw();
      }, 250);
    };
    document.addEventListener("fullscreenchange", onFsChange);
    return () => {
      clearTimeout(t);
      document.removeEventListener("fullscreenchange", onFsChange);
    };
  }, []);

  const toggleFullscreen = () => {
    if (document.fullscreenElement) void document.exitFullscreen?.();
    else void wrapRef.current?.requestFullscreen?.();
  };

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
    // ⚠️ To'liq ekranda o'lcham FOIZ emas, `vw`/`vh` bilan beriladi. `h-full`
    // (height:100%) ota elementning aniq balandligini talab qiladi; to'liq ekran
    // elementining balandligini brauzer o'z UA uslubi bilan beradi va bu zanjir
    // ba'zan uzilib, quti nol balandlikda qolardi. Viewport birligi har doim aniq.
    <div
      ref={wrapRef}
      className="relative"
      style={isFull ? { width: "100vw", height: "100vh", background: "hsl(var(--card))" } : undefined}
    >
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

      {/* To'liq ekran tugmasi — Leaflet'ning zoom boshqaruvi chap-yuqorida, bu o'ng-yuqorida.
          z-index Leaflet control konteyneridan (1000) yuqori bo'lishi shart. */}
      <button
        type="button"
        onClick={toggleFullscreen}
        aria-label={isFull ? "To'liq ekrandan chiqish" : "To'liq ekran"}
        title={isFull ? "To'liq ekrandan chiqish (Esc)" : "To'liq ekran"}
        className="absolute right-3 top-3 z-[1001] inline-flex items-center gap-1.5 rounded-lg border border-border bg-card/95 px-2.5 py-1.5 text-[12px] font-medium text-slate-600 shadow-sm backdrop-blur transition-colors hover:bg-muted"
      >
        {isFull ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
        {isFull}
      </button>

      {/* Ctrl'siz g'ildirakda qisqa ko'rsatma — xarita nega kattalashmaganini tushuntiradi. */}
      <div
        aria-hidden
        className={`pointer-events-none absolute inset-0 z-[1000] grid place-items-center transition-opacity duration-200 ${
          showHint ? "opacity-100" : "opacity-0"
        }`}
      >
        <span className="rounded-lg bg-slate-900/75 px-4 py-2 text-[13px] font-medium text-white shadow-lg">
          Kattalashtirish uchun <kbd className="font-semibold">Ctrl</kbd> +
        </span>
      </div>

      {/* O'LCHAM shu tashqi divda — uni React boshqaradi. */}
      <div
        className={isFull ? "h-full w-full" : "h-[520px] w-full rounded-b-xl md:h-[620px]"}
      >
        {/*
          ⚠️ ⚠️ BU DIVNING `className` I O'ZGARMAS BO'LISHI SHART.
          Leaflet `L.map()` chaqirilganda shu elementga O'Z klasslarini qo'shadi
          (`leaflet-container`, `leaflet-touch`, `leaflet-fade-anim`…). React esa
          `className` propi o'zgarganda `class` atributini BUTUNLAY ustidan yozadi
          va Leaflet qo'shganlari o'chib ketadi. Natijada `.leaflet-container`
          yo'qoladi → `position:relative`/`overflow:hidden` yo'qoladi → plitkalar
          joylashuv kontekstini yo'qotib, fon oq bo'lib qoladi; klasterlar esa
          React tegmaydigan bola elementlar bo'lgani uchun chizilaveradi.
          (2026-09-06 da aynan shu bo'ldi: konsolda `.leaflet-container` === null.)
          Shu sabab o'lcham TASHQI divda, bu yerda esa doimiy klass.
        */}
        <div ref={boxRef} className="h-full w-full bg-slate-100" />
      </div>
    </div>
  );
}

/** Popup HTML'iga kadastr/nom qo'yishdan oldin — ma'lumot bazadan keladi. */
function escapeHtml(v: string): string {
  return v.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string,
  );
}
