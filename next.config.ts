import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      { source: "/contractors/categories", destination: "/building/categories?tab=contractors", permanent: false },
      { source: "/building/assets/categories", destination: "/building/categories?tab=assets", permanent: false },
      { source: "/cases/types", destination: "/building/categories?tab=cases", permanent: false },
    ];
  },
  devIndicators: false,
  experimental: {
    serverActions: {
      bodySizeLimit: "12mb",
    },
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
