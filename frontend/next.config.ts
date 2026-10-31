import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  basePath: "/civicpulse-ai",
  trailingSlash: true,
  images: {
    unoptimized: true,
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

