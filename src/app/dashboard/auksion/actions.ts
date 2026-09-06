"use server";

import { revalidatePath } from "next/cache";
import { requireSection } from "@/server/services/sectionAccess";
import { getBoss } from "@/server/queue/boss";
import { QUEUE } from "@/server/queue/jobs";
import { auctionConfigured } from "@/server/integrations/auctionOrders";

/**
 * Reyestrni qo'lda yangilash — navbatga qo'yadi, DARHOL bajarmaydi.
 *
 * ⚠️ Bu yerda `syncAuctionOrders()` to'g'ridan-to'g'ri CHAQIRILMAYDI: u ~20–25
 * daqiqa ishlaydi va Next.js server action'i bunchaga cho'zilmaydi (foydalanuvchi
 * brauzeri ham kutmaydi). Worker uni fon rejimida bajaradi.
 *
 * ⚠️ `requireSection` MAJBURIY — bo'limni yashirish uning server action'ini
 * yashirmaydi (CLAUDE.md qoidasi).
 */
export async function triggerAuctionSync(): Promise<{ ok: boolean; message: string }> {
  await requireSection("auksion");

  if (!auctionConfigured()) {
    return { ok: false, message: "AUCTION_ORDERS_* sozlanmagan" };
  }

  try {
    const boss = await getBoss();
    // ⚠️ `singletonKey` — takroriy bosishda navbat bir xil job bilan to'lib
    // ketmasin (YATT indeksidagi bilan bir xil sabab).
    const id = await boss.send(QUEUE.AUCTION_ORDERS_SYNC, {}, { singletonKey: "auction-orders-sync" });
    revalidatePath("/dashboard/auksion");
    return id
      ? { ok: true, message: "Navbatga qo'yildi — worker fon rejimida yuklaydi (~20–25 daqiqa)." }
      : { ok: true, message: "Allaqachon navbatda turibdi." };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Navbatga qo'yib bo'lmadi" };
  }
}
