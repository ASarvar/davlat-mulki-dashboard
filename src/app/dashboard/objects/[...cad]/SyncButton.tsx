"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw, Check, AlertCircle } from "lucide-react";
import { syncSingleAction, type AssignState } from "../actions";

/** Tugma qayta bosilmaydigan muddat (soniya) — foydalanuvchi talabi (2026-08-19). */
const COOLDOWN_SECONDS = 5;

/**
 * "API orqali yangilash" tugmasi.
 *
 * ⚠️ Nima uchun alohida client komponent: server action faqat pg-boss navbatiga job
 * qo'yadi, haqiqiy yangilashni WORKER alohida jarayonda bajaradi. Oddiy `<form action=>`
 * da tugma bosilganda ekranda hech nima o'zgarmasdi (sahifa revalidate bo'ladi, lekin
 * ma'lumot hali eski) — foydalanuvchi bosilgan-bosilmaganini bilmasdi. Shuning uchun:
 *   1) so'rov ketayotganda tugma "Yuborilmoqda..." holatiga o'tadi,
 *   2) navbatga qo'yilgani haqida yozuv chiqadi,
 *   3) tugma COOLDOWN_SECONDS soniya bloklanadi (sanoq bilan) — takroriy bosish
 *      bir nechta keraksiz job yaratardi,
 *   4) sanoq tugagach sahifa qayta yuklanadi, ya'ni worker ulgurgan bo'lsa yangi
 *      "Oxirgi sinxronizatsiya" vaqti ko'rinadi.
 */
export function SyncButton({ cadNumber }: { cadNumber: string }) {
  const [state, formAction, pending] = useActionState<AssignState, FormData>(syncSingleAction, {});
  const [cooldown, setCooldown] = useState(0);
  const router = useRouter();

  // ⚠️ Sanoq server javobini KUTMAYDI — bosilishi bilan boshlanadi. Aks holda so'rov
  // ketayotgan ~yarim soniya ichida tugmani qayta bosib, bir nechta bir xil job
  // yaratish mumkin edi (jonli o'lchovda bu oraliq ~0.6s chiqdi).
  // Xato qaytsa sanoq darhol bekor qilinadi — foydalanuvchi kutib o'tirmasin.
  useEffect(() => {
    if (state.error) setCooldown(0);
  }, [state.error]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => {
      const next = cooldown - 1;
      setCooldown(next);
      // Sanoq tugadi — worker ulgurgan bo'lsa yangi ma'lumotni tortamiz.
      if (next === 0) router.refresh();
    }, 1000);
    return () => clearTimeout(t);
  }, [cooldown, router]);

  const blocked = pending || cooldown > 0;

  return (
    <form
      action={formAction}
      onSubmit={() => setCooldown(COOLDOWN_SECONDS)}
      className="flex flex-wrap items-center gap-2"
    >
      <input type="hidden" name="cadNumber" value={cadNumber} />

      {state.error ? (
        <span className="inline-flex items-center gap-1 rounded-md bg-red-50 px-2 py-1 text-xs font-medium text-red-700">
          <AlertCircle className="h-3.5 w-3.5" />
          {state.error}
        </span>
      ) : null}
      {/* ⚠️ `state.ok` faqat yangi submit bo'lganda o'zgaradi — sanoq tugagandan keyin
          ham `true` bo'lib qolar edi (`router.refresh()` uni tozalamaydi), shuning
          uchun xabar `cooldown > 0` bilan cheklangan: aynan kutish oynasida ko'rinadi,
          keyin o'zi yo'qoladi. */}
      {state.ok && !state.error && cooldown > 0 ? (
        <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700">
          <Check className="h-3.5 w-3.5" />
          Navbatga qo&apos;yildi
        </span>
      ) : null}

      <button
        type="submit"
        disabled={blocked}
        title={cooldown > 0 ? `${cooldown} soniyadan keyin qayta urinib ko'ring` : undefined}
        className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
        style={{ background: "var(--cobalt)" }}
      >
        <RefreshCw className={`h-4 w-4 ${pending ? "animate-spin" : ""}`} />
        {pending ? "Yuborilmoqda..." : cooldown > 0 ? `Kuting (${cooldown})` : "API orqali yangilash"}
      </button>
    </form>
  );
}
