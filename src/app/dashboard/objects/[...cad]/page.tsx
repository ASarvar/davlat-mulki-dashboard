import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  RefreshCw,
  Info,
  ListChecks,
  FileText,
  Tag,
  History,
  ExternalLink,
  Gavel,
  KeyRound,
  Droplets,
  Flame,
  Zap,
  AlertTriangle,
  type LucideIcon,
} from "lucide-react";
import { lotUrl } from "@/server/integrations/auction";
import {
  parseUtilityRaw,
  UTILITY_LABEL,
  type UtilityInfo,
  type UtilityKind,
} from "@/server/integrations/utilities";
import { requireUser, isAdmin } from "@/lib/authz";
import { getPropertyDetail } from "@/server/services/properties";
import { pathToCad } from "@/lib/cadastre";
import { totalBuildingAreaWithSource, totalAreaLabel, usefulArea } from "@/lib/area";
import { CATEGORY_BY_CODE } from "@/lib/categories";
import { CategoryBadge, InefficientBadge, RemovedFromBalanceBadge, SyncStatusBadge } from "@/components/badges";
import { AssignCategoryForm } from "./AssignCategoryForm";
import { RemoveCategoryButton } from "./RemoveCategoryButton";
import { CadastreRawData } from "./CadastreRawData";
import { syncSingleAction } from "../actions";

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-sm">{value ?? "—"}</dd>
    </div>
  );
}

/**
 * Bitta kommunal xizmat kartasi. Ko'rsatiladigan maydonlar xizmatga qarab farq qiladi —
 * chunki uchala API uch xil narsani beradi (`integrations/utilities.ts` izohiga qarang):
 * suv → balans, gaz → hisob-kitob va sarf, elektr → faqat abonent kodlari.
 */
const UTILITY_ICON: Record<UtilityKind, { icon: LucideIcon; tone: string }> = {
  WATER: { icon: Droplets, tone: "text-sky-600" },
  GAS: { icon: Flame, tone: "text-orange-600" },
  ELECTRIC: { icon: Zap, tone: "text-amber-600" },
};

function UtilityCard({
  kind,
  info,
  matchedByOldCad,
}: {
  kind: UtilityKind;
  info: UtilityInfo | null;
  matchedByOldCad: boolean;
}) {
  const { icon: Icon, tone } = UTILITY_ICON[kind];
  const money = (n: number | null) => (n == null ? "—" : `${n.toLocaleString("uz-UZ")} so'm`);

  const rows: { label: string; value: React.ReactNode }[] = [];
  if (info?.found) {
    if (kind === "WATER") {
      rows.push({ label: "Abonent", value: info.subscriberName ?? "—" });
      rows.push({ label: "Abonent kodi", value: info.subscriberCode ?? "—" });
      rows.push({ label: "Balans", value: money(info.balance) });
      if (info.balanceStatus) rows.push({ label: "Holati", value: info.balanceStatus });
    } else if (kind === "GAS") {
      rows.push({ label: "Abonent", value: info.subscriberName ?? "—" });
      rows.push({ label: "Abonent kodi", value: info.subscriberCode ?? "—" });
      if (info.address) rows.push({ label: "Manzil", value: info.address });
      rows.push({ label: "Joriy balans", value: money(info.balance) });
      rows.push({
        label: "Oxirgi to'lov",
        value: info.lastPaymentDate ? `${info.lastPaymentDate} — ${money(info.lastPaymentSum)}` : "—",
      });
      rows.push({
        label: "12 oylik sarf",
        // ⚠️ 0 — "sarf yo'q" degani emas: hisoblagichi yo'q abonentda gaz norma bo'yicha
        // hisoblanadi va `gas_consume` doim 0 keladi.
        value:
          info.consumedTotal && info.consumedTotal > 0 ? (
            `${info.consumedTotal.toLocaleString("uz-UZ")} m³`
          ) : (
            <span className="text-muted-foreground">0 m³ (hisoblagich yo&apos;q bo&apos;lishi mumkin)</span>
          ),
      });
      rows.push({
        label: "Hisob holati",
        value: info.billed ? "Faol — to'lov hisoblanmoqda" : "Harakat yo'q",
      });
    } else {
      rows.push({ label: "Abonent kodlari", value: info.codes.join(", ") || "—" });
      rows.push({ label: "Kodlar soni", value: String(info.codes.length) });
    }
  }

  return (
    <div className="rounded-lg border border-border p-4">
      <div className="mb-2 flex items-center gap-2">
        <Icon className={`h-4 w-4 ${tone}`} />
        <span className="text-sm font-semibold" style={{ color: "var(--navy)" }}>
          {UTILITY_LABEL[kind]}
        </span>
        {info?.found ? (
          <span className="ml-auto rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
            Abonent bor
          </span>
        ) : (
          <span className="ml-auto rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">
            Topilmadi
          </span>
        )}
      </div>
      {matchedByOldCad ? (
        <p className="mb-2 text-[11px] text-amber-700">Eski kadastr raqami orqali topilgan</p>
      ) : null}
      {rows.length > 0 ? (
        <dl className="space-y-1 text-xs">
          {rows.map((r) => (
            <div key={r.label} className="flex gap-2">
              <dt className="shrink-0 text-muted-foreground">{r.label}:</dt>
              <dd className="break-words font-medium text-slate-800">{r.value}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="text-xs text-muted-foreground">Bu kadastr bo&apos;yicha abonent topilmadi.</p>
      )}
    </div>
  );
}

function SectionTitle({ icon: Icon, children }: { icon: LucideIcon; children: React.ReactNode }) {
  return (
    <h2 className="flex items-center gap-2 text-sm font-semibold" style={{ color: "var(--navy)" }}>
      <Icon className="h-4 w-4" style={{ color: "var(--gold)" }} />
      {children}
    </h2>
  );
}

// catch-all: kadastr ichidagi "/" yo'l segmentlariga bo'linadi (masalan .../5030/03).
export default async function ObjectDetailPage({ params }: { params: Promise<{ cad: string[] }> }) {
  const { cad } = await params;
  const cadNumber = pathToCad(cad);
  const user = await requireUser();

  const p = await getPropertyDetail(user, cadNumber);
  if (!p) notFound();

  // Kim yangilash tugmasini ko'radi (API orqali sync) — admin.
  const canSync = user.role === "SUPER_ADMIN" || user.role === "ADMIN";

  // Kategoriya biriktirish/so'rov: faqat "Bo'sh turgan" (11) obyekt uchun.
  // Ikkalasi ham null bo'lsa ham "Bo'sh turgan" (DB'da 11 alohida saqlanmaydi).
  const effectiveCode = p.integrationCategoryCode ?? p.manualCategoryCode ?? 11;
  const isVacant = effectiveCode === 11;
  // Ijrochi faqat o'z tashkilotining obyektiga so'rov yubora oladi.
  const inSource = user.sourceId != null && user.sourceId === p.sourceId;
  // IJROCHI → so'rov; ADMIN/SUPER_ADMIN → darhol. MODERATOR'da to'g'ridan-to'g'ri
  // biriktirish huquqi yo'q — u faqat /dashboard/requests'da so'rovlarni ko'rib chiqadi.
  // ⚠️ Balansdan chiqarilgan obyektga kategoriya biriktirilmaydi: u endi tashkilot
  // balansida emas, ya'ni "Yaroqsiz/Chekka" deb belgilashning ma'nosi yo'q.
  const canAssign =
    isVacant && !p.removedFromBalance && (isAdmin(user.role) || (user.role === "IJROCHI" && inSource));
  const isRequest = user.role === "IJROCHI";
  const pendingRequest = p.changeRequests.find(
    (r) => r.status === "PENDING_MODERATOR" || r.status === "PENDING_RAHBARIYAT",
  );

  // Yaroqsiz/Chekka belgisini olib tashlash: ADMIN/SUPER_ADMIN va RAHBARIYAT
  // (MODERATOR/IJROCHI'da bekor qilish huquqi yo'q). Olib tashlangach obyekt
  // yana "Bo'sh turgan"ga qaytadi (integratsiya kategoriyasi 9/10 bo'la olmaydi,
  // shuning uchun effectiveCode===9/10 har doim manualCategoryCode'dan kelgan bo'ladi).
  const canRemoveCategory =
    (effectiveCode === 9 || effectiveCode === 10) && (isAdmin(user.role) || user.role === "RAHBARIYAT");

  // "Binoning umumiy maydoni" / "Foydali maydon" — API 2 xom javobidan, `lib/area.ts`
  // dagi AYNAN o'sha mantiq bilan (parser ham shuni ishlatadi, ya'ni ro'yxat va bu
  // sahifa hech qachon farqli son ko'rsatmaydi).
  // DB ustuni (Property.area/buildingArea) faqat zaxira: u `land_area` tuzatishi bilan
  // almashtirilgan bo'lishi mumkin (CLAUDE.md — "Maydon tuzatish"), shuning uchun avval
  // xom javob o'qiladi.
  const rawApi2 = (p.rawApi2 as Record<string, unknown> | null) ?? null;
  const totalArea = totalBuildingAreaWithSource(rawApi2);
  const objectAreaP = totalArea?.value ?? (p.area ? Number(p.area) : null);
  const objectAreaU = usefulArea(rawApi2) ?? (p.buildingArea ? Number(p.buildingArea) : null);
  // Qiymat yer uchastkasi maydonidan (land_area/land_area_i) olingan bo'lsa obyekt aslida
  // bino emas — yorliq "Binoning umumiy maydoni" emas, "Umumiy maydoni" bo'ladi.
  const totalAreaFieldLabel = totalAreaLabel(totalArea?.source);

  // "DM ID" — API 3 dagi `id` (e-auksion tizimidagi obyekt identifikatori). Alohida
  // ustun sifatida saqlanmaydi — API3/4 natijasi "AUCTION" apiSource ostida
  // ObjectStatusCheck.rawResponse'da { api3: {...}, api4: {...} } shaklida saqlanadi
  // (checkAuction() -> auction.ts), shu yerdan o'qiladi (CadastreRawData bilan bir xil
  // yondashuv — bor xom javobdan, API'ni qayta chaqirmasdan).
  const auctionRaw = p.statusChecks.find((s) => s.apiSource === "AUCTION")?.rawResponse as
    | { api3?: { id?: number | string | null } }
    | null
    | undefined;
  const dmId = auctionRaw?.api3?.id ?? null;

  // ── Kommunal xizmatlar ──
  // Saqlangan xom javoblardan qayta o'qiladi (`parseUtilityRaw` — ro'yxat bilan BIR XIL
  // parser, ya'ni sahifada va ro'yxatda ko'rsatilgan qiymatlar hech qachon ajralmaydi).
  const utilityChecks = (["WATER", "GAS", "ELECTRIC"] as UtilityKind[]).map((kind) => {
    const check = p.statusChecks.find((s) => s.apiSource === kind);
    return {
      kind,
      checked: Boolean(check),
      matchedByOldCad: check?.matchedByOldCad ?? false,
      info: check ? parseUtilityRaw(kind, check.rawResponse) : null,
    };
  });
  const anyUtilityFound = utilityChecks.some((u) => u.info?.found);
  const utilityChecked = utilityChecks.some((u) => u.checked);
  // `isVacant` — yuqorida hisoblangan effektiv kategoriya 11 (dashboard bilan bir xil mezon).
  const vacantButUsed = isVacant && anyUtilityFound;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link
            href="/dashboard/objects"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground transition hover:text-slate-700"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Obyektlar
          </Link>
          <h1 className="mt-1 text-xl font-bold tracking-tight" style={{ color: "var(--navy)" }}>
            {p.cadNumber}
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <SyncStatusBadge status={p.syncStatus} />
          {p.removedFromBalance ? <RemovedFromBalanceBadge /> : <InefficientBadge value={p.isInefficient} />}
          {canSync ? (
            <form action={syncSingleAction}>
              <input type="hidden" name="cadNumber" value={p.cadNumber} />
              <button
                className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:opacity-90"
                style={{ background: "var(--cobalt)" }}
              >
                <RefreshCw className="h-4 w-4" />
                API orqali yangilash
              </button>
            </form>
          ) : null}
        </div>
      </div>

      {/* Balansdan chiqarilgan — API 1 ro'yxatidan tushib qolgan (odatda boshqa STIRga
          o'tkazilgan). Bu sahifani faqat admin ocha oladi (`getPropertyDetail`). */}
      {p.removedFromBalance ? (
        <div className="mb-4 rounded-xl border border-slate-300 bg-slate-50 p-4 text-sm">
          <p className="font-semibold" style={{ color: "var(--navy)" }}>
            Bu obyekt tashkilot balansidan chiqarilgan
          </p>
          <p className="mt-1 text-muted-foreground">
            So&apos;nggi sinxronizatsiyada API 1 ({p.source.name} — STIR {p.source.stir}) kadastr
            ro&apos;yxatida bu obyekt yo&apos;q edi. Ma&apos;lumot tarix uchun saqlanmoqda, lekin
            hisobot jadvallariga kirmaydi.
          </p>
          <dl className="mt-3 grid grid-cols-2 gap-4 md:grid-cols-3">
            <Field
              label="Chiqarilgan sana"
              value={p.removedAt ? p.removedAt.toLocaleString("uz") : null}
            />
            <Field label="Yangi egasi (STIR)" value={p.removedToStir} />
            <Field label="Yangi egasi" value={p.removedToName} />
          </dl>
          {!p.removedToStir ? (
            <p className="mt-2 text-xs text-muted-foreground">
              Yangi egasi hali aniqlanmadi — keyingi sinxronizatsiyada API 2 orqali qayta uriniladi.
            </p>
          ) : null}
        </div>
      ) : null}

      {/* ⚠️ "Bo'sh turgan" deb belgilangan, lekin kommunal abonenti bor obyekt —
          tekshirishga arziydigan ziddiyat. Ogohlantirish ATAYIN yumshoq tilda:
          abonent nomi ijarachi yoki qo'shni bo'lishi ham mumkin, ya'ni bu dalil emas,
          faqat tekshirish uchun signal. */}
      {vacantButUsed ? (
        <div className="mb-6 flex gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
          <div>
            <p className="font-semibold text-amber-900">
              Bo&apos;sh turgan obyektda kommunal abonent topildi
            </p>
            <p className="mt-1 text-amber-800">
              Obyekt &quot;Bo&apos;sh turgan&quot; kategoriyasida, lekin{" "}
              <strong>
                {utilityChecks
                  .filter((u) => u.info?.found)
                  .map((u) => UTILITY_LABEL[u.kind].toLowerCase())
                  .join(", ")}
              </strong>{" "}
              bo&apos;yicha abonent hisobi mavjud. Pastdagi &quot;Kommunal xizmatlar&quot;
              bo&apos;limiga qarang — obyekt aslida foydalanilayotgan bo&apos;lishi mumkin.
            </p>
          </div>
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Asosiy ma'lumot */}
        <section className="space-y-4 lg:col-span-2">
          <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <div className="mb-4">
              <SectionTitle icon={Info}>Asosiy ma'lumotlar</SectionTitle>
            </div>
            <dl className="grid grid-cols-2 gap-4 md:grid-cols-3">
              <Field label="Yangi kadastr" value={p.cadNumber} />
              <Field label="Eski kadastr" value={p.cadNumberOld} />
              <Field label="Hudud" value={p.region.name} />
              <Field label="Tuman" value={p.district?.name ?? null} />
              <Field label="Manba" value={p.source.name} />
              <Field label="DM ID" value={dmId} />
              <Field label="Nomi" value={p.name} />
              <Field label="Manzil" value={p.address} />
              <Field label={totalAreaFieldLabel} value={objectAreaP != null ? `${objectAreaP.toLocaleString("uz")} m²` : null} />
              <Field label="Foydali maydon" value={objectAreaU != null ? `${objectAreaU.toLocaleString("uz")} m²` : null} />
              <Field label="Kategoriya" value={<CategoryBadge integrationCode={p.integrationCategoryCode} manualCode={p.manualCategoryCode} />} />
            </dl>
            {/* Xom texnik xato matni (masalan "fetch failed") — faqat admin ko'radi.
                Boshqa rollar buni tuzata olmaydi va matn ular uchun tushunarsiz/
                bezovta qiluvchi bo'lishi mumkin (foydalanuvchi talabi, 2026-08-06). */}
            {p.lastSyncError && canSync ? (
              <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">Sync xatosi: {p.lastSyncError}</p>
            ) : null}
            <CadastreRawData rawApi2={p.rawApi2} />
          </div>

          {/* ── Kommunal xizmatlar ──
              Asosiy ma'lumotlardan DARHOL keyin turadi (foydalanuvchi talabi, 2026-08-17):
              obyekt bo'sh deb belgilangan bo'lsa ham suv/gaz/elektr abonenti borligi
              uni qayta ko'rib chiqishga asos bo'ladi. */}
          {utilityChecked ? (
            <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
              <div className="mb-4">
                <SectionTitle icon={Droplets}>Kommunal xizmatlar</SectionTitle>
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                {utilityChecks.map((u) => (
                  <UtilityCard key={u.kind} kind={u.kind} info={u.info} matchedByOldCad={u.matchedByOldCad} />
                ))}
              </div>
              <p className="mt-3 text-xs text-muted-foreground">
                ⚠️ Abonent topilmasligi obyekt bo&apos;sh degani EMAS — tashqi API abonentning
                yo&apos;qligi va obyektning qamrovga kirmasligini farqlamaydi. Abonent nomi
                ko&apos;pincha jismoniy shaxs yoki ijarachi bo&apos;lib chiqadi.
              </p>
            </div>
          ) : null}

          {/* Auksion lotlari — obyekt bir vaqtda ham xususiylashtirish, ham ijara
              savdosida bo'lishi va har biri bir nechta lotga bo'linishi mumkin. */}
          {p.auctionLots.length > 0 || p.auctionStatus ? (
            <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
              <div className="mb-4 flex flex-wrap items-center gap-3">
                <SectionTitle icon={Gavel}>Auksion lotlari ({p.auctionLots.length})</SectionTitle>
                {p.hasPrivatizationLot ? (
                  <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
                    Savdoda xususiylashtirish
                  </span>
                ) : null}
                {p.hasRentLot ? (
                  <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                    Savdoda ijara
                  </span>
                ) : null}
              </div>

              <dl className="mb-4 grid grid-cols-2 gap-4 md:grid-cols-4">
                <Field
                  label="Auksionga chiqarilgan maydon"
                  value={p.auctionTotalArea != null ? `${Number(p.auctionTotalArea).toLocaleString("uz")} m²` : null}
                />
                <Field label="Auksion holati" value={p.auctionStatus} />
                <Field
                  label="To'lov muddati"
                  value={p.paymentTermMonths ? `${p.paymentTermMonths} oy (bo'lib to'lash)` : null}
                />
                <Field
                  label="Tekshirilgan"
                  value={p.auctionCheckedAt ? p.auctionCheckedAt.toLocaleString("uz") : null}
                />
              </dl>

              {p.auctionLots.length > 0 ? (
                <div className="overflow-x-auto rounded-lg border border-border">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-slate-50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                        <th className="px-3 py-2 font-medium">Turi</th>
                        <th className="px-3 py-2 font-medium">Lot</th>
                        <th className="px-3 py-2 text-right font-medium">Maydon</th>
                        <th className="px-3 py-2 text-right font-medium">Boshlang'ich narx</th>
                        <th className="px-3 py-2 font-medium">Auksion sanasi</th>
                        <th className="px-3 py-2 font-medium">Holati</th>
                      </tr>
                    </thead>
                    <tbody>
                      {p.auctionLots.map((l) => (
                        <tr key={l.id} className="border-b border-border last:border-0 hover:bg-slate-50/60">
                          <td className="px-3 py-2">
                            <span
                              className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                                l.type === "RENT" ? "bg-emerald-50 text-emerald-700" : "bg-blue-50 text-blue-700"
                              }`}
                            >
                              {l.type === "RENT" ? "Ijara" : "Xususiylash."}
                            </span>
                          </td>
                          <td className="px-3 py-2 font-medium">
                            {l.lotNumber ? (
                              <a
                                href={lotUrl(l.lotNumber)}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 hover:underline"
                                style={{ color: "var(--cobalt)" }}
                                title="e-auksion.uz da ochish"
                              >
                                {l.lotNumber}
                                <ExternalLink className="h-3 w-3" />
                              </a>
                            ) : (
                              "—"
                            )}
                            {l.matchedByOldCad ? (
                              <span className="ml-1.5 rounded bg-amber-50 px-1 py-0.5 text-[10px] text-amber-700">
                                eski kad.
                              </span>
                            ) : null}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums">
                            {l.area != null ? `${Number(l.area).toLocaleString("uz")} m²` : "—"}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums">
                            {l.startPrice != null ? Number(l.startPrice).toLocaleString("uz") : "—"}
                          </td>
                          <td className="px-3 py-2 text-muted-foreground">
                            {l.auctionDate ? l.auctionDate.toLocaleString("uz") : "—"}
                          </td>
                          <td className="px-3 py-2 text-muted-foreground">{l.lotStatus ?? l.orderStatus ?? "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}
            </div>
          ) : null}

          {/* Ijara shartnomalari (API 5) — bitta kadastrda bir nechta bo'lishi mumkin */}
          {p.rentContractCount != null ? (
            <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
              <div className="mb-4 flex flex-wrap items-center gap-3">
                <SectionTitle icon={KeyRound}>
                  Ijara shartnomalari ({p.rentContracts.length})
                </SectionTitle>
                {p.rentMatchedByOldCad ? (
                  <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
                    Eski kadastr orqali topilgan
                  </span>
                ) : null}
              </div>

              <dl className="mb-4 grid grid-cols-2 gap-4 md:grid-cols-4">
                <Field label="Shartnomalar soni" value={p.rentContractCount} />
                <Field
                  label="Jami summa"
                  value={
                    p.rentTotalSum != null
                      ? Number(p.rentTotalSum) === 0
                        ? "0 (tekin foydalanish)"
                        : `${Number(p.rentTotalSum).toLocaleString("uz")} so'm`
                      : null
                  }
                />
                <Field
                  label="Jami maydon"
                  value={p.rentTotalArea != null ? `${Number(p.rentTotalArea).toLocaleString("uz")} m²` : null}
                />
                <Field label="Tekshirilgan" value={p.rentCheckedAt ? p.rentCheckedAt.toLocaleString("uz") : null} />
              </dl>

              {p.rentContracts.length > 0 ? (
                <div className="overflow-x-auto rounded-lg border border-border">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-slate-50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                        <th className="px-3 py-2 font-medium">Shartnoma</th>
                        <th className="px-3 py-2 font-medium">Sana</th>
                        <th className="px-3 py-2 text-right font-medium">Summa</th>
                        <th className="px-3 py-2 text-right font-medium">Maydon</th>
                        <th className="px-3 py-2 font-medium">Ijarachi</th>
                        <th className="px-3 py-2 font-medium">Hujjat</th>
                      </tr>
                    </thead>
                    <tbody>
                      {p.rentContracts.map((c) => (
                        <tr key={c.id} className="border-b border-border last:border-0 hover:bg-slate-50/60">
                          <td className="px-3 py-2 font-medium">
                            {c.contractNumber ?? "—"}
                            {c.matchedByOldCad ? (
                              <span className="ml-1.5 rounded bg-amber-50 px-1 py-0.5 text-[10px] text-amber-700">
                                eski kad.
                              </span>
                            ) : null}
                          </td>
                          <td className="px-3 py-2 text-muted-foreground">
                            {c.contractDate ? c.contractDate.toLocaleDateString("uz") : "—"}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums">
                            {c.contractSum != null ? Number(c.contractSum).toLocaleString("uz") : "—"}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums">
                            {c.rentalArea != null ? `${Number(c.rentalArea).toLocaleString("uz")} m²` : "—"}
                          </td>
                          <td className="px-3 py-2">{c.tenantName ?? "—"}</td>
                          <td className="px-3 py-2">
                            {c.docLink ? (
                              <a
                                href={c.docLink}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 hover:underline"
                                style={{ color: "var(--cobalt)" }}
                              >
                                Ko'rish <ExternalLink className="h-3 w-3" />
                              </a>
                            ) : (
                              "—"
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Shartnoma topilmadi.</p>
              )}
            </div>
          ) : null}

          {/* Integratsiya holat tekshiruvlari (API 3–8) */}
          <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <div className="mb-3">
              <SectionTitle icon={ListChecks}>Integratsiya tekshiruvlari (API 3–8)</SectionTitle>
            </div>
            {p.statusChecks.length === 0 ? (
              <p className="text-sm text-muted-foreground">Hali tekshirilmagan.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-xs uppercase text-muted-foreground">
                      <th className="py-2 pr-4 font-medium">Manba</th>
                      <th className="py-2 pr-4 font-medium">Topildi</th>
                      <th className="py-2 pr-4 font-medium">Holat</th>
                      <th className="py-2 pr-4 font-medium">Eski kadastr orqali</th>
                    </tr>
                  </thead>
                  <tbody>
                    {p.statusChecks.map((s) => (
                      <tr key={s.id} className="border-b border-border last:border-0">
                        {/* Kommunal manbalar o'zbekcha ko'rsatiladi — kodda "WATER"/"GAS"/
                            "ELECTRIC" qoladi (API bilan mos), UI'da esa Suv/Gaz/Elektr. */}
                        <td className="py-2 pr-4 font-medium">
                          {UTILITY_LABEL[s.apiSource as UtilityKind] ?? s.apiSource}
                        </td>
                        <td className="py-2 pr-4">{s.found ? "Ha" : "Yo'q"}</td>
                        <td className="py-2 pr-4 text-muted-foreground">{s.status ?? "—"}</td>
                        <td className="py-2 pr-4">
                          {s.matchedByOldCad ? (
                            <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs text-amber-700">Fallback</span>
                          ) : (
                            "—"
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Hujjatlar */}
          <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <div className="mb-3">
              <SectionTitle icon={FileText}>Hujjatlar (PDF)</SectionTitle>
            </div>
            {p.documents.length === 0 ? (
              <p className="text-sm text-muted-foreground">Hujjat yuklanmagan.</p>
            ) : (
              <ul className="space-y-2">
                {p.documents.map((d) => (
                  <li key={d.id} className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm transition hover:bg-slate-50">
                    <span className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-slate-400" />
                      {d.fileName}
                    </span>
                    <a
                      href={`/api/documents/${d.id}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 hover:underline"
                      style={{ color: "var(--cobalt)" }}
                    >
                      Ko'rish <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        {/* Kategoriya biriktirish + tarix */}
        <section className="space-y-4">
          {pendingRequest ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm shadow-sm">
              <p className="font-medium text-amber-800">Tasdiqlash kutilmoqda</p>
              <p className="mt-1 text-amber-700">
                {pendingRequest.requestedBy.fullName} tomonidan{" "}
                <strong>{CATEGORY_BY_CODE.get(pendingRequest.toCategory)?.nameUz}</strong> kategoriyasiga
                biriktirish so'rovi yuborilgan.{" "}
                {pendingRequest.status === "PENDING_MODERATOR"
                  ? "Moderator ko'rib chiqishini kutmoqda (1-bosqich)."
                  : "Moderator qabul qildi — rahbariyat tasdig'i kutilmoqda (2-bosqich)."}
              </p>
            </div>
          ) : null}

          {canAssign && !pendingRequest ? (
            <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
              <div className="mb-3">
                <SectionTitle icon={Tag}>
                  {isRequest ? "Kategoriya biriktirish so'rovi" : "Qo'lda kategoriya biriktirish"}
                </SectionTitle>
              </div>
              <AssignCategoryForm cadNumber={p.cadNumber} isRequest={isRequest} />
            </div>
          ) : !canAssign && (user.role === "IJROCHI" || isAdmin(user.role)) && !pendingRequest ? (
            <div className="rounded-xl border border-border bg-card p-5 text-sm text-muted-foreground shadow-sm">
              Faqat "Bo'sh turgan" obyektni Yaroqsiz/Chekka kategoriyaga biriktirish mumkin.
            </div>
          ) : null}

          {canRemoveCategory ? (
            <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
              <div className="mb-3">
                <SectionTitle icon={Tag}>Kategoriyani bekor qilish</SectionTitle>
              </div>
              <p className="mb-3 text-sm text-muted-foreground">
                Obyekt hozir <strong>{CATEGORY_BY_CODE.get(effectiveCode)?.nameUz}</strong> kategoriyasida.
                Olib tashlansa, obyekt yana "Bo'sh turgan"ga qaytadi.
              </p>
              <RemoveCategoryButton cadNumber={p.cadNumber} />
            </div>
          ) : null}

          <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <div className="mb-3">
              <SectionTitle icon={History}>Biriktirishlar tarixi</SectionTitle>
            </div>
            {p.assignments.length === 0 ? (
              <p className="text-sm text-muted-foreground">Yo'q.</p>
            ) : (
              <ul className="space-y-3">
                {p.assignments.map((a) => (
                  <li key={a.id} className="border-b border-border pb-3 text-sm last:border-0 last:pb-0">
                    <p className="font-medium">
                      {a.categoryCode}. {CATEGORY_BY_CODE.get(a.categoryCode)?.short ?? a.category.nameUz}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {a.assignedBy.fullName} · {a.createdAt.toLocaleDateString("uz")}
                    </p>
                    {a.note ? <p className="mt-1 text-xs">{a.note}</p> : null}
                    {a.document ? (
                      <a href={`/api/documents/${a.document.id}`} target="_blank" rel="noreferrer" className="text-xs hover:underline" style={{ color: "var(--cobalt)" }}>
                        Hujjat: {a.document.fileName}
                      </a>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
