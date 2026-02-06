import { createSerwistRoute } from "@serwist/turbopack";
import nextConfig from "../../../../next.config";

export const {
  dynamic,
  dynamicParams,
  revalidate,
  generateStaticParams,
  GET,
} = createSerwistRoute({
  swSrc: "src/app/sw.ts",
  additionalPrecacheEntries: ["/"],
  nextConfig,
  useNativeEsbuild: true,
});
