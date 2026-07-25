/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    // Server Action orqali PDF yuklash: 20MB fayl + multipart overhead uchun biroz zapas.
    serverActions: {
      bodySizeLimit: "18mb",
    },
  },
};

export default nextConfig;
