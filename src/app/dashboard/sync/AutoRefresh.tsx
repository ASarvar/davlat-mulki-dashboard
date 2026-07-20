"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Faol sync bo'lsa sahifani davriy yangilab turadi (progress jonli ko'rinadi).
export function AutoRefresh({ enabled, intervalMs = 5000 }: { enabled: boolean; intervalMs?: number }) {
  const router = useRouter();

  useEffect(() => {
    if (!enabled) return;
    const timer = setInterval(() => router.refresh(), intervalMs);
    return () => clearInterval(timer);
  }, [enabled, intervalMs, router]);

  return null;
}
