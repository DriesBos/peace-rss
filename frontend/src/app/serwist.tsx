"use client";

import type { ReactNode } from "react";
import { SerwistProvider as SerwistProviderBase } from "@serwist/turbopack/react";

type SerwistProviderProps = {
  children: ReactNode;
};

const SW_URL = "/serwist/sw.js";

export function SerwistProvider({ children }: SerwistProviderProps) {
  if (process.env.NODE_ENV !== "production") {
    return <>{children}</>;
  }

  return <SerwistProviderBase swUrl={SW_URL}>{children}</SerwistProviderBase>;
}
