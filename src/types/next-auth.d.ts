import type { Role } from "@prisma/client";
import type { DefaultSession } from "next-auth";

// Session/JWT'ga rol va sourceId qo'shamiz (rol-asosidagi ruxsatlar uchun).
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: Role;
      sourceId: string | null;
      username: string;
      /** Versiyasiz token — bu o'zgarishdan OLDIN berilgan (yaroqsiz deb qaraladi). */
      sessionVersion?: number;
    } & DefaultSession["user"];
  }

  interface User {
    role: Role;
    sourceId: string | null;
    username: string;
    // ⚠️ Ixtiyoriy: Auth.js `session` callback'ida `session.user` shu interfeysga
    // birlashadi va u yerga tokendan `number | undefined` tushadi.
    sessionVersion?: number;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role: Role;
    sourceId: string | null;
    username: string;
    sessionVersion?: number;
  }
}
