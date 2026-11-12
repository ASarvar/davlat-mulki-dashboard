import { Wrench } from "lucide-react";

/**
 * "Texnik ishlar olib borilmoqda" ekrani — `LIMITED_VIEWER` roli uchun HAR bir bo'lim
 * o'rnida chiqadi (`dashboard/layout.tsx`, 2026-11-12). Hech qanday ma'lumot ko'rsatmaydi.
 */
export function MaintenanceScreen() {
  return (
    <div className="flex min-h-[70vh] items-center justify-center">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card px-8 py-12 text-center shadow-sm">
        <div
          className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl"
          style={{ background: "var(--gold-lighter)" }}
        >
          <Wrench className="h-8 w-8" style={{ color: "var(--gold)" }} strokeWidth={1.8} />
        </div>
        <h1 className="mt-6 text-xl font-bold tracking-tight" style={{ color: "var(--navy)" }}>
          Texnik ishlar olib borilmoqda
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">Bo&apos;lim tez orada ishga tushadi.</p>
      </div>
    </div>
  );
}
