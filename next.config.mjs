/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    // Server Action orqali PDF yuklash: 20MB fayl + multipart overhead uchun biroz zapas.
    serverActions: {
      bodySizeLimit: "24mb",
    },
  },
};

export default nextConfig;
