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
    } & DefaultSession["user"];
  }

  interface User {
    role: Role;
    sourceId: string | null;
    username: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role: Role;
    sourceId: string | null;
    username: string;
  }
}
