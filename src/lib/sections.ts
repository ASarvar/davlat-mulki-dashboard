import type { Role } from "@prisma/client";
import { ALL_ROLES } from "@/lib/roles";

/**
 * Bo'limlar registri — ilovadagi HAR BIR sahifa/menyu bandi shu yerda e'lon qilinadi.
 *
 * ⚠️ NIMA UCHUN KERAK: ilgari ko'rinish ikki joyda edi — `Sidebar.tsx` → `NAV.roles`
 * (menyu) va har bir sahifadagi `requireRole(...)` (ruxsat). Ular bir-biridan mustaqil
 * bo'lgani uchun allaqachon ajralib ketgan edi: `/dashboard/notifications` menyuda faqat
 * ikki rolga ko'rinardi, lekin URL'ni qo'lda yozgan istalgan rol ochardi. Endi ikkalasi
 * ham SHU registrdan va `services/sectionAccess.ts` dan oziqlanadi.
 *
 * ⚠️ Bu fayl TOZA MA'LUMOT — ikonka, JSX, Prisma importi YO'Q. Shuning uchun uni server
 * komponenti ham, client komponenti (`Sidebar`) ham bemalol import qiladi.
 */

export interface SectionDef {
  key: string;
  href: string;
  label: string;
  /** Menyuda faollik: `true` — aynan shu manzil, `false` — prefiks bo'yicha. */
  exact: boolean;
  /**
   * ⚠️ QATTIQ CHEGARA — bo'limni ko'rsatish MUMKIN BO'LGAN eng keng rollar doirasi.
   *
   * Bazadagi sozlama faqat shu to'plam ICHIDA ishlaydi: super admin `/dashboard/users`
   * ni kuzatuvchiga ocholmaydi, chunki VIEWER bu ro'yxatda yo'q. Ya'ni boshqaruv
   * panelidagi bitta noto'g'ri bosish butun foydalanuvchilar bo'limini ocha olmaydi.
   *
   * ⚠️ Bu "eng past rol" (ierarxiya) EMAS, aynan TO'PLAM: loyihadagi 6 rol chiziqli
   * tartibda emas — Moderator, Rahbariyat va Ijrochi bir-biridan yuqori/past emas.
   */
  allowRoles: Role[];
  /**
   * O'zak bo'lim — bazadagi sozlamaga bo'ysunmaydi, `allowRoles` doirasida DOIM ochiq.
   *
   * ⚠️ Faqat `/dashboard` uchun: `app/page.tsx` tizimga kirgan foydalanuvchini o'sha
   * yerga yo'naltiradi. U yopilsa foydalanuvchi kirgan zahoti "sahifa topilmadi"ga
   * tushardi va o'zini o'zi qulflab qo'yish mumkin bo'lardi.
   */
  core?: true;
}

const ADMINS: Role[] = ["SUPER_ADMIN", "ADMIN"];

/** Tartib — Sidebar menyusidagi tartib. */
export const SECTIONS: SectionDef[] = [
  { key: "dashboard",      href: "/dashboard",                    label: "Boshqaruv paneli",     exact: true,  allowRoles: ALL_ROLES, core: true },
  { key: "objects",        href: "/dashboard/objects",            label: "Obyektlar",            exact: false, allowRoles: ALL_ROLES },
  { key: "requests",       href: "/dashboard/requests",           label: "Tasdiqlash so'rovlari", exact: false, allowRoles: ALL_ROLES },
  { key: "imtiyoz",        href: "/dashboard/imtiyoz",            label: "Ijara imtiyozi",       exact: false, allowRoles: ALL_ROLES },
  { key: "notifications",  href: "/dashboard/notifications",      label: "Bildirishnomalar",     exact: false, allowRoles: ALL_ROLES },
  { key: "cadastre-check", href: "/dashboard/cadastre-check",     label: "Kadastrni tekshirish", exact: false, allowRoles: ADMINS },
  { key: "sync",           href: "/dashboard/sync",               label: "Sinxronizatsiya",      exact: false, allowRoles: ADMINS },
  { key: "sources",        href: "/dashboard/sources",            label: "Manbalar (STIR)",      exact: false, allowRoles: ADMINS },
  { key: "users",          href: "/dashboard/users",              label: "Foydalanuvchilar",     exact: false, allowRoles: ADMINS },
  // Boshqaruv sahifasining o'zi — faqat super admin (foydalanuvchi qarori, 2026-09-05).
  { key: "sections",       href: "/dashboard/sections",           label: "Bo'limlar",            exact: false, allowRoles: ["SUPER_ADMIN"] },
];

const BY_KEY = new Map(SECTIONS.map((s) => [s.key, s]));

export function sectionDef(key: string): SectionDef | undefined {
  return BY_KEY.get(key);
}
