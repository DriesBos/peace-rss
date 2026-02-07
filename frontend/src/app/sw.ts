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

const apiNetworkErrorFallbackPlugin = {
  // Avoid unhandled `no-response` errors in the console when the API is unreachable.
  // Return a synthetic JSON response so the app can surface a useful error message.
  handlerDidError: async (param: unknown) => {
    const requestUrl =
      param &&
      typeof param === "object" &&
      "request" in param &&
      (param as { request?: unknown }).request instanceof Request
        ? (param as { request: Request }).request.url
        : "";

    return new Response(
      JSON.stringify({
        error: "API request failed (network error)",
        url: requestUrl,
      }),
      {
        status: 503,
        headers: { "Content-Type": "application/json" },
      },
    );
  },
};

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
      apiNetworkErrorFallbackPlugin,
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
