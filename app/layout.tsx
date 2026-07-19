import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Davlat mulki obyektlari monitoringi — 2026",
  description:
    "Hududiy boshqarmalar balansidagi davlat mulki obyektlari bo'yicha monitoring paneli",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="uz">
      <body className="min-h-screen bg-bg font-sans text-ink antialiased">
        <div className="border-b border-border bg-navy">
          <div className="mx-auto flex max-w-[1400px] items-center justify-between px-6 py-4">
            <div>
              <p className="font-display text-lg font-semibold tracking-tight text-white">
                Davlat mulki obyektlaridan samarali foydalanish markazi
              </p>
              <p className="mt-0.5 text-xs text-white/60">
                Hududiy boshqarmalar balansidagi obyektlar reestri
              </p>
            </div>
            <div className="flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-medium text-white/80">
              <span className="h-1.5 w-1.5 rounded-full bg-teal" />
              2026-yil hisobot davri
            </div>
          </div>
          <nav className="mx-auto flex max-w-[1400px] gap-6 px-6 text-sm">
            <a
              href="/"
              className="border-b-2 border-teal py-3 font-medium text-white"
            >
              Umumiy reestr
            </a>
            <a
              href="/kiritish"
              className="border-b-2 border-transparent py-3 text-white/60 hover:text-white"
            >
              Qo'lda ma'lumot kiritish
            </a>
          </nav>
        </div>
        {children}
      </body>
    </html>
  );
}
