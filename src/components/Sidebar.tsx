"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  LayoutDashboard,
  Building2,
  RefreshCw,
  Database,
  Users,
  LogOut,
  Menu,
  X,
  Bell,
  ClipboardCheck,
  FileSearch,
  BadgePercent,
  SlidersHorizontal,
  Table2,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { withBase } from "@/lib/basePath";
import { SECTIONS } from "@/lib/sections";
import { signOutAction } from "@/app/dashboard/actions";
import packageJson from "../../package.json";

// Katta o'zgarish qilinganda `package.json` → `version` qo'lda oshiriladi —
// sidebar shuni ko'rsatadi, alohida joyda saqlash shart emas.
const APP_VERSION = packageJson.version;

export interface SidebarUser {
  name: string;
  username: string;
  role: string;
  roleLabel: string;
}

/**
 * Ikonkalar bo'lim kaliti bo'yicha. Bo'limlarning O'ZI (manzil, nom, tartib) —
 * `lib/sections.ts` da; bu yerda faqat ikonka qoladi, chunki lucide komponentlarini
 * server komponentidan prop orqali uzatib bo'lmaydi (bu fayl "use client").
 *
 * ⚠️ Bu yerda ROL TEKSHIRUVI YO'Q. Qaysi bo'lim ko'rinishini server hal qiladi
 * (`services/sectionAccess.ts` → `allowedSectionKeys`) va `allowedKeys` propida
 * beradi. Ilgari menyu O'Z rol ro'yxatini saqlardi va sahifadagi haqiqiy qorovuldan
 * ajralib ketgan edi — masalan "Bildirishnomalar" menyuda ikki rolga ko'rinsa ham,
 * URL'ni qo'lda yozgan istalgan rol sahifani ochardi.
 */
const ICONS: Record<string, LucideIcon> = {
  dashboard: LayoutDashboard,
  hisobot: Table2,
  objects: Building2,
  requests: ClipboardCheck,
  imtiyoz: BadgePercent,
  notifications: Bell,
  "cadastre-check": FileSearch,
  sync: RefreshCw,
  sources: Database,
  users: Users,
  sections: SlidersHorizontal,
};

const SIDEBAR_BG = "linear-gradient(180deg, var(--navy) 0%, var(--navy-mid) 100%)";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const chars = (parts.length >= 2 ? parts[0][0] + parts[1][0] : name.slice(0, 2)).toUpperCase();
  return chars || "?";
}

export function Sidebar({
  user,
  unreadCount = 0,
  allowedKeys,
}: {
  user: SidebarUser;
  unreadCount?: number;
  /** Serverda hisoblangan ochiq bo'limlar kalitlari (`allowedSectionKeys`). */
  allowedKeys: string[];
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // Sahifa almashganda mobil menyuni yopamiz.
  useEffect(() => setOpen(false), [pathname]);

  const allowed = new Set(allowedKeys);
  const items = SECTIONS.filter((sec) => allowed.has(sec.key));

  const inner = (
    <>
      {/* Brend */}
      <div className="grid  place-items-start gap-3 px-5 py-5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={withBase("/logo-dm-light.svg")} alt="Davlat mulki" className="h-10 w-auto shrink-0" />
        <div className="min-w-0">
          <p className="truncate text-[16px] font-bold pl-10" style={{ color: "var(--gold)"}}>
            Monitoring <sup className="text-xs font-mono text-white animate-pulse">beta</sup>
          </p>
        </div>
      </div>

      {/* Navigatsiya */}
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-2">
        {items.map(({ key, href, label, exact }) => {
          const Icon = ICONS[key];
          const active = exact ? pathname === href : pathname.startsWith(href);
          return (
            <Link
              key={key}
              href={href}
              className={cn(
                "group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                active ? "bg-white/10 text-white" : "text-white/60 hover:bg-white/5 hover:text-white",
              )}
            >
              {Icon ? (
                <Icon
                  className={cn("h-[18px] w-[18px] shrink-0 transition-colors", !active && "text-white/50 group-hover:text-white/80")}
                  style={active ? { color: "var(--gold)" } : undefined}
                />
              ) : null}
              <span className="truncate">{label}</span>
              {key === "notifications" && unreadCount > 0 ? (
                <span className="ml-auto rounded-full bg-red-500 px-1.5 text-[11px] font-semibold text-white">
                  {unreadCount}
                </span>
              ) : active ? (
                <span className="ml-auto h-5 w-1 shrink-0 rounded-full" style={{ background: "var(--gold)" }} />
              ) : null}
            </Link>
          );
        })}
      </nav>

      {/* Foydalanuvchi */}
      <div className="border-t border-white/10 p-4">
        <p className="pr-2 text-right mb-2 text-[12px] font-mono text-white/50">v{APP_VERSION}</p>
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/10 text-xs font-semibold text-white">
            {initials(user.name || user.username)}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-white">{user.name || user.username}</p>
            <p className="truncate text-[11px] text-white/50">{user.roleLabel}</p>
          </div>
          <form action={signOutAction}>
            <button
              type="submit"
              title="Chiqish"
              className="rounded-lg p-2 text-white/60 transition-colors hover:bg-white/10 hover:text-white"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </form>
        </div>
      </div>
    </>
  );

  return (
    <>
      {/* Mobil yuqori panel */}
      <header
        className="sticky top-0 z-40 flex items-center justify-between px-4 py-3 shadow-md md:hidden"
        style={{ background: "var(--navy)" }}
      >
        <div className="flex items-center gap-2.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={withBase("/logo-short-light.svg")} alt="Davlat mulki" className="h-8 w-auto" />
          <span className="text-sm font-semibold text-white">Monitoring</span>
        </div>
        <button
          onClick={() => setOpen(true)}
          className="rounded-lg p-2 text-white/80 hover:bg-white/10"
          aria-label="Menyuni ochish"
        >
          <Menu className="h-5 w-5" />
        </button>
      </header>

      {/* Mobil drawer + fon */}
      <div
        className={cn(
          "fixed inset-0 z-40 bg-black/50 backdrop-blur-sm transition-opacity md:hidden",
          open ? "opacity-100" : "pointer-events-none opacity-0",
        )}
        onClick={() => setOpen(false)}
      />
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-64 flex-col shadow-2xl transition-transform duration-200 ease-out md:hidden",
          open ? "translate-x-0" : "-translate-x-full",
        )}
        style={{ background: SIDEBAR_BG }}
      >
        <button
          onClick={() => setOpen(false)}
          className="absolute right-3 top-4 rounded-lg p-1.5 text-white/60 hover:bg-white/10 hover:text-white"
          aria-label="Menyuni yopish"
        >
          <X className="h-4 w-4" />
        </button>
        {inner}
      </aside>

      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col md:flex" style={{ background: SIDEBAR_BG }}>
        {inner}
      </aside>
    </>
  );
}
