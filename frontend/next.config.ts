import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  images: {
    formats: ["image/avif", "image/webp"],
    // ponytail: wildcard hosts — RSS entries embed images from arbitrary
    // domains, so the optimizer must accept any host. Tighten only if you
    // proxy/allowlist feed images upstream.
    remotePatterns: [
      { protocol: "https", hostname: "**", pathname: "**" },
      { protocol: "http", hostname: "**", pathname: "**" },
    ],
  },
};

export default nextConfig;
