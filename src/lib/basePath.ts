// Ilova production'da reverse-proxy ortida `davijara.uz/obyektlar` sub-path ostida ishlaydi
// (o'sha domenda ildizda — boshqa ilova). Dev'da (`npm run dev`) — avvalgidek ildizda (bo'sh satr).
//
// `next/link`, `redirect()` / `permanentRedirect()`, `<Image>` va Server Action `<form action={fn}>`
// larni Next.js O'ZI basePath bilan prefikslaydi — ularga TEGMANG.
// Bu yordamchi FAQAT qo'lda yoziladigan mutlaq yo'llar uchun kerak:
//   - plain `<a href="/...">`  (masalan fayl yuklab olish havolalari)
//   - plain `<img src="/...">` (public/ dagi rasmlar)
//   - `signIn()/signOut()` ning `redirectTo` qiymati (Auth.js core uni mutlaq URL qiladi,
//     basePath'siz)
//   - `middleware.ts` dagi login redirect va cookie nomlari (`auth.config.ts`)
//
// ⚠️ `next.config.mjs` dagi `basePath` AYNAN shu ifodaga tayanadi — birini
//    o'zgartirsangiz ikkinchisini ham.
// Auth.js core `basePath` (`/api/auth`) esa TEGILMAYDI — Next uni route handler va
// middleware'dan avtomatik ajratadi.
//
// `process.env.NODE_ENV` — Next har bir bundle'ga (edge middleware ham) inline qiladigan
// yagona ishonchli o'zgaruvchi. `next build` uni "production" qiladi, `next dev` —
// "development". Ya'ni: prod image (Docker yoki `npm start`) → `/obyektlar`, dev → ildiz.
export const BASE_PATH = process.env.NODE_ENV === "production" ? "/obyektlar" : "";

/** Mutlaq ichki yo'lga (`/...`) basePath prefiksini qo'shadi. Tashqi URL'lar o'zgarmaydi. */
export function withBase(path: string): string {
  return path.startsWith("/") ? `${BASE_PATH}${path}` : path;
}
