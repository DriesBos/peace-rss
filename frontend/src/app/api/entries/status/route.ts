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

function isValidStatus(status: unknown): status is "read" | "unread" {
  return status === "read" || status === "unread";
}

function isNumberArray(value: unknown): value is number[] {
  if (!Array.isArray(value)) return false;
  return value.every((v) => Number.isInteger(v));
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const entryIds =
    typeof body === "object" && body !== null ? (body as any).entry_ids : null;
  const status =
    typeof body === "object" && body !== null ? (body as any).status : null;

  if (!isNumberArray(entryIds) || entryIds.length === 0) {
    return NextResponse.json(
      { error: "Missing or invalid entry_ids" },
      { status: 400 },
    );
  }

  if (!isValidStatus(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  try {
    const { baseUrl, token } = getMinifluxConfig();

    const res = await fetch(`${baseUrl}/v1/entries`, {
      method: "PUT",
      headers: {
        "X-Auth-Token": token,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ entry_ids: entryIds, status }),
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


