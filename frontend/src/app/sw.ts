/// <reference no-default-lib="true" />
/// <reference lib="esnext" />
/// <reference lib="webworker" />

import { defaultCache } from "@serwist/turbopack/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import {
  CacheableResponsePlugin,
  ExpirationPlugin,
  NetworkFirst,
  Serwist,
} from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: Array<PrecacheEntry | string>;
  }
}

declare const self: ServiceWorkerGlobalScope;

const apiRuntimeCache = {
  matcher: ({
    request,
    sameOrigin,
    url,
  }: {
    request: Request;
    sameOrigin: boolean;
    url: URL;
  }) =>
    sameOrigin &&
    request.method === "GET" &&
    url.pathname.startsWith("/api/"),
  handler: new NetworkFirst({
    cacheName: "api-cache",
    networkTimeoutSeconds: 3,
    plugins: [
      new CacheableResponsePlugin({ statuses: [200] }),
      new ExpirationPlugin({
        maxEntries: 200,
        maxAgeSeconds: 7 * 24 * 60 * 60,
      }),
    ],
  }),
};

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  runtimeCaching: [apiRuntimeCache, ...defaultCache],
  navigationPreload: true,
  skipWaiting: true,
  clientsClaim: true,
});

serwist.addEventListeners();
