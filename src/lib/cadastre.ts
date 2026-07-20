// Kadastr raqamlari `10:11:01:01:01:5030/03` ko'rinishida — ichida "/" BO'LISHI MUMKIN.
// Shu sababli obyekt sahifasi catch-all route: /dashboard/objects/[...cad]
// "/" ni %2F qilib bitta segmentga tiqish ishonchsiz (proxy/server normalizatsiya qiladi),
// shuning uchun uni tabiiy ravishda yo'l segmentlariga bo'lamiz.

function safeDecode(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment; // buzilgan % ketma-ketligi bo'lsa — o'zini qaytaramiz
  }
}

// ":" yo'l segmentida qonuniy (RFC 3986) — uni encode qilmaymiz, URL o'qishli qoladi.
export function cadToPath(cadNumber: string): string {
  return cadNumber
    .split("/")
    .map((seg) => encodeURIComponent(seg).replace(/%3A/gi, ":"))
    .join("/");
}

export function pathToCad(segments: string[]): string {
  // Next.js params qiymatlarini o'zi decode qiladi. Qo'shimcha decode kadastr uchun
  // xavfsiz (ichida "%" uchramaydi) va noto'g'ri kirishdan himoyalaydi.
  return segments.map(safeDecode).join("/");
}

// Obyekt sahifasi manzili (link va revalidatePath uchun yagona manba).
export function objectHref(cadNumber: string): string {
  return `/dashboard/objects/${cadToPath(cadNumber)}`;
}
