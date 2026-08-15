const XAI_API_ORIGIN = "https://api.x.ai";
const XAI_MEDIA_HOSTS = new Set(["imgen.x.ai", "vidgen.x.ai"]);

export type AllowedTarget = {
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
