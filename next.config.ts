// next.config.ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* ... your existing config options ... */
  
  // This prevents Webpack from diving into the internals during the build phase
  serverExternalPackages: ["pdfjs-dist"],
};

export default nextConfig;