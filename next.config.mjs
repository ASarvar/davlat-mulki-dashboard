/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
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
