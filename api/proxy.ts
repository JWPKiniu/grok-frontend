import { isOwnerRequest, privateHeaders } from "../server/ownerAuth.ts";

/**
 * Private same-origin proxy for the small xAI API allowlist and ephemeral xAI media.
 * Every request requires the owner's HttpOnly access cookie.
 */
const XAI_API_ORIGIN = "https://api.x.ai";
const XAI_MEDIA_HOSTS = new Set(["imgen.x.ai", "vidgen.x.ai"]);
const MAX_API_REQUEST_BYTES = 3_750_000;

type AllowedTarget = {
  kind: "api" | "media";
  url: URL;
};

function isVideoPollPath(pathname: string): boolean {
  return /^\/v1\/videos\/[A-Za-z0-9_-]+$/.test(pathname);
}

function isAllowedApiRequest(url: URL, method: string): boolean {
  if (method === "POST") {
    return url.pathname === "/v1/images/generations"
      || url.pathname === "/v1/images/edits"
      || url.pathname === "/v1/videos/generations";
  }
  return (method === "GET" || method === "HEAD") && isVideoPollPath(url.pathname);
}

export function classifyTargetUrl(targetUrl: string, method: string): AllowedTarget | null {
  try {
    const url = new URL(targetUrl);
    if (url.protocol !== "https:" || url.username || url.password || url.hash) return null;

    if (XAI_MEDIA_HOSTS.has(url.hostname) && (method === "GET" || method === "HEAD")) {
      return { kind: "media", url };
    }
    if (url.origin === XAI_API_ORIGIN && isAllowedApiRequest(url, method)) {
      return { kind: "api", url };
    }
  } catch {
    // Invalid URL.
  }
  return null;
}

function textResponse(message: string, status: number, extraHeaders?: Record<string, string>): Response {
  const headers = privateHeaders(extraHeaders);
  headers.set("Content-Type", "text/plain; charset=utf-8");
  return new Response(message, {
    status,
    headers,
  });
}

function copyUpstreamHeaders(source: Headers): Headers {
  const headers = privateHeaders();
  for (const name of [
    "content-length",
    "content-type",
  ]) {
    const value = source.get(name);
    if (value) headers.set(name, value);
  }
  return headers;
}

function handOffMedia(target: URL): Response {
  return new Response(null, {
    status: 307,
    headers: privateHeaders({ Location: target.href }),
  });
}

async function proxyApi(request: Request, target: URL): Promise<Response> {
  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(contentLength) && contentLength > MAX_API_REQUEST_BYTES) {
    return textResponse("Image payload is too large. Choose the image again so it can be optimized.", 413);
  }

  const headers = new Headers();
  for (const name of ["authorization", "content-type"]) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }

  let body: ArrayBuffer | undefined;
  if (request.method === "POST") {
    body = await request.arrayBuffer();
    if (body.byteLength > MAX_API_REQUEST_BYTES) {
      return textResponse("Image payload is too large. Choose the image again so it can be optimized.", 413);
    }
  }

  try {
    const upstream = await fetch(target, {
      method: request.method,
      headers,
      body,
      signal: request.signal,
    });
    return new Response(request.method === "HEAD" ? null : upstream.body, {
      status: upstream.status,
      headers: copyUpstreamHeaders(upstream.headers),
    });
  } catch {
    return textResponse("xAI network error.", 502);
  }
}

export async function proxyFetch(request: Request): Promise<Response> {
  if (!(await isOwnerRequest(request))) return textResponse("Private access required.", 401);

  const requestUrl = new URL(request.url);
  const targetUrl = requestUrl.searchParams.get("url");
  if (!targetUrl) return textResponse("Not found.", 404);

  const target = classifyTargetUrl(targetUrl, request.method);
  if (!target) return textResponse("Target or method is not allowed.", 400);

  return target.kind === "media"
    ? handOffMedia(target.url)
    : proxyApi(request, target.url);
}

export default { fetch: proxyFetch };
