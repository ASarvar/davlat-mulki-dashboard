// ⚠️ src/lib/basePath.ts dagi BASE_PATH bilan AYNAN bir xil ifoda — birini
//    o'zgartirsangiz ikkinchisini ham. `next build` NODE_ENV=production qiladi,
//    shuning uchun prod image avtomatik `/obyektlar` ostida quriladi; `next dev` — ildizda.
const basePath = process.env.NODE_ENV === "production" ? "/obyektlar" : "";

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // davijara.uz/obyektlar sub-path. Bo'sh bo'lsa (dev) — umuman qo'llanmaydi.
  basePath: basePath || undefined,
  // Docker uchun: build natijasi .next/standalone ichiga minimal server sifatida yig'iladi.
  // Windows'dagi `npm run dev` ga ta'sir qilmaydi; `npm start` ham avvalgidek ishlayveradi.
  output: "standalone",
  experimental: {
    // Server Action orqali PDF yuklash: 20MB fayl + multipart overhead uchun biroz zapas.
    serverActions: {
      bodySizeLimit: "18mb",
    },
  },
};

export default nextConfig;
