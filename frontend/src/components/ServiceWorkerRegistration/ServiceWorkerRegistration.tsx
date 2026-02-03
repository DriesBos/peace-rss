"use client";

import { useEffect } from "react";

const ServiceWorkerRegistration = () => {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") {
      return;
    }

    if (!("serviceWorker" in navigator)) {
      return;
    }

    const handleLoad = () => {
      navigator.serviceWorker.register("/sw.js").catch((error) => {
        // Keep this minimal; we rely on browser install UI rather than custom flows.
        console.error("Service worker registration failed:", error);
      });
    };

    window.addEventListener("load", handleLoad);

    return () => {
      window.removeEventListener("load", handleLoad);
    };
  }, []);

  return null;
};

export default ServiceWorkerRegistration;
