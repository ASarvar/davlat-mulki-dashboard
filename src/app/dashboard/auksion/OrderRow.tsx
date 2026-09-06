"use client";

import { useState } from "react";
import { ChevronRight, ExternalLink } from "lucide-react";

/**
 * Bitta buyurtma qatori + ochiladigan tafsilot.
 *
 * ⚠️ BARCHA son va sana SERVERDA formatlanadi va bu yerga TAYYOR SATR bo'lib
 * keladi (`page.tsx` → `toOrderView()`). Bu client komponent bo'lsa ham, Next.js
 * uni avval SERVERDA render qiladi — `toLocaleString("uz-UZ")` esa Node'da
 * `1 791 535`, brauzerda `1,791,535` beradi va gidratsiya buziladi. Aynan shu xato
 * ishlab chiqish paytida chiqdi (2026-09-07) va CLAUDE.md'da ogohlantirilgan.
 *
 * ⚠️ G'olib haqidagi shaxsiy ma'lumot FAQAT ochilganda ko'rsatiladi: jadval
 * ko'rinishida u ekranda begona ko'zga tushmasin (bo'lim baribir faqat adminga
 * ochiq, bu qo'shimcha ehtiyot chorasi).
 */
export interface OrderView {
  orderId: number;
  credential: string;
  name: string | null;
  region: string | null;
  area: string | null;
  address: string | null;
  groupName: string | null;
  categoryName: string | null;
  orderStatus: string | null;
  lotStatus: string | null;
  lotNumber: string | null;
  customerName: string | null;
  customerInn: string | null;
  winnerName: string | null;
  winnerInn: string | null;
  winnerPinfl: string | null;
  winnerPassport: string | null;
  winnerPhone: string | null;
  winnerAddress: string | null;
  bankName: string | null;
  bankMfo: string | null;
  protocolFileUrl: string | null;
  // ── Serverda formatlangan yorliqlar ──
  startPriceLabel: string;
  soldPriceLabel: string;
  paidPriceLabel: string;
  auctionDateLabel: string;
  lotPlaceDateLabel: string;
  termLabel: string;
  coordsLabel: string | null;
}

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 break-words text-[13px] text-slate-700">{value || "—"}</dd>
    </div>
  );
}

export function OrderRow({ order: o }: { order: OrderView }) {
  const [open, setOpen] = useState(false);
  const sold = o.orderStatus?.toLowerCase().includes("muvaffaqiyatli");

  return (
    <>
      <tr
        onClick={() => setOpen((v) => !v)}
        className="cursor-pointer border-b border-border transition-colors last:border-0 hover:bg-muted/50"
      >
        <td className="px-3 py-2.5 align-top">
          <div className="flex items-start gap-1.5">
            <ChevronRight
              className={`mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform ${open ? "rotate-90" : ""}`}
            />
            <div>
              <div className="font-medium tabular-nums text-slate-800">{o.lotNumber ?? "—"}</div>
              <div className="text-[11px] tabular-nums text-muted-foreground">#{o.orderId}</div>
            </div>
          </div>
        </td>
        <td className="max-w-[340px] px-3 py-2.5 align-top">
          <div className="line-clamp-2 text-slate-800">{o.name ?? "—"}</div>
          {o.address && <div className="mt-0.5 line-clamp-1 text-[12px] text-muted-foreground">{o.address}</div>}
        </td>
        <td className="px-3 py-2.5 align-top text-[13px] text-slate-700">
          <div>{o.region ?? "—"}</div>
          {o.area && <div className="text-[12px] text-muted-foreground">{o.area}</div>}
        </td>
        <td className="whitespace-nowrap px-3 py-2.5 align-top tabular-nums text-slate-700">
          {o.auctionDateLabel}
        </td>
        <td className="whitespace-nowrap px-3 py-2.5 text-right align-top tabular-nums text-slate-700">
          {o.startPriceLabel}
        </td>
        <td className="whitespace-nowrap px-3 py-2.5 text-right align-top tabular-nums font-medium text-slate-800">
          {o.soldPriceLabel}
        </td>
        <td className="px-3 py-2.5 align-top">
          <span
            className={`inline-block rounded-md px-2 py-0.5 text-[11px] font-medium ${
              sold ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"
            }`}
          >
            {o.orderStatus ?? "—"}
          </span>
        </td>
      </tr>

      {open && (
        <tr className="border-b border-border bg-muted/30">
          <td colSpan={7} className="px-4 py-4">
            <dl className="grid grid-cols-2 gap-x-6 gap-y-3 md:grid-cols-4">
              <Field label="Akkaunt" value={o.credential} />
              <Field label="Turi" value={o.groupName} />
              <Field label="Toifa" value={o.categoryName} />
              <Field label="Lot holati" value={o.lotStatus} />
              <Field label="Lotga qo'yilgan" value={o.lotPlaceDateLabel} />
              <Field label="To'langan summa" value={o.paidPriceLabel} />
              <Field label="To'lov shartlari" value={o.termLabel} />
              <Field label="Koordinata" value={o.coordsLabel} />

              <div className="col-span-2 md:col-span-4">
                <div className="mb-2 mt-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Buyurtmachi
                </div>
                <dl className="grid grid-cols-2 gap-x-6 gap-y-3 md:grid-cols-4">
                  <Field label="Nomi" value={o.customerName} />
                  <Field label="STIR" value={o.customerInn} />
                  <Field label="Bank" value={o.bankName} />
                  <Field label="MFO" value={o.bankMfo} />
                </dl>
              </div>

              {/* ⚠️ SHAXSIY MA'LUMOT — g'olib topilmagan buyurtmada blok umuman
                  ko'rsatilmaydi (bo'sh maydonlar shovqin bo'lardi). */}
              {(o.winnerName || o.winnerInn || o.winnerPinfl) && (
                <div className="col-span-2 md:col-span-4">
                  <div className="mb-2 mt-1 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-amber-700">
                    G&apos;olib
                    <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium normal-case text-amber-800">
                      shaxsiy ma&apos;lumot
                    </span>
                  </div>
                  <dl className="grid grid-cols-2 gap-x-6 gap-y-3 md:grid-cols-4">
                    <Field label="F.I.Sh. / nomi" value={o.winnerName} />
                    <Field label="STIR" value={o.winnerInn} />
                    <Field label="JSHSHIR" value={o.winnerPinfl} />
                    <Field label="Passport" value={o.winnerPassport} />
                    <Field label="Telefon" value={o.winnerPhone} />
                    <Field label="Manzil" value={o.winnerAddress} />
                  </dl>
                </div>
              )}

              {o.protocolFileUrl && (
                <div className="col-span-2 md:col-span-4">
                  <a
                    href={o.protocolFileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-[13px] font-medium text-cobalt hover:underline"
                    style={{ color: "var(--cobalt)" }}
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    Bayonnoma faylini ochish
                  </a>
                </div>
              )}
            </dl>
          </td>
        </tr>
      )}
    </>
  );
}
