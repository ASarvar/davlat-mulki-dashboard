import type { Role } from "@prisma/client";
import type { DefaultSession } from "next-auth";

// Session/JWT'ga rol va regionId qo'shamiz (rol-asosidagi ruxsatlar uchun).
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: Role;
      regionId: string | null;
    } & DefaultSession["user"];
  }

  interface User {
    role: Role;
    regionId: string | null;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role: Role;
    regionId: string | null;
  }
}
