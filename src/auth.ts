import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { authConfig } from "@/auth.config";

const credsSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

// To'liq (Node) konfiguratsiya — Credentials provider bilan.
// Email YO'Q: login (username) + parol. Ochiq registratsiya YO'Q — userlarni admin yaratadi.
export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: { username: {}, password: {} },
      authorize: async (raw) => {
        const parsed = credsSchema.safeParse(raw);
        if (!parsed.success) return null;
        const { username, password } = parsed.data;

        const user = await prisma.user.findUnique({ where: { username } });
        if (!user || !user.isActive) return null;

        const ok = await bcrypt.compare(password, user.passwordHash);
        if (!ok) return null;

        return {
          id: user.id,
          name: user.fullName,
          username: user.username,
          role: user.role,
          regionId: user.regionId,
        };
      },
    }),
  ],
});
