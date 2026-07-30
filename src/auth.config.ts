import type { NextAuthConfig } from "next-auth";
import type { Role } from "@prisma/client";

// Edge-safe konfiguratsiya (Prisma/bcrypt YO'Q) — middleware shuni ishlatadi.
// Credentials provider (DB kerak) auth.ts'da qo'shiladi.
export const authConfig: NextAuthConfig = {
  // Self-hosted (on-premise) uchun: reverse-proxy ortida host'ga ishonamiz.
  trustHost: true,
  secret: process.env.NEXTAUTH_SECRET,
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [], // auth.ts'da to'ldiriladi
  callbacks: {
    // Middleware'da qo'llanadigan koarse himoya: tizimga kirganmi?
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const isOnLogin = nextUrl.pathname.startsWith("/login");
      if (isOnLogin) return true; // login sahifasi ochiq
      return isLoggedIn; // qolgan hamma narsa himoyalangan
    },
    // Rol va sourceId'ni token/sessiyaga olib o'tamiz (DB'siz).
    jwt({ token, user }) {
      if (user) {
        token.role = (user as { role: Role }).role;
        token.sourceId = (user as { sourceId: string | null }).sourceId;
        token.username = (user as { username: string }).username;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub as string;
        session.user.role = token.role as Role;
        session.user.sourceId = (token.sourceId as string | null) ?? null;
        session.user.username = (token.username as string) ?? "";
      }
      return session;
    },
  },
};
