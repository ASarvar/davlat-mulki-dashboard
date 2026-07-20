"use client";

import { useActionState } from "react";
import { RefreshCw, MapPin, Trash2 } from "lucide-react";
import { runFullSyncAction, runRegionSyncAction, cleanupSyncAction, type SyncState } from "./actions";

export function SyncControls({
  regions,
  canFullSync,
  lockedRegionId,
  pendingJobs,
}: {
  regions: { id: string; name: string }[];
  canFullSync: boolean;
  lockedRegionId: string | null; // REGION_USER uchun o'z hududi
  pendingJobs: number;
}) {
  const [fullState, fullAction, fullPending] = useActionState<SyncState, FormData>(runFullSyncAction, {});
  const [regState, regAction, regPending] = useActionState<SyncState, FormData>(runRegionSyncAction, {});
  const [clnState, clnAction, clnPending] = useActionState<SyncState, FormData>(cleanupSyncAction, {});

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {canFullSync ? (
        <form action={fullAction} className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <h2 className="flex items-center gap-2 text-sm font-semibold" style={{ color: "var(--navy)" }}>
            <RefreshCw className="h-4 w-4" style={{ color: "var(--gold)" }} />
            To'liq sinxronizatsiya
          </h2>
          <p className="mt-1 mb-3 text-sm text-muted-foreground">
            Barcha 14 hudud STIR'i bo'yicha API 1 → 2 → 3–8 zanjiri fon rejimida ishga tushadi.
          </p>
          <button
            type="submit"
            disabled={fullPending}
            className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:opacity-90 disabled:opacity-60"
            style={{ background: "var(--navy)" }}
          >
            <RefreshCw className={`h-4 w-4 ${fullPending ? "animate-spin" : ""}`} />
            {fullPending ? "Navbatga qo'yilmoqda..." : "Barchasini yangilash"}
          </button>
          {fullState.error ? <p className="mt-2 text-sm text-red-700">{fullState.error}</p> : null}
          {fullState.ok ? <p className="mt-2 text-sm text-emerald-700">{fullState.ok}</p> : null}
        </form>
      ) : null}

      <form action={regAction} className="rounded-xl border border-border bg-card p-5 shadow-sm">
        <h2 className="flex items-center gap-2 text-sm font-semibold" style={{ color: "var(--navy)" }}>
          <MapPin className="h-4 w-4" style={{ color: "var(--gold)" }} />
          Hudud bo'yicha sinxronizatsiya
        </h2>
        <p className="mt-1 mb-3 text-sm text-muted-foreground">Faqat tanlangan hudud manbalari yangilanadi.</p>

        {lockedRegionId ? (
          <input type="hidden" name="regionId" value={lockedRegionId} />
        ) : (
          <select name="regionId" required className="mb-3 w-full rounded-md border border-slate-300 px-3 py-2 text-sm">
            <option value="">Hududni tanlang...</option>
            {regions.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        )}

        <button
          type="submit"
          disabled={regPending}
          className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:opacity-90 disabled:opacity-60"
          style={{ background: "var(--cobalt)" }}
        >
          <MapPin className="h-4 w-4" />
          {regPending ? "Navbatga qo'yilmoqda..." : "Hududni yangilash"}
        </button>
        {regState.error ? <p className="mt-2 text-sm text-red-700">{regState.error}</p> : null}
        {regState.ok ? <p className="mt-2 text-sm text-emerald-700">{regState.ok}</p> : null}
      </form>

      {canFullSync ? (
        <form action={clnAction} className="rounded-xl border border-border bg-card p-5 shadow-sm md:col-span-2">
          <h2 className="flex items-center gap-2 text-sm font-semibold" style={{ color: "var(--navy)" }}>
            <Trash2 className="h-4 w-4 text-red-400" />
            Navbatni tozalash
          </h2>
          <p className="mt-1 mb-3 text-sm text-muted-foreground">
            Navbatda <strong>{pendingJobs}</strong> ta job kutmoqda. Osilib qolgan sinxronizatsiyalarni yopadi va
            kutayotgan joblarni o'chiradi. <strong>Obyekt va hujjatlar o'chmaydi</strong> — faqat navbat tozalanadi.
          </p>
          <button
            type="submit"
            disabled={clnPending}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-60"
          >
            <Trash2 className="h-4 w-4" />
            {clnPending ? "Tozalanmoqda..." : "Tozalash"}
          </button>
          {clnState.error ? <p className="mt-2 text-sm text-red-700">{clnState.error}</p> : null}
          {clnState.ok ? <p className="mt-2 text-sm text-emerald-700">{clnState.ok}</p> : null}
        </form>
      ) : null}
    </div>
  );
}
