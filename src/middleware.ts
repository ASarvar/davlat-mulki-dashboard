import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "@/auth.config";
import { BASE_PATH } from "@/lib/basePath";

// Middleware faqat edge-safe authConfig'dan foydalanadi (Prisma import qilinmaydi).
const { auth } = NextAuth(authConfig);

const LOGIN_PATH = `${BASE_PATH}/login`;

// ⚠️ NextAuth'ning O'ZIDAGI signIn redirect'i Next.js basePath'ni HISOBGA OLMAYDI
//    (`reqWithEnvURL` so'rovni qayta quradi, `nextUrl` basePath xabardorligini yo'qotadi
//    → Location `/login` ga ketardi, `/obyektlar/login` emas). Shuning uchun himoyani va
//    redirect'ni shu yerda QO'LDA bajaramiz.
//
// Manzil oddiy `URL` (NextURL EMAS) orqali quriladi — basePath aynan yozilgani qoladi,
// Next uni qayta prefikslamaydi. Tashqi domen `nextUrl.origin`dan EMAS (u reverse-proxy
// ortida ichki `127.0.0.1:3000` ni ko'rsatadi), `Host` / `X-Forwarded-*` sarlavhalaridan
// olinadi — `trustHost: true` mantig'ining qo'lda ko'rinishi.
export default auth((req) => {
  if (req.auth) return; // tizimga kirgan — o'tkazamiz

  const { pathname } = req.nextUrl;
  if (pathname === "/login" || pathname === LOGIN_PATH) return; // login sahifasi ochiq

  const host =
    req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? req.nextUrl.host;
  const proto =
    req.headers.get("x-forwarded-proto") ?? req.nextUrl.protocol.replace(":", "");

  const loginUrl = new URL(LOGIN_PATH, `${proto}://${host}`);
  loginUrl.searchParams.set("callbackUrl", `${pathname}${req.nextUrl.search}`);
  return NextResponse.redirect(loginUrl);
});

export const config = {
  // Statik fayllar va auth API'dan tashqari hamma narsa himoyalangan.
  //
  // ⚠️ `api/imtiyoz/check-discount` ATAYLAB ochiq: uni shartnoma formasi (boshqa
  // ilova, boshqa origin) sessiyasiz chaqiradi. Middleware uni ushlasa, forma
  // JSON o'rniga login sahifasining HTML'ini olardi. Boshqa `api/imtiyoz/*`
  // yo'llari (operator tekshiruvi, holat) himoyalangan bo'lib qoladi.
  matcher: ["/((?!api/auth|api/imtiyoz/check-discount|_next/static|_next/image|favicon.ico).*)"],
};
