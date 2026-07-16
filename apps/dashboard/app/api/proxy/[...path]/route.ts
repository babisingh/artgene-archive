import { NextRequest, NextResponse } from "next/server";

// Both vars are server-side runtime env vars — set them in Railway.
// API_URL  → tinsel-api service URL (e.g. https://tinsel-api.up.railway.app)
// API_KEY  → OPTIONAL shared key used ONLY for read-only (GET/HEAD) requests,
//            so a public dashboard can browse the registry without per-user
//            keys.  It is deliberately NEVER applied to state-changing requests
//            (register / revoke / publish / distributions), which require the
//            caller to supply their own key — otherwise the shared key would let
//            any anonymous visitor mutate the registry. Keep it least-privilege
//            (a read-scoped key) if you set it at all.
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

  const isReadOnly = method === "GET" || method === "HEAD";
  const browserKey = req.headers.get("x-api-key");
  // Shared server key is a fallback for READ-ONLY requests only. Writes must
  // carry a caller-supplied key.
  const apiKey = browserKey || (isReadOnly ? SERVER_API_KEY : "");

  if (!apiKey && !isReadOnly) {
    return NextResponse.json(
      {
        detail:
          "An API key is required for this operation. Set your key via " +
          '"Set API Key" in the dashboard navigation bar.',
      },
      { status: 401 },
    );
  }

  const headers: Record<string, string> = {};
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
