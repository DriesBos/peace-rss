import type { NextConfig } from "next";
import { withSerwist } from "@serwist/turbopack";

const nextConfig: NextConfig = {
  reactCompiler: true,
  turbopack: {},
  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: [
      { protocol: "https", hostname: "**", pathname: "**" },
      { protocol: "http", hostname: "**", pathname: "**" },
    ],
  },
  webpack: (config) => {
    // Add rule for .glsl files
    config.module.rules.push({
      test: /\.(glsl|vs|fs|vert|frag)$/,
      exclude: /node_modules/,
      use: ['raw-loader'],
    });

    return config;
  },
};

export default withSerwist(nextConfig);
