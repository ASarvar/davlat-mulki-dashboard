import { Gavel, AlertTriangle, Search, RotateCcw, FileDown, Clock } from "lucide-react";
import { requireSection } from "@/server/services/sectionAccess";
import { auctionConfigured } from "@/server/integrations/auctionOrders";
import {
  listAuctionOrders,
  auctionFacets,
  auctionTotals,
  AUCTION_PAGE_SIZE,
  type AuctionOrderFilters,
} from "@/server/services/auctionOrders";
import { nf } from "@/lib/format";
import { withBase } from "@/lib/basePath";
import { SyncPanel } from "./SyncPanel";
import { getAuctionSyncStatus } from "./actions";
import { OrderRow, type OrderView } from "./OrderRow";
import type { AuctionOrder } from "@prisma/client";

type SP = Record<string, string | string[] | undefined>;
const str = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/**
 * ⚠️ Sana va son SHU YERDA — SERVERDA formatlanadi. `OrderRow` client komponent
 * bo'lsa ham Next.js uni avval serverda render qiladi; `toLocaleString("uz-UZ")`
 * Node'da `1 791 535`, brauzerda `1,791,535` beradi va gidratsiya buziladi
 * (ishlab chiqishda aynan shu xato chiqdi, 2026-09-07).
 *
 * ⚠️ `timeZone: "Asia/Tashkent"` QAT'IY — konteyner UTC da ishlaydi, usiz sana
 * kechqurungi auksionlarda bir kunga siljib ketardi.
 */
function dateLabel(d: Date | null, withTime = false): string {
  if (!d) return "—";
  return d.toLocaleString("uz-UZ", {
    timeZone: "Asia/Tashkent",
    dateStyle: "short",
    ...(withTime ? { timeStyle: "short" as const } : {}),
  });
}

function sumLabel(v: unknown): string {
  if (v === null || v === undefined) return "—";
  const n = Number(v);
  return Number.isFinite(n) ? nf(n) : "—";
}

function toOrderView(o: AuctionOrder): OrderView {
  return {
    orderId: o.orderId,
    credential: o.credential,
    name: o.name,
    region: o.region,
    area: o.area,
    address: o.address,
    groupName: o.groupName,
    categoryName: o.categoryName,
    orderStatus: o.orderStatus,
    lotStatus: o.lotStatus,
    lotNumber: o.lotNumber,
    customerName: o.customerName,
    customerInn: o.customerInn,
    winnerName: o.winnerName,
    winnerInn: o.winnerInn,
    winnerPinfl: o.winnerPinfl,
    winnerPassport: o.winnerPassport,
    winnerPhone: o.winnerPhone,
    winnerAddress: o.winnerAddress,
    bankName: o.bankName,
    bankMfo: o.bankMfo,
    protocolFileUrl: o.protocolFileUrl,
    startPriceLabel: sumLabel(o.startPrice),
    soldPriceLabel: sumLabel(o.soldPrice),
    paidPriceLabel: sumLabel(o.paidPrice),
    auctionDateLabel: dateLabel(o.auctionDate, true),
    lotPlaceDateLabel: dateLabel(o.lotPlaceDate),
    termLabel:
      o.termPayment === 1 ? `Bo'lib to'lash${o.termMonth ? ` — ${o.termMonth} oy` : ""}` : "To'liq",
    coordsLabel: o.lat !== null && o.lng !== null ? `${o.lat}, ${o.lng}` : null,
  };
}

const inputCls =
  "rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm outline-none transition focus:border-cobalt focus:ring-2 focus:ring-cobalt/20";

export default async function AuksionPage({ searchParams }: { searchParams: Promise<SP> }) {
  await requireSection("auksion");
  const sp = await searchParams;

  if (!auctionConfigured()) {
    return (
      <div>
        <h1 className="mb-4 flex items-center gap-2 text-xl font-bold tracking-tight" style={{ color: "var(--navy)" }}>
          <Gavel className="h-5 w-5" style={{ color: "var(--gold)" }} />
          Auksion buyurtmalari
        </h1>
        <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-semibold">Sozlanmagan</p>
            <p className="mt-1">
              <code>AUCTION_ORDERS_URL</code> va <code>AUCTION_ORDERS_CREDENTIALS</code> berilmagan.
              Ular <code>.env.auction</code> faylidan o&apos;qiladi (eski nomlar <code>API_URL</code> va{" "}
              <code>REGIONS_CREDENTIALS</code> ham qabul qilinadi). Namuna —{" "}
              <code>.env.auction.example</code>.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const f: AuctionOrderFilters = {
    q: str(sp.q) || undefined,
    credential: str(sp.akkaunt) || undefined,
    region: str(sp.hudud) || undefined,
    statusId: str(sp.holat) ? Number(str(sp.holat)) : undefined,
    groupName: str(sp.tur) || undefined,
    from: str(sp.dan) || undefined,
    to: str(sp.gacha) || undefined,
  };
  const page = Math.max(1, Number(str(sp.p)) || 1);

  const [data, facets, totals, syncStatus] = await Promise.all([
    listAuctionOrders(f, page),
    auctionFacets(),
    auctionTotals(),
    getAuctionSyncStatus(),
  ]);

  // ⚠️ Eksport va sahifalash havolalari BIR XIL parametrlardan quriladi — yangi
  // filtr qo'shsangiz shu yerga ham qo'shing (obyektlar sahifasidagi `baseParams`
  // bilan bir xil tuzoq: `status` bir marta shu sabab eksportga yetib bormagan edi).
  const baseParams = new URLSearchParams();
  for (const [k, v] of Object.entries({
    q: f.q,
    akkaunt: f.credential,
    hudud: f.region,
    holat: f.statusId?.toString(),
    tur: f.groupName,
    dan: f.from,
    gacha: f.to,
  })) {
    if (v) baseParams.set(k, v);
  }
  const pageHref = (p: number) => {
    const u = new URLSearchParams(baseParams);
    if (p > 1) u.set("p", String(p));
    const qs = u.toString();
    return `/dashboard/auksion${qs ? `?${qs}` : ""}`;
  };

  const from = data.total === 0 ? 0 : (page - 1) * AUCTION_PAGE_SIZE + 1;
  const to = Math.min(page * AUCTION_PAGE_SIZE, data.total);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight" style={{ color: "var(--navy)" }}>
            <Gavel className="h-5 w-5" style={{ color: "var(--gold)" }} />
            Auksion buyurtmalari
          </h1>
          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-muted-foreground">
            <span>
              Bazada {nf(totals.totalRows)} buyurtma ({totals.credentialCount} ta akkaunt)
            </span>
            {totals.lastSyncedAt && (
              <span className="inline-flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" />
                oxirgi yangilanish:{" "}
                {totals.lastSyncedAt.toLocaleString("uz-UZ", {
                  timeZone: "Asia/Tashkent",
                  dateStyle: "short",
                  timeStyle: "short",
                })}
              </span>
            )}
          </p>
        </div>
        <SyncPanel initial={syncStatus} credentials={facets.credentials} />
      </div>

      {/* ⚠️ `action` ATAYLAB berilmagan — GET forma joriy URL'ga yuboradi va shu
          bilan production'dagi `/obyektlar` sub-path'i saqlanadi (CLAUDE.md qoidasi). */}
      <form className="mb-4 flex flex-wrap items-end gap-2 rounded-xl border border-border bg-card p-3 shadow-sm">
        <label className="flex min-w-[220px] flex-1 flex-col gap-1">
          <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Qidiruv</span>
          <input
            type="text"
            name="q"
            defaultValue={f.q ?? ""}
            placeholder="Lot raqami, buyurtma ID, nomi, manzili"
            className={inputCls}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Akkaunt</span>
          <select name="akkaunt" defaultValue={f.credential ?? ""} className={inputCls}>
            <option value="">Hammasi</option>
            {facets.credentials.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Hudud</span>
          <select name="hudud" defaultValue={f.region ?? ""} className={`${inputCls} max-w-[190px]`}>
            <option value="">Hammasi</option>
            {facets.regions.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Holati</span>
          <select name="holat" defaultValue={f.statusId?.toString() ?? ""} className={`${inputCls} max-w-[210px]`}>
            <option value="">Hammasi</option>
            {facets.statuses.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Turi</span>
          <select name="tur" defaultValue={f.groupName ?? ""} className={`${inputCls} max-w-[210px]`}>
            <option value="">Hammasi</option>
            {facets.groups.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Auksion sanasi</span>
          <div className="flex items-center gap-1">
            <input type="date" name="dan" defaultValue={f.from ?? ""} className={inputCls} />
            <span className="text-muted-foreground">—</span>
            <input type="date" name="gacha" defaultValue={f.to ?? ""} className={inputCls} />
          </div>
        </label>
        <button
          type="submit"
          className="inline-flex items-center gap-1.5 rounded-lg bg-cobalt px-3.5 py-2 text-sm font-medium text-white shadow-sm transition hover:opacity-90"
          style={{ background: "var(--cobalt)" }}
        >
          <Search className="h-4 w-4" />
          Qidirish
        </button>
        <a
          href={withBase("/dashboard/auksion")}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-sm text-slate-600 transition hover:bg-muted"
        >
          <RotateCcw className="h-4 w-4" />
          Tozalash
        </a>
        <a
          href={withBase(`/api/export/auction-orders?${baseParams.toString()}`)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-sm text-slate-600 transition hover:bg-muted"
        >
          <FileDown className="h-4 w-4" />
          Excel
        </a>
      </form>

      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50 text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                <th className="px-3 py-2.5 font-medium">Lot / Buyurtma</th>
                <th className="px-3 py-2.5 font-medium">Nomi va manzili</th>
                <th className="px-3 py-2.5 font-medium">Hudud</th>
                <th className="px-3 py-2.5 font-medium">Auksion sanasi</th>
                <th className="px-3 py-2.5 text-right font-medium">Boshlang&apos;ich</th>
                <th className="px-3 py-2.5 text-right font-medium">Sotilgan</th>
                <th className="px-3 py-2.5 font-medium">Holati</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-3 py-10 text-center text-muted-foreground">
                    {totals.totalRows === 0
                      ? "Baza hali to'ldirilmagan — «Yangilash» tugmasini bosing yoki kunlik jadvalni (04:00) kuting."
                      : "Bu filtrga mos buyurtma topilmadi."}
                  </td>
                </tr>
              ) : (
                data.rows.map((o) => <OrderRow key={o.orderId} order={toOrderView(o)} />)
              )}
            </tbody>
          </table>
        </div>
      </div>

      {data.total > 0 && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-sm">
          <span className="text-muted-foreground">
            {nf(from)}–{nf(to)} / {nf(data.total)} ta
          </span>
          <div className="flex items-center gap-1.5">
            {page > 1 && (
              <a
                href={withBase(pageHref(page - 1))}
                className="rounded-lg border border-border bg-card px-3 py-1.5 transition hover:bg-muted"
              >
                ← Oldingi
              </a>
            )}
            <span className="px-2 text-muted-foreground">
              {nf(page)} / {nf(data.pages)}
            </span>
            {page < data.pages && (
              <a
                href={withBase(pageHref(page + 1))}
                className="rounded-lg border border-border bg-card px-3 py-1.5 transition hover:bg-muted"
              >
                Keyingi →
              </a>
            )}
          </div>
        </div>
      )}

      <p className="mt-4 text-[12px] leading-relaxed text-muted-foreground">
        ⚠️ Reyestr auksion tizimidan (<code>get-order</code>) kunlik olinadi va bu yerda faqat{" "}
        <strong>ko&apos;rish uchun</strong> saqlanadi — obyektlar monitoringiga, kategoriyalarga yoki
        rasmiy hisobotga ta&apos;sir qilmaydi. G&apos;olib haqidagi shaxsiy ma&apos;lumot qatorni
        ochganda ko&apos;rinadi; bo&apos;lim shu sababli faqat administratorlarga ochiq.
      </p>
    </div>
  );
}
