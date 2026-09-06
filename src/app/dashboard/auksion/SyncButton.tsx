"use client";

import { useState, useTransition } from "react";
import { RefreshCw } from "lucide-react";
import { triggerAuctionSync } from "./actions";

/**
 * Reyestrni qo'lda yangilash.
 *
 * ⚠️ Job navbatga qo'yiladi, natija darhol ko'rinmaydi — shuning uchun tugma
 * "bajarildi" demaydi, aynan "navbatga qo'yildi" deydi. Aks holda foydalanuvchi
 * sahifani yangilab, o'zgarish yo'qligini ko'rib xato deb o'ylardi.
 */
export function SyncButton() {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await triggerAuctionSync();
            setMsg({ ok: r.ok, text: r.message });
          })
        }
        className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-slate-600 shadow-sm transition hover:bg-muted disabled:opacity-60"
      >
        <RefreshCw className={`h-4 w-4 ${pending ? "animate-spin" : ""}`} />
        {pending ? "Yuborilmoqda…" : "Yangilash"}
      </button>
      {msg && (
        <span className={`text-[12px] ${msg.ok ? "text-emerald-700" : "text-red-600"}`}>{msg.text}</span>
      )}
    </div>
  );
}
