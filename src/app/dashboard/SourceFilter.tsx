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
 */
export function SourceFilter({
  names,
  activeKey,
  showOwn = false,
}: {
  names: string[];
  activeKey: string;
  showOwn?: boolean;
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
    ...(showOwn ? [{ key: OWN_SOHA, label: "Mening tashkilotim", href: "/dashboard" }] : []),
    ...ordered.map((n) => ({ key: n, label: n, href: `/dashboard?soha=${encodeURIComponent(n)}` })),
    { key: ALL_SOHA, label: "Hammasi", href: `/dashboard?soha=${ALL_SOHA}` },
  ];

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="inline-flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        <Layers3 className="h-3.5 w-3.5" />
        Manba
      </span>
      <div className="flex flex-wrap gap-1 rounded-lg border border-border bg-card p-1 shadow-sm">
        {items.map((it) => {
          const active = it.key === activeKey;
          return (
            <Link
              key={it.key}
              href={it.href}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                active ? "text-white shadow-sm" : "text-slate-600 hover:bg-slate-50"
              }`}
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
