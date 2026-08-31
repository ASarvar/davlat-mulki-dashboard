"use server";

import { signOut } from "@/auth";
import { withBase } from "@/lib/basePath";

export async function signOutAction() {
  // Auth.js core `redirectTo` ni mutlaq URL qiladi — basePath'ni qo'lda qo'shamiz.
  await signOut({ redirectTo: withBase("/login") });
}
