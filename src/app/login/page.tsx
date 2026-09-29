import { signIn } from "@/auth";
import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import { KeyRound, LogIn, UserRound } from "lucide-react";
import { withBase } from "@/lib/basePath";

const INPUT =
  "h-11 w-full rounded-lg border border-slate-300 bg-white pl-10 pr-3 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-[var(--cobalt)] focus:ring-2 focus:ring-[var(--cobalt)]/20";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; expired?: string }>;
}) {
  const { error, expired } = await searchParams;

  async function authenticate(formData: FormData) {
    "use server";
    try {
      await signIn("credentials", {
        username: formData.get("username"),
        password: formData.get("password"),
        // Auth.js core `redirectTo` ni mutlaq URL qiladi — basePath'ni qo'lda qo'shamiz.
        redirectTo: withBase("/dashboard"),
      });
    } catch (err) {
      // Login xatosi => login sahifasiga qaytamiz. Redirect (muvaffaqiyat) uzatiladi.
      if (err instanceof AuthError) redirect("/login?error=1");
      throw err;
    }
  }

  return (
    <main className="grid min-h-screen bg-slate-50 lg:grid-cols-[1.1fr_1fr]">
      {/* Brend paneli — Sidebar bilan bir xil palitra va logotip (faqat katta ekranda). */}
      <section
        className="relative hidden flex-col justify-between overflow-hidden p-12 lg:flex"
        style={{ background: "linear-gradient(160deg, var(--navy) 0%, var(--navy-mid) 55%, var(--cobalt) 100%)" }}
      >
        {/* Bezak: logotip belgisi katta va xira, burchakda oltin nur. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={withBase("/logo-short-light.svg")}
          alt=""
          aria-hidden
          className="pointer-events-none absolute -bottom-24 -right-16 h-[560px] w-auto opacity-[0.06]"
        />
        <span
          aria-hidden
          className="pointer-events-none absolute -left-32 -top-32 h-96 w-96 rounded-full opacity-20 blur-3xl"
          style={{ background: "var(--gold)" }}
        />

        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={withBase("/logo-dm-light.svg")} alt="Davlat mulki" className="relative h-14 w-auto self-start" />

        <div className="relative">
          <p className="text-sm font-semibold uppercase tracking-[0.25em]" style={{ color: "var(--gold)" }}>
            Monitoring
          </p>
          <h1 className="mt-3 max-w-md text-4xl font-bold leading-tight text-white">
            Davlat mulki monitoringi
          </h1>
          <span className="mt-6 block h-1 w-16 rounded-full" style={{ background: "var(--gold)" }} />
        </div>

        <p className="relative text-xs text-white/40">© {new Date().getFullYear()} Davlat mulki</p>
      </section>

      {/* Forma */}
      <section className="flex items-center justify-center px-4 py-10 sm:px-8">
        <div className="w-full max-w-sm">
          {/* Telefonda brend forma ustida. */}
          <div
            className="mb-8 flex items-center gap-3 rounded-2xl px-5 py-4 lg:hidden"
            style={{ background: "linear-gradient(135deg, var(--navy) 0%, var(--navy-mid) 100%)" }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={withBase("/logo-dm-light.svg")} alt="Davlat mulki" className="h-9 w-auto" />
            <span className="ml-auto text-sm font-bold" style={{ color: "var(--gold)" }}>
              Monitoring
            </span>
          </div>

          <h2 className="text-2xl font-bold tracking-tight" style={{ color: "var(--navy)" }}>
            Tizimga kirish
          </h2>
          <span className="mt-3 block h-1 w-10 rounded-full" style={{ background: "var(--gold)" }} />

          {error ? (
            <p className="mt-6 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              Login yoki parol noto'g'ri
            </p>
          ) : null}

          {expired && !error ? (
            <p className="mt-6 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              Sessiya muddati tugadi yoki parol o'zgartirildi — qayta kiring.
            </p>
          ) : null}

          <form action={authenticate} className="mt-8 space-y-5">
            <div>
              <label htmlFor="username" className="mb-1.5 block text-sm font-medium text-slate-700">
                Login
              </label>
              <div className="relative">
                <UserRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input id="username" name="username" type="text" required autoComplete="username" className={INPUT} />
              </div>
            </div>
            <div>
              <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-slate-700">
                Parol
              </label>
              <div className="relative">
                <KeyRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  id="password"
                  name="password"
                  type="password"
                  required
                  autoComplete="current-password"
                  className={INPUT}
                />
              </div>
            </div>
            <button
              type="submit"
              className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg text-sm font-semibold text-white shadow-md transition hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-[var(--gold)] focus:ring-offset-2"
              style={{ background: "var(--navy)" }}
            >
              <LogIn className="h-4 w-4" />
              Kirish
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}
