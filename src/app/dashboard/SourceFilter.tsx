import Link from "next/link";
import { Layers3 } from "lucide-react";

// `?soha=` bo'lmasa sahifa "Ijara markazi"ni standart qilib oladi (page.tsx'da),
// shuning uchun "Hammasi"ni ANIQ so'rash uchun alohida belgi kerak — aks holda
// unga qaytishning umuman yo'li bo'lmasdi.
export const ALL_SOHA = "__all__";

/** MODERATOR'ning standart doirasi (o'z tashkiloti) — parametrsiz `/dashboard`. */
export const OWN_SOHA = "__own__";

/**
 * Manba (soha) kesimi tanlagichi. Oddiy havolalar — client JS kerak emas.
 *
 * ⚠️ Qaysi tugma faol ekani SERVERDA hisoblanadi (`activeKey`) — bu yerda emas.
 * Sabab: "Mening tashkilotim" ham, "Hammasi" ham natijada `soha = undefined` beradi,
 * ya'ni faqat `soha` qiymatidan ularni ajratib bo'lmaydi. Qoidani ikki joyda
 * takrorlamaslik uchun tayyor kalit uzatiladi.
 *
 * `showOwn` — MODERATOR uchun: uning standart doirasi parametrsiz URL'da yashaydi,
 * shuning uchun boshqa sohaga o'tgandan keyin qaytish uchun alohida tugma kerak.
 *
 * ⚠️ `basePath` — havolalar QAYSI sahifaga qaytishi. Ilgari `/dashboard` qattiq yozilgan
 * edi; rasmiy hisobot `/dashboard/hisobot` ga ko'chgach, usiz manba tugmasi foydalanuvchini
 * hisobotdan yangi boshqaruv paneliga otib yuborardi — jimgina, xatosiz.
 */
export function SourceFilter({
  names,
  activeKey,
  showOwn = false,
  basePath,
}: {
  names: string[];
  activeKey: string;
  showOwn?: boolean;
  /** Havolalar quriladigan sahifa manzili (masalan `/dashboard/hisobot`). */
  basePath: string;
}) {
  // Bitta manba bo'lsa tanlashning ma'nosi yo'q — ko'rsatmaymiz.
  if (names.length < 2 && !showOwn) return null;

  // Tartib: "Ijara markazi" har doim birinchi (asosiy manba), qolganlari o'z tartibida,
  // "Hammasi" esa oxirida.
  const ordered = [...names].sort((a, b) => {
    if (a === "Ijara markazi") return -1;
    if (b === "Ijara markazi") return 1;
    return 0;
  });

  const items: { key: string; label: string; href: string }[] = [
    ...(showOwn ? [{ key: OWN_SOHA, label: "Mening tashkilotim", href: basePath }] : []),
    ...ordered.map((n) => ({ key: n, label: n, href: `${basePath}?soha=${encodeURIComponent(n)}` })),
    { key: ALL_SOHA, label: "Hammasi", href: `${basePath}?soha=${ALL_SOHA}` },
  ];

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
      <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        <Layers3 className="h-3.5 w-3.5" style={{ color: "var(--gold)" }} />
        Manba
      </span>
      <div className="inline-flex flex-wrap items-center gap-1 rounded-xl border border-border bg-card p-1 shadow-sm">
        {items.map((it) => {
          const active = it.key === activeKey;
          return (
            <Link
              key={it.key}
              href={it.href}
              aria-current={active ? "page" : undefined}
              className={[
                "rounded-lg px-3 py-1.5 text-[13px] font-medium transition-all duration-150 ease-out",
                active
                  ? "text-white shadow-[0_2px_10px_-3px_rgba(26,58,124,0.6)]"
                  : "text-slate-500 hover:bg-muted hover:text-slate-900",
              ].join(" ")}
              style={active ? { background: "var(--cobalt)" } : undefined}
            >
              {it.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
