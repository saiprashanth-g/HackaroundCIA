/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    // Server Actions used for uploads / extraction triggers
    serverActions: {
      bodySizeLimit: "12mb",
    },
  },
};

export default nextConfig;
