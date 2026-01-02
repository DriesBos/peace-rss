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

export async function GET() {
  try {
    const { baseUrl, token } = getMinifluxConfig();

    const res = await fetch(`${baseUrl}/v1/feeds`, {
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


