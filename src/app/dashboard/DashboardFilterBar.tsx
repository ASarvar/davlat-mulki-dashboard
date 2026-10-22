"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { MapPin } from "lucide-react";
import { Dropdown } from "@/components/ui/Dropdown";

/**
 * Boshqaruv panelining STICKY filtr paneli (2026-10-21): sarlavha (`title`) + "Manba"
 * tugmalari (`source`, ikkalasi server'da chiziladi) + hudud tanlagichi.
 *
 * ⚠️ Hudud filtri BUTUN panelga ta'sir qiladi (foydalanuvchi tanlovi) — `?region=` URL
 * parametri orqali server qayta hisoblaydi (`StatsScope.regionId`), client'da filtrlanmaydi.
 * ⚠️ Mobil'da Sidebar'ning yuqori paneli ham sticky (`top-0`, 60px) — shu sabab
 * `top-[60px]`, `md` dan esa `top-0`. Mobil'da yopishganda sarlavha yashiriladi — aks holda
 * panel (sarlavha + ikki qator manba + hudud) ekranning uchdan birini egallardi.
 * Panel yopishib qolganda (sentinel ko'rinmay qolganda) fon va soya paydo bo'ladi —
 * tepada turganda sahifa bilan qo'shilib ketadi.
 */
export function DashboardFilterBar({
  regions,
  regionId,
  title,
  source,
}: {
  regions: { id: string; name: string }[];
  regionId: string | undefined;
  title: React.ReactNode;
  source: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const [stuck, setStuck] = useState(false);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setStuck(!e.isIntersecting), {
      rootMargin: "-60px 0px 0px 0px",
    });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const changeRegion = (id: string) => {
    const next = new URLSearchParams(params.toString());
    if (id) next.set("region", id);
    else next.delete("region");
    const qs = next.toString();
    startTransition(() =>
      router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false }),
    );
  };

  return (
    <>
      <div ref={sentinelRef} aria-hidden className="h-0" />
      <div
        aria-busy={pending}
        className={`sticky top-[60px] z-30 -mx-4 mb-5 px-4 py-3 transition-[background-color,box-shadow] md:top-0 md:-mx-8 md:px-8 ${
          stuck
            ? "border-b border-border bg-slate-50/95 shadow-[0_8px_16px_-14px_rgba(7,16,43,0.45)] backdrop-blur"
            : ""
        }`}
      >
        <div
          className={`flex flex-wrap items-end justify-between gap-4 ${pending ? "opacity-70" : ""}`}
        >
          <div className={stuck ? "max-md:hidden" : undefined}>{title}</div>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
            {source}
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                <MapPin
                  className="h-3.5 w-3.5"
                  style={{ color: "var(--gold)" }}
                />
                Hudud
              </span>
              <Dropdown
                ariaLabel="Hudud"
                value={regionId ?? ""}
                onChange={changeRegion}
                options={[
                  { value: "", label: "Barcha hududlar" },
                  ...regions.map((r) => ({ value: r.id, label: r.name })),
                ]}
                className="w-52"
              />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
