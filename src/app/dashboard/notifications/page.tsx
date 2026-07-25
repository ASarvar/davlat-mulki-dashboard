import Link from "next/link";
import { Bell, CheckCheck } from "lucide-react";
import { requireUser } from "@/lib/authz";
import { listNotifications } from "@/server/services/notifications";
import { markAllReadAction } from "./actions";

export default async function NotificationsPage() {
  const user = await requireUser();
  const items = await listNotifications(user.id);
  const hasUnread = items.some((n) => !n.isRead);

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight" style={{ color: "var(--navy)" }}>
          <Bell className="h-5 w-5" style={{ color: "var(--gold)" }} />
          Bildirishnomalar
        </h1>
        {hasUnread ? (
          <form action={markAllReadAction}>
            <button className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-600 shadow-sm transition hover:bg-slate-50">
              <CheckCheck className="h-4 w-4" />
              Hammasini o'qildi
            </button>
          </form>
        ) : null}
      </div>

      <div className="space-y-2">
        {items.length === 0 ? (
          <p className="rounded-xl border border-border bg-card p-6 text-center text-sm text-muted-foreground shadow-sm">
            Bildirishnoma yo'q.
          </p>
        ) : (
          items.map((n) => {
            const body = (
              <div
                className={`rounded-xl border p-4 text-sm shadow-sm transition ${
                  n.isRead ? "border-border bg-card" : "border-cobalt/30 bg-cobalt/5"
                }`}
              >
                <div className="flex items-start gap-3">
                  {!n.isRead ? <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full" style={{ background: "var(--cobalt)" }} /> : <span className="mt-1.5 h-2 w-2 shrink-0" />}
                  <div className="min-w-0">
                    <p className="text-slate-700">{n.message}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{n.createdAt.toLocaleString("uz")}</p>
                  </div>
                </div>
              </div>
            );
            return n.link ? (
              <Link key={n.id} href={n.link} className="block">
                {body}
              </Link>
            ) : (
              <div key={n.id}>{body}</div>
            );
          })
        )}
      </div>
    </div>
  );
}
