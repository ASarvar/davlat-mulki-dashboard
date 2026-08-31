import type { NextAuthConfig } from "next-auth";
import type { Role } from "@prisma/client";
import { BASE_PATH } from "@/lib/basePath";

// Edge-safe konfiguratsiya (Prisma/bcrypt YO'Q) — middleware shuni ishlatadi.
// Credentials provider (DB kerak) auth.ts'da qo'shiladi.
export const authConfig: NextAuthConfig = {
  // Self-hosted (on-premise) uchun: reverse-proxy ortida host'ga ishonamiz.
  trustHost: true,
  secret: process.env.NEXTAUTH_SECRET,
  // Auth.js `basePath` standart `/api/auth` — TEGMANG. Next.js basePath'ni HAM route
  // handler'dan (`req.url`), HAM middleware'dan ajratib beradi, ya'ni Auth.js core doim
  // `/api/auth/...` ko'radi. `createActionURL` ham shu prefiks bilan sintetik URL quradi.
  // Sub-path'ni faqat foydalanuvchiga ko'rinadigan joylarda qo'lda qo'shamiz:
  // login redirect — middleware.ts'da, muvaffaqiyatli kirish/chiqish — `withBase()` bilan.
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  // davijara.uz ildizida BOSHQA Auth.js ilova ham bor — standart cookie nomlari
  // (`authjs.session-token` / `__Secure-authjs...`) bir-birini o'chirib, ikkala
  // ilovadan ham chiqarib yuborardi. Sub-path deploy'da shu ilovaga alohida nom.
  // Prefikssiz (`__Secure-`/`__Host-` emas): edge middleware env'ni build vaqtida
  // inline qiladi, Docker build'da esa NEXTAUTH_URL yo'q — ya'ni HTTPS'ni build
  // vaqtida ishonchli aniqlab bo'lmaydi. `secure`/`httpOnly`/`sameSite` baribir
  // Auth.js standartidan (runtime HTTPS ⇒ Secure) meros bo'lib qoladi.
  ...(BASE_PATH
    ? {
        cookies: {
          sessionToken: { name: "obyektlar.session-token" },
          callbackUrl: { name: "obyektlar.callback-url" },
          csrfToken: { name: "obyektlar.csrf-token" },
        },
      }
    : {}),
  providers: [], // auth.ts'da to'ldiriladi
  callbacks: {
    // ⚠️ "tizimga kirganmi?" himoyasi endi `middleware.ts` ichida (o'sha yerda
    //    basePath'li redirect qo'lda quriladi). Bu yerda `authorized` YO'Q —
    //    aks holda NextAuth o'zining basePath'siz redirect'ini ishga solardi.

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
