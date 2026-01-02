import { NextResponse } from "next/server";

export const runtime = "nodejs";

function getMinifluxConfig() {
  const baseUrl = process.env.MINIFLUX_BASE_URL;
  const token = process.env.MINIFLUX_API_TOKEN;
  if (!baseUrl || !token) {
    throw new Error("Missing MINIFLUX_BASE_URL or MINIFLUX_API_TOKEN");
  }
  return { baseUrl: baseUrl.replace(/\/+$/, ""), token };
}

function getStringParam(
  url: URL,
  key: string,
  defaultValue: string,
): string {
  const value = url.searchParams.get(key);
  return value && value.trim().length > 0 ? value : defaultValue;
}

function getNumberParam(url: URL, key: string, defaultValue: number): number {
  const value = url.searchParams.get(key);
  if (!value) return defaultValue;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : defaultValue;
}

export async function GET(request: Request) {
  try {
    const { baseUrl, token } = getMinifluxConfig();
    const url = new URL(request.url);

    const status = getStringParam(url, "status", "unread");
    const limit = getNumberParam(url, "limit", 50);
    const offset = getNumberParam(url, "offset", 0);
    const order = getStringParam(url, "order", "published_at");
    const direction = getStringParam(url, "direction", "desc");

    const qs = new URLSearchParams({
      status,
      limit: String(limit),
      offset: String(offset),
      order,
      direction,
    });

    const res = await fetch(`${baseUrl}/v1/entries?${qs.toString()}`, {
      method: "GET",
      headers: {
        "X-Auth-Token": token,
        Accept: "application/json",
      },
      cache: "no-store",
    });

    const text = await res.text();
    return new NextResponse(text, {
      status: res.status,
      headers: {
        "Content-Type": res.headers.get("content-type") ?? "application/json",
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 },
    );
  }
}


