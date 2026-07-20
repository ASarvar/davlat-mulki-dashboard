import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";

// Middleware faqat edge-safe authConfig'dan foydalanadi (Prisma import qilinmaydi).
export const { auth: middleware } = NextAuth(authConfig);

export default middleware;

export const config = {
  // Statik fayllar va auth API'dan tashqari hamma narsa himoyalangan.
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico).*)"],
};
