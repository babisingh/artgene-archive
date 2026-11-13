import { NextRequest, NextResponse } from "next/server";

// API_URL             -> tinsel-api service URL (e.g. https://tinsel-api.up.railway.app)
// PUBLIC_READ_API_KEY -> a key carrying read:public and nothing else.
//
// SECURITY: this proxy runs on the server, so any key it attaches is available
// to every anonymous visitor who can reach the route. It therefore attaches a
// server-side key ONLY to the allowlisted public read paths below, and ONLY on
// GET. Every other path and method must carry the caller's own key, which is
// forwarded untouched. Before this allowlist existed the proxy attached the
// server key to every request, including POST /register and
// POST /certificates/{id}/revoke, which made both reachable anonymously.
const API_URL = process.env.API_URL ?? "http://localhost:8000";
const PUBLIC_READ_API_KEY =
  process.env.PUBLIC_READ_API_KEY ?? process.env.API_KEY ?? "";

// Paths, relative to /api/v1/, that the public catalogue pages need in order to
// render for an anonymous visitor: the list and one record by accession.
//
// Everything else is absent on purpose. /health/detail reports the environment
// the API runs in. The catalogue POST routes draft and publish records, and
// /submissions/outbox holds drafted letters with submitters' addresses in them,
// so each needs the caller's own key. POST /submissions is open by design and
// needs no key at all, so it is not listed here either: this allowlist only
// decides which GETs get the server's read key attached.
const PUBLIC_GET_PATHS: RegExp[] = [
  /^health$/,
  /^catalogue$/,
  /^catalogue\/AGC?-\d{4}-\d{6}$/,
];

function isPublicGet(method: string, path: string): boolean {
  if (method !== "GET") return false;
  return PUBLIC_GET_PATHS.some((re) => re.test(path));
}

async function proxy(
  req: NextRequest,
  context: { params: Promise<{ path: string[] }> },
  method: string,
): Promise<NextResponse> {
  const { path } = await context.params;
  const joined = path.join("/");

  // FastAPI's collection routes are declared with a trailing slash, so dropping
  // it here would earn a 307 from upstream on every list call. Preserve
  // whatever the caller sent.
  const trailing = req.nextUrl.pathname.endsWith("/") ? "/" : "";
  const targetUrl = new URL(`${API_URL}/api/v1/${joined}${trailing}`);
  targetUrl.search = req.nextUrl.search;

  const headers: Record<string, string> = {};

  // A key supplied by the caller is always forwarded: that is how an operator
  // performs writes. The server key is a fallback for public reads only.
  const callerKey = req.headers.get("x-api-key");
  if (callerKey) {
    headers["x-api-key"] = callerKey;
  } else if (isPublicGet(method, joined) && PUBLIC_READ_API_KEY) {
    headers["x-api-key"] = PUBLIC_READ_API_KEY;
  }

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
