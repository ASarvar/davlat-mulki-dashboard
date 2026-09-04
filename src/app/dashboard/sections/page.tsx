import { SlidersHorizontal, Info } from "lucide-react";
import { requireSection, listSections } from "@/server/services/sectionAccess";
import { SectionForm } from "./SectionForm";

// Sana SERVERDA formatlanadi (loyihadagi qolgan sahifalar kabi). Client'da
// formatlansa gidratsiya buzilardi: konteyner UTC, brauzer esa Asia/Tashkent.
// Vaqt zonasi ANIQ beriladi — production konteyneri UTC da ishlaydi.
const fmt = (d: Date) =>
  d.toLocaleString("uz", { timeZone: "Asia/Tashkent", dateStyle: "short", timeStyle: "short" });

/**
 * Bo'limlar ko'rinishini boshqarish — faqat SUPER_ADMIN
 * (`lib/sections.ts` → `allowRoles: ["SUPER_ADMIN"]`).
 *
 * Ish tartibi: yangi bo'lim kodda qo'shiladi → deploy qilinadi → u avtomatik
 * "Faqat super admin" holatida bo'ladi (bazada qatori yo'q) → tekshirilgach shu
 * yerdan rollarga ochiladi. Redeploy talab qilinmaydi.
 */
export default async function SectionsPage() {
  await requireSection("sections");
  const rows = await listSections();

  const hidden = rows.filter((r) => !r.core && r.visibility === "SUPER_ONLY").length;

  return (
    <div>
      <div className="mb-6">
        <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight" style={{ color: "var(--navy)" }}>
          <SlidersHorizontal className="h-5 w-5" style={{ color: "var(--gold)" }} />
          Bo&apos;limlar
        </h1>
        <p className="mt-1.5 text-sm text-slate-500">
          Qaysi bo&apos;lim qaysi rolga ko&apos;rinishini boshqarish. O&apos;zgarish darhol kuchga
          kiradi — qayta deploy qilish shart emas.
        </p>
      </div>

      <div className="mb-5 flex gap-2.5 rounded-xl border p-3.5 text-sm"
           style={{ background: "var(--gold-lighter)", borderColor: "var(--gold-light)", color: "#7a5f28" }}>
        <Info className="mt-0.5 h-4 w-4 shrink-0" />
        <div className="space-y-1">
          <p>
            <b>Yangi bo&apos;lim qo&apos;shilganda</b> u avtomatik ravishda faqat super adminga
            ko&apos;rinadi — sozlash unutilsa yashirin qoladi, ochilib ketmaydi.
          </p>
          <p>
            Menyudan yashirish bir vaqtning o&apos;zida <b>sahifani ham yopadi</b>: manzilni
            qo&apos;lda yozgan foydalanuvchi &laquo;Sahifa topilmadi&raquo; javobini oladi.
          </p>
          {hidden > 0 ? (
            <p>
              Hozir <b>{hidden} ta</b> bo&apos;lim faqat sizga ko&apos;rinmoqda.
            </p>
          ) : null}
        </div>
      </div>

      <div className="space-y-2.5">
        {rows.map((r) => (
          <SectionForm
            key={r.key}
            sectionKey={r.key}
            label={r.label}
            href={r.href}
            allowRoles={r.allowRoles}
            core={r.core === true}
            visibility={r.visibility}
            roles={r.roles}
            updatedAtLabel={r.updatedAt ? fmt(r.updatedAt) : null}
            updatedByName={r.updatedByName}
          />
        ))}
      </div>
    </div>
  );
}
