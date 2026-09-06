import { CADDATA, isCadDataConfigured } from "./config";
import { httpJson, NotFoundError } from "./http";
import type { PropertyBaseData } from "./types";
import { totalBuildingArea, usefulArea, isLandOnly } from "@/lib/area";
import { pickCadastreCoords } from "@/lib/geo";

/**
 * `cad_data` — obyektning asosiy ma'lumotlari. **API 2 ning o'rnini bosadi** (2026-09-06).
 *
 * So'rov: `GET {CADDATA_BASE_URL}?tin={STIR}&cad_number={KADASTR}`, Basic auth.
 *
 * ⚠️ **STIR MAJBURIY** — API 2 da kadastr raqamining o'zi yetarli edi. Bu ikki narsani
 * anglatadi: (1) har bir chaqiruvchi obyektning tashkiloti STIRini bilishi shart;
 * (2) STIRsiz/noto'g'ri STIR bilan `400` qaytadi, ya'ni "kadastr bo'yicha kim bo'lsa
 * ham qidirish" mumkin emas. Balansdan chiqqan obyektning YANGI egasini aniqlash
 * shu sababli eski API 2 da qoldirilgan (`syncSource.ts` izohiga qarang).
 *
 * ⚠️ Javob shakli API 2 dan BUTUNLAY boshqacha (ichma-ich `data.object`/`land`/`address`).
 * `lib/area.ts` ikkala shaklni ham tushunadi — to'liq qayta sinxronizatsiyadan keyin
 * ham 404/400 bergan obyektlarning `rawApi2` si eski holicha qoladi.
 *
 * Jonli o'lchov (2026-09-06, 200 obyekt): muvaffaqiyat 98%, `geometry` 95%,
 * maydon/tuman/eski kadastr mosligi 100%, median 980 ms.
 */

/** Javobning bizga kerakli qismi. To'lig'i `rawApi2` ga saqlanadi. */
export interface CadDataResponse {
  code: number;
  status?: string;
  data?: CadDataPayload;
  error?: { code?: number; name?: string; message?: string };
  [k: string]: unknown;
}

export interface CadDataPayload {
  /** Ichki muvaffaqiyat kodi — `1` = topildi (tashqi HTTP kodidan ALOHIDA). */
  code: number;
  cad_number?: string | null;
  /** ⚠️ API 2 da `cad_number_old` deb atalardi. */
  old_cad_number?: string | null;
  name?: string | null;
  address?: {
    region?: { code?: string; name?: string; soato?: string } | null;
    /** ⚠️ `soato` — aynan API 2 dagi `district_id` (117 obyektda 100% mos). */
    district?: { code?: string; name?: string; soato?: string } | null;
    mahalla?: { name?: string } | null;
    street?: { name?: string } | null;
    house_number?: string | null;
  } | null;
  land?: Record<string, unknown> | null;
  object?: Record<string, unknown> | null;
  /** Balansdagi tashkilot(lar) — API 2 dagi `subjects` ning o'rnida. */
  hosts?: { tin?: string | null; fname?: string | null; name?: string | null }[] | null;
  /** Cheklovlar (hibs/xatlov) — API 2 da UMUMAN yo'q edi. */
  bans?: Record<string, unknown>[] | null;
  /** Kadastr poligoni (EPSG:3857) — koordinata shundan olinadi. */
  geometry?: Record<string, unknown> | null;
  [k: string]: unknown;
}

export type CadDataResult = { ok: true; data: PropertyBaseData } | { ok: false; reason: string };

/** Ichki javob kodi: 1 = topildi. */
const FOUND = 1;

/**
 * Jonli sinovda aniqlangan xato kodlari (`error.code`). Har biri BOSHQA narsani
 * bildiradi va ularni aralashtirib yuborish xato xulosaga olib kelardi.
 *
 * ⚠️ **2108 — eng muhimi**: obyekt endi shu tashkilotga tegishli EMAS. Ya'ni
 * bu "xato" emas, balki BALANSDAN CHIQQANLIK signali. Lekin bu yerda avtomatik
 * `removedFromBalance` qilinmaydi — u qaror API 1 ning kadastr ro'yxati bo'yicha
 * qabul qilinadi (`syncSource.ts` → reconcile). Ikkinchi, mustaqil manbadan
 * avtomatik belgilash yolg'on ijobiy natija berishi mumkin edi.
 */
const ERROR_LABEL: Record<number, string> = {
  2030: "STIR noto'g'ri formatda",
  2032: "kadastr topilmadi",
  2108: "obyekt bu tashkilotga tegishli emas (balansdan chiqqan bo'lishi mumkin)",
};

function str(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s.length > 0 ? s : null;
}

function num(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * Manzil satri — API 2 tayyor `address` matni berardi, bu yerda bo'laklardan quriladi.
 * Bo'sh bo'laklar tushiriladi (ko'chasi yo'q obyektlar bor).
 */
function buildAddress(a: CadDataPayload["address"]): string | null {
  if (!a) return null;
  const parts = [
    a.region?.name,
    a.district?.name,
    a.mahalla?.name,
    a.street?.name,
    a.house_number ? `${a.house_number}-uy` : null,
  ]
    .map((p) => str(p))
    .filter(Boolean);
  return parts.length ? parts.join(", ") : null;
}

export async function fetchCadData(cadNumber: string, tin: string): Promise<CadDataResult> {
  if (!isCadDataConfigured()) throw new Error("CADDATA_* sozlanmagan");
  if (!str(tin)) return { ok: false, reason: "cad_data: STIR berilmagan (majburiy parametr)" };

  let res: CadDataResponse;
  try {
    res = await httpJson<CadDataResponse>({
      baseUrl: CADDATA.baseUrl!,
      query: { tin, cad_number: cadNumber },
      basicAuth: { user: CADDATA.username!, password: CADDATA.password! },
      rateKey: "CADDATA",
    });
  } catch (err) {
    if (err instanceof NotFoundError) return { ok: false, reason: "cad_data: obyekt topilmadi (404)" };
    throw err; // tarmoq/5xx — job xato bo'lib qayta urinadi
  }

  const d = res.data;
  if (!d || d.code !== FOUND) {
    // ⚠️ Xato IKKI joyda bo'lishi mumkin: tashqi o'ramda (`res.error`) yoki ichki
    // `data.code` da. Sababni to'liq saqlaymiz — `SyncRun.failureSummary` da
    // "qaysi API nima sababdan yiqildi" jadvali shundan quriladi.
    const code = res.error?.code;
    const known = code != null ? ERROR_LABEL[code] : undefined;
    const outer = res.error
      ? `[${code ?? res.code}] ${known ?? res.error.message ?? res.error.name}`
      : null;
    const inner = d ? `data.code=${d.code}` : null;
    return { ok: false, reason: `cad_data: ${outer ?? inner ?? "noma'lum javob"}` };
  }

  const holder = d.hosts?.[0];

  return {
    ok: true,
    data: {
      cadNumber: str(d.cad_number) ?? cadNumber,
      cadNumberOld: str(d.old_cad_number),
      name: str(d.name),
      address: buildAddress(d.address),
      // ⚠️ Maydonlar `lib/area.ts` orqali — u yangi ichma-ich shaklni o'zi taniydi.
      // Xom javobni to'g'ridan-to'g'ri o'qimang: "0 = qiymat yo'q" qoidasi va
      // umumiy maydon zanjiri faqat o'sha yerda.
      area: totalBuildingArea(d as unknown as Record<string, unknown>),
      buildingArea: usefulArea(d as unknown as Record<string, unknown>),
      isLand: isLandOnly(d as unknown as Record<string, unknown>),
      region: str(d.address?.region?.name),
      district: str(d.address?.district?.name),
      // ⚠️ `district.code` ("10:04") EMAS, `soato` ("1726290") — aynan shu son
      // API 2 ning `district_id` si bilan bir xil, ya'ni `District` jadvali buzilmaydi.
      districtCode: num(d.address?.district?.soato),
      holderName: str(holder?.fname) ?? str(holder?.name),
      holderInn: str(holder?.tin),
      // Kadastr poligonining markazi — auksion nuqtasidan ustun (qamrov 95% ↔ 28%).
      coords: pickCadastreCoords(d),
      raw: d,
    },
  };
}
