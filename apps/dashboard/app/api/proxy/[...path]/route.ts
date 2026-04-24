import { NextRequest, NextResponse } from "next/server";

// Both vars are server-side runtime env vars — set them in Railway.
// API_URL  → tinsel-api service URL (e.g. https://tinsel-api.up.railway.app)
// API_KEY  → shared API key injected into every proxied request
const API_URL = process.env.API_URL ?? "http://localhost:8000";
const SERVER_API_KEY = process.env.API_KEY ?? "";

async function proxy(
  req: NextRequest,
  context: { params: Promise<{ path: string[] }> },
  method: string,
): Promise<NextResponse> {
  const { path } = await context.params;
  const targetUrl = new URL(`${API_URL}/api/v1/${path.join("/")}`);
  targetUrl.search = req.nextUrl.search;

  const headers: Record<string, string> = {};
  // Prefer a key explicitly provided by the browser; fall back to the
  // server-side API_KEY so the app works without per-user keys.
  const apiKey = req.headers.get("x-api-key") || SERVER_API_KEY;
  if (apiKey) headers["x-api-key"] = apiKey;
  const ct = req.headers.get("content-type");
  if (ct) headers["content-type"] = ct;

  const init: RequestInit = { method, headers };
  if (method !== "GET" && method !== "HEAD") {
    init.body = await req.arrayBuffer();
  }

  try {
    const upstream = await fetch(targetUrl.toString(), init);
    const body = await upstream.arrayBuffer();
    return new NextResponse(body, {
      status: upstream.status,
      headers: {
        "content-type":
          upstream.headers.get("content-type") ?? "application/json",
      },
    });
  } catch (err) {
    console.error("[proxy] upstream unavailable:", err);
    return NextResponse.json({ detail: "Upstream unavailable" }, { status: 502 });
  }
}

export const GET = (req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) =>
  proxy(req, ctx, "GET");

export const POST = (req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) =>
  proxy(req, ctx, "POST");
