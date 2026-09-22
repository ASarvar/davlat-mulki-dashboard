import L from "leaflet";
import { categoryColor } from "@/lib/chartColors";
import { CATEGORY_BY_CODE } from "@/lib/categories";

/**
 * Joylashuv belgisi (pin) — panel xaritasi (`PropertyMap`) va obyekt sahifasidagi
 * kichik xarita (`ObjectLocationMap`) uchun UMUMIY: ikkalasida belgi bir xil bo'lsin.
 *
 * Shakl va o'lcham davijara.uz xaritasidagi bilan bir xil (26×34, UCHI aynan
 * koordinatada: `iconAnchor` pastki markaz). Rang — kategoriya rangi (panel
 * kartalari bilan bir xil); chegara va markaz OQ, chunki oltin kategoriyalarda
 * (11/12) oltin chegara ko'rinmay qolardi.
 *
 * ⚠️ Rasm fayl EMAS, ichki SVG — `marker-icon.png` `/obyektlar` ostida 404 berardi.
 * ⚠️ `className` beriladi — busiz Leaflet `leaflet-div-icon` (oq fon + ramka) qo'shadi.
 * ⚠️ Faqat client'da import qiling (Leaflet `window`ga tayanadi) — ikkala xarita ham
 * `MapSection.tsx` orqali `dynamic({ ssr: false })` bilan yuklanadi.
 * Belgilar kategoriya bo'yicha KESHLANADI: minglab nuqta — o'nga yaqin `DivIcon`.
 * Hover/soya uslubi `globals.css` → `.dm-pin`.
 */
const pinCache = new Map<number, L.DivIcon>();
export function pinIcon(cat: number): L.DivIcon {
  let icon = pinCache.get(cat);
  if (!icon) {
    // Leaflet (`keyboard: true`, standart) markerni `role=button` + `tabindex=0` qiladi —
    // tugma nomi shu `aria-label`dan olinadi, aks holda ekran o'quvchi faqat "button" derdi.
    const label = escapeHtml(CATEGORY_BY_CODE.get(cat)?.nameUz ?? "Obyekt");
    icon = L.divIcon({
      className: "dm-pin",
      html: `<svg viewBox="-1 -1 26 34" width="26" height="34" role="img" aria-label="${label}"><path d="M12 0C5.4 0 0 5.4 0 12c0 9 12 20 12 20s12-11 12-20c0-6.6-5.4-12-12-12z" fill="${categoryColor(cat)}" stroke="#fff" stroke-width="1.5"/><circle cx="12" cy="12" r="4.5" fill="#fff"/></svg>`,
      iconSize: [26, 34],
      iconAnchor: [13, 34],
      popupAnchor: [0, -34],
    });
    pinCache.set(cat, icon);
  }
  return icon;
}

/** Popup / `aria-label` HTML'iga ma'lumot qo'yishdan oldin — ma'lumot bazadan keladi. */
export function escapeHtml(v: string): string {
  return v.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string,
  );
}
