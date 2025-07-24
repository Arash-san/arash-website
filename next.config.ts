import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  basePath: "/arash-website",
  assetPrefix: "/arash-website",
  output: "export",
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
