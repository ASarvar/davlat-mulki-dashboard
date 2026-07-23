import type { SyncStatus, SyncRunStatus } from "@prisma/client";
import { effectiveCategory } from "@/lib/categories";

// Effektiv kategoriya belgisi (rangi manba/samaradorlikка qarab).
export function CategoryBadge({
  integrationCode,
  manualCode,
}: {
  integrationCode: number | null;
  manualCode: number | null;
}) {
  const cat = effectiveCategory(integrationCode, manualCode);
  if (!cat) {
    return (
      <span className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">
        Kategoriyasiz
      </span>
    );
  }
  const isIntegration = cat.source === "INTEGRATION";
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium"
      style={
        isIntegration
          ? { background: "rgba(26,58,124,0.10)", color: "var(--cobalt)" }
          : { background: "rgba(200,169,110,0.18)", color: "#8a6d34" }
      }
      title={`${cat.nameUz}`}
    >
      {cat.short}
    </span>
  );
}

export function InefficientBadge({ value }: { value: boolean }) {
  return value ? (
    <span className="inline-flex rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700">
      Samarasiz
    </span>
  ) : (
    <span className="inline-flex rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
      Samarali
    </span>
  );
}

const SYNC_LABEL: Record<SyncStatus, { label: string; cls: string }> = {
  PENDING: { label: "Kutilmoqda", cls: "bg-slate-100 text-slate-600" },
  SYNCING: { label: "Jarayonda", cls: "bg-amber-50 text-amber-700" },
  SYNCED: { label: "Sinxron", cls: "bg-emerald-50 text-emerald-700" },
  FAILED: { label: "Xato", cls: "bg-red-50 text-red-700" },
};

export function SyncStatusBadge({ status }: { status: SyncStatus }) {
  const s = SYNC_LABEL[status];
  return <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${s.cls}`}>{s.label}</span>;
}

const RUN_LABEL: Record<SyncRunStatus, { label: string; cls: string }> = {
  QUEUED: { label: "Navbatda", cls: "bg-slate-100 text-slate-600" },
  RUNNING: { label: "Ishlamoqda", cls: "bg-amber-50 text-amber-700" },
  COMPLETED: { label: "Yakunlandi", cls: "bg-emerald-50 text-emerald-700" },
  PARTIAL: { label: "Qisman", cls: "bg-orange-50 text-orange-700" },
  FAILED: { label: "Xato", cls: "bg-red-50 text-red-700" },
};

export function SyncRunStatusBadge({ status }: { status: SyncRunStatus }) {
  const s = RUN_LABEL[status];
  return <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${s.cls}`}>{s.label}</span>;
}
