import { isOwnerRequest, privateHeaders } from "../server/ownerAuth";
import { classifyTargetUrl } from "../server/proxyPolicy";

/**
 * Private same-origin proxy for the small xAI API allowlist and ephemeral xAI media.
 * Every request requires the owner's HttpOnly access cookie.
 */
const MAX_API_REQUEST_BYTES = 3_750_000;

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
