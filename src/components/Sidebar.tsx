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
} from "lucide-react";
import { cn } from "@/lib/utils";
import { signOutAction } from "@/app/dashboard/actions";

export interface SidebarUser {
  name: string;
  email: string;
  role: string;
  roleLabel: string;
}

const NAV = [
  { href: "/dashboard", label: "Boshqaruv paneli", icon: LayoutDashboard, exact: true, adminOnly: false },
  { href: "/dashboard/objects", label: "Obyektlar", icon: Building2, exact: false, adminOnly: false },
  { href: "/dashboard/sync", label: "Sinxronizatsiya", icon: RefreshCw, exact: false, adminOnly: false },
  { href: "/dashboard/sources", label: "Manbalar (STIR)", icon: Database, exact: false, adminOnly: true },
  { href: "/dashboard/users", label: "Foydalanuvchilar", icon: Users, exact: false, adminOnly: true },
];

const SIDEBAR_BG = "linear-gradient(180deg, var(--navy) 0%, var(--navy-mid) 100%)";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const chars = (parts.length >= 2 ? parts[0][0] + parts[1][0] : name.slice(0, 2)).toUpperCase();
  return chars || "?";
}

export function Sidebar({ user }: { user: SidebarUser }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // Sahifa almashganda mobil menyuni yopamiz.
  useEffect(() => setOpen(false), [pathname]);

  const items = NAV.filter((i) => !i.adminOnly || user.role === "SUPER_ADMIN");

  const inner = (
    <>
      {/* Brend */}
      <div className="grid  place-items-start gap-3 px-5 py-5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo-dm-light.svg" alt="Davlat mulki" className="h-10 w-auto shrink-0" />
        <div className="min-w-0">
          <p className="truncate text-[16px] text-white/50">Monitoring</p>
        </div>
      </div>

      {/* Navigatsiya */}
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-2">
        {items.map(({ href, label, icon: Icon, exact }) => {
          const active = exact ? pathname === href : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                active ? "bg-white/10 text-white" : "text-white/60 hover:bg-white/5 hover:text-white",
              )}
            >
              <Icon
                className={cn("h-[18px] w-[18px] shrink-0 transition-colors", !active && "text-white/50 group-hover:text-white/80")}
                style={active ? { color: "var(--gold)" } : undefined}
              />
              <span className="truncate">{label}</span>
              {active ? <span className="ml-auto h-5 w-1 shrink-0 rounded-full" style={{ background: "var(--gold)" }} /> : null}
            </Link>
          );
        })}
      </nav>

      {/* Foydalanuvchi */}
      <div className="border-t border-white/10 p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/10 text-xs font-semibold text-white">
            {initials(user.name || user.email)}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-white">{user.name || user.email}</p>
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
          <img src="/logo-short-light.svg" alt="Davlat mulki" className="h-8 w-auto" />
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
