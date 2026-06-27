import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // ponytail: compiler off until existing hook-rule violations are fixed.
  reactCompiler: false,
};

export default nextConfig;
