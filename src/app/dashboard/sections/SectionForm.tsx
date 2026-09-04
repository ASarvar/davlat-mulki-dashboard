"use client";

import { useRef } from "react";
import { Lock, Check } from "lucide-react";
import type { Role, SectionVisibility } from "@prisma/client";
import { ROLE_LABEL } from "@/lib/roles";
import { saveSectionAction } from "./actions";

const MODES: { value: SectionVisibility; label: string; hint: string }[] = [
  { value: "SUPER_ONLY", label: "Faqat super admin", hint: "Sinov bosqichi — boshqa hech kim ko'rmaydi" },
  { value: "ROLES", label: "Tanlangan rollar", hint: "Quyida belgilangan rollar ko'radi" },
  { value: "EVERYONE", label: "Hamma", hint: "Ruxsat etilgan doiradagi barcha rollar" },
];

export interface SectionFormProps {
  sectionKey: string;
  label: string;
  href: string;
  allowRoles: Role[];
  core: boolean;
  visibility: SectionVisibility;
  roles: Role[];
  /** Serverda formatlangan matn — client'da Date formatlanmaydi (gidratsiya). */
  updatedAtLabel: string | null;
  updatedByName: string | null;
}

export function SectionForm(props: SectionFormProps) {
  const { sectionKey, label, href, allowRoles, core, visibility, roles, updatedAtLabel, updatedByName } = props;
  const formRef = useRef<HTMLFormElement>(null);

  // Har qanday o'zgarish darhol saqlanadi — alohida "Saqlash" tugmasi yo'q, chunki
  // saqlanmagan holat bu yerda xavfli: operator bo'limni ochdim deb o'ylab ketishi mumkin.
  const submit = () => formRef.current?.requestSubmit();

  // ⚠️ SUPER_ADMIN ro'yxatda ko'rsatilmaydi: u har qanday rejimda ham ko'radi
  // (aks holda o'zini shu sahifadan qulflab qo'yishi mumkin bo'lardi).
  const selectable = allowRoles.filter((r) => r !== "SUPER_ADMIN");
  const limited = allowRoles.length < 6;

  if (core) {
    return (
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-slate-50/60 p-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-medium text-slate-700">{label}</span>
            <code className="rounded bg-slate-200/70 px-1.5 py-0.5 text-[11px] text-slate-600">{href}</code>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            O&apos;zak bo&apos;lim — tizimga kirgan har bir foydalanuvchi shu yerga tushadi,
            shuning uchun uni yopib bo&apos;lmaydi.
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-lg bg-slate-200/70 px-2.5 py-1 text-xs font-medium text-slate-600">
          <Lock className="h-3.5 w-3.5" /> Doim ochiq
        </span>
      </div>
    );
  }

  return (
    <form ref={formRef} action={saveSectionAction} className="rounded-xl border border-slate-200 bg-white p-4">
      <input type="hidden" name="key" value={sectionKey} />

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium" style={{ color: "var(--navy)" }}>{label}</span>
            <code className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-500">{href}</code>
          </div>
          {limited ? (
            <p className="mt-1 text-xs text-slate-500">
              Faqat quyidagilarga ochish mumkin:{" "}
              <span className="text-slate-600">{allowRoles.map((r) => ROLE_LABEL[r]).join(", ")}</span>
            </p>
          ) : null}
        </div>
        {updatedAtLabel ? (
          <p className="text-[11px] text-slate-400">
            {updatedAtLabel}
            {updatedByName ? ` · ${updatedByName}` : ""}
          </p>
        ) : null}
      </div>

      {/* Rejim */}
      <div className="mt-3 flex flex-wrap gap-2">
        {MODES.map((m) => {
          const on = m.value === visibility;
          return (
            <label
              key={m.value}
              title={m.hint}
              className={
                "cursor-pointer rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors " +
                (on
                  ? "border-transparent text-white"
                  : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50")
              }
              style={on ? { background: "var(--navy)" } : undefined}
            >
              <input
                type="radio"
                name="visibility"
                value={m.value}
                defaultChecked={on}
                onChange={submit}
                className="sr-only"
              />
              {m.label}
            </label>
          );
        })}
      </div>

      {/* Rollar — faqat "Tanlangan rollar" rejimida */}
      {visibility === "ROLES" ? (
        <div className="mt-3 flex flex-wrap gap-2 border-t border-slate-100 pt-3">
          {selectable.map((r) => {
            const on = roles.includes(r);
            return (
              <label
                key={r}
                className={
                  "cursor-pointer rounded-lg border px-2.5 py-1 text-xs transition-colors " +
                  (on
                    ? "border-transparent bg-cobalt/10 font-medium text-cobalt"
                    : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50")
                }
                style={on ? { background: "var(--gold-lighter)", color: "#8a6d33" } : undefined}
              >
                <input
                  type="checkbox"
                  name="roles"
                  value={r}
                  defaultChecked={on}
                  onChange={submit}
                  className="sr-only"
                />
                {on ? <Check className="mr-1 inline h-3 w-3" /> : null}
                {ROLE_LABEL[r]}
              </label>
            );
          })}
          <span className="self-center text-[11px] text-slate-400">
            Super admin har doim ko&apos;radi
          </span>
        </div>
      ) : null}
    </form>
  );
}
