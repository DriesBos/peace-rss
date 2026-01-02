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

function parseNumericId(id: string) {
  const n = Number(id);
  if (!Number.isInteger(n) || n <= 0) return null;
  return n;
}

export async function POST(
  _request: Request,
  context: { params: { id: string } },
) {
  const { id } = context.params;
  const numericId = parseNumericId(id);
  if (!numericId) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  try {
    const { baseUrl, token } = getMinifluxConfig();

    const res = await fetch(`${baseUrl}/v1/entries/${numericId}/bookmark`, {
      method: "PUT",
      headers: {
        "X-Auth-Token": token,
        Accept: "application/json",
      },
      cache: "no-store",
    });

    if (!res.ok) {
      const text = await res.text();
      return new NextResponse(text, {
        status: res.status,
        headers: {
          "Content-Type": res.headers.get("content-type") ?? "application/json",
        },
      });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 },
    );
  }
}


