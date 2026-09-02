"use client";

import { useEffect, useState } from "react";
import { withBase } from "@/lib/basePath";
import { cn } from "@/lib/utils";

/**
 * Tashqi manbalar holati.
 *
 * ⚠️ Panel ATAYLAB pastda va YOPIQ: operatorga "YATT indeksi 14 456 tadbirkor" kabi
 * ma'lumot kundalik ishda kerak emas. Biror baza yotib qolsa, tekshiruv natijasining
 * o'zi buni "aniqlanmadi" + sabab ro'yxati bilan aytadi.
 */

type Status = "ok" | "degraded" | "down" | "unknown";
type YattStatus = "ok" | "syncing" | "incomplete" | "stale" | "unavailable";

interface Snapshot {
  configured: boolean;
  soliq: { status: Status; message: string | null; lastObservedAt: string | null };
  tiek: { status: Status; message: string | null; lastObservedAt: string | null };
  yatt: {
    status: YattStatus;
    ready: boolean;
    syncing: boolean;
    lastSyncedAt: string | null;
    entrepreneursIndexed: number;
    recordsIndexed: number;
    failedPagesCount: number;
    lastError: string | null;
  };
}

const DOT: Record<Status | YattStatus, string> = {
  ok: "bg-emerald-500",
  degraded: "bg-amber-500",
  down: "bg-red-500",
  unknown: "bg-slate-300",
  syncing: "bg-cobalt",
  incomplete: "bg-amber-500",
  stale: "bg-amber-500",
  unavailable: "bg-red-500",
};

const LABEL: Record<Status | YattStatus, string> = {
  ok: "Ishlayapti",
  degraded: "Nosozlik bor",
  down: "Javob bermayapti",
  // ⚠️ "Yotibdi" EMAS: trafik bo'lmasa holat shunchaki kuzatilmagan bo'ladi.
  unknown: "Hali kuzatilmagan",
  syncing: "Sinxronlanmoqda",
  incomplete: "To'liq emas",
  stale: "Eskirgan",
  unavailable: "Tayyor emas",
};

function fmt(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function HealthPanel({ refreshKey }: { refreshKey: number }) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<Snapshot | null>(null);

  useEffect(() => {
    // Panel yopiq bo'lsa so'ramaymiz — u pastda va kamdan-kam ochiladi.
    if (!open) return;
    let alive = true;
    const load = async () => {
      try {
        const res = await fetch(withBase("/api/imtiyoz/app/health"));
        const body = await res.json();
        if (alive && body?.success) setData(body.data as Snapshot);
      } catch {
        /* holat paneli — xato jim o'tkaziladi, u asosiy ish emas */
      }
    };
    void load();
    return () => {
      alive = false;
    };
  }, [open, refreshKey]);

  return (
    <div className="pt-2 print:hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="text-xs font-medium text-muted-foreground underline underline-offset-2 hover:text-slate-700"
      >
        {open ? "Tizim holatini yashirish" : "Tizim holati"}
      </button>

      {open ? (
        <div className="mt-2 rounded-xl border border-border bg-card p-4 text-sm shadow-sm">
          {!data ? (
            <p className="text-xs text-muted-foreground">Yuklanmoqda...</p>
          ) : !data.configured ? (
            <p className="text-xs text-amber-700">
              Imtiyoz API&apos;lari sozlanmagan (<code>IMTIYOZ_*</code> env). Tekshiruv ishlamaydi.
            </p>
          ) : (
            <dl className="space-y-2">
              <Row label="Soliq (xodimlar)" status={data.soliq.status} note={data.soliq.message} />
              <Row label="TIEK (nogironlik reyestri)" status={data.tiek.status} note={data.tiek.message} />
              <Row
                label="YATT indeksi"
                status={data.yatt.status}
                note={
                  data.yatt.lastError ??
                  (data.yatt.failedPagesCount > 0
                    ? `${data.yatt.failedPagesCount} ta sahifa yuklanmadi`
                    : null)
                }
                extra={
                  data.yatt.ready
                    ? `${data.yatt.entrepreneursIndexed} tadbirkor · oxirgi sinxronlash ${fmt(data.yatt.lastSyncedAt)}`
                    : null
                }
              />
            </dl>
          )}
        </div>
      ) : null}
    </div>
  );
}

function Row({
  label,
  status,
  note,
  extra,
}: {
  label: string;
  status: Status | YattStatus;
  note?: string | null;
  extra?: string | null;
}) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-2">
      <span className={cn("h-2 w-2 shrink-0 self-center rounded-full", DOT[status])} />
      <dt className="text-xs font-medium text-slate-700">{label}</dt>
      <dd className="text-xs text-muted-foreground">
        {LABEL[status]}
        {extra ? ` · ${extra}` : ""}
        {note ? ` · ${note}` : ""}
      </dd>
    </div>
  );
}
