import { NextRequest, NextResponse } from "next/server";

// API_URL is a server-side runtime env var — set it in Railway to point at the
// tinsel-api service (e.g. https://tinsel-api.railway.internal or the public URL).
const API_URL = process.env.API_URL ?? "http://localhost:8000";

async function proxy(
  req: NextRequest,
  context: { params: Promise<{ path: string[] }> },
  method: string,
): Promise<NextResponse> {
  const { path } = await context.params;
  const targetUrl = new URL(`${API_URL}/api/v1/${path.join("/")}`);
  targetUrl.search = req.nextUrl.search;

  const headers: Record<string, string> = {};
  const apiKey = req.headers.get("x-api-key");
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
