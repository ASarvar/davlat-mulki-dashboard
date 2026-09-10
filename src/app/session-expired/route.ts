import { redirect } from "next/navigation";
import { signOut } from "@/auth";
import { getCurrentUser } from "@/lib/authz";
import { withBase } from "@/lib/basePath";

/**
 * Yaroqsiz sessiyani TOZALAB login'ga yo'naltiradi.
 *
 * ⚠️ Nima uchun alohida route: sessiya cookie'sini faqat route handler yoki server
 * action o'chira oladi — Server Component (layout) cookie yoza olmaydi. Middleware esa
 * bazaga kira olmaydi (edge), ya'ni parol almashtirilgan foydalanuvchining JWT'sini
 * yaroqli deb o'tkazib yuboradi. Shuning uchun `requireUserOrRedirect()` shu yerga
 * yo'naltiradi.
 *
 * ⚠️ `signOut()`, cookie'ni qo'lda o'chirish EMAS: nomi muhitga bog'liq (dev
 * `authjs.session-token`, prod `obyektlar.session-token`) va katta token bo'laklarga
 * bo'linadi (`.0`, `.1`) — `signOut` hammasini to'g'ri tozalaydi.
 *
 * ⚠️ AVVAL TEKSHIRILADI: sessiya haqiqatan yaroqli bo'lsa CHIQARILMAYDI, panelga
 * qaytariladi. Busiz bu manzil "GET orqali chiqarib yuborish" bo'lib qolardi — begona
 * sahifa `<img src=".../session-expired">` qo'yib istalgan foydalanuvchini tizimdan
 * chiqarib yuborishi mumkin edi.
 */
export async function GET() {
  if (await getCurrentUser()) redirect("/dashboard");
  await signOut({ redirectTo: withBase("/login?expired=1") });
}
