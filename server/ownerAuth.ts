const OWNER_COOKIE = "grok_owner_session";
const OWNER_PASSWORD_SHA256 = "a5c648dc0a6c5e1fbacca64f5984e4fd7a1a91d4c1886d7a1a6e002330a6bde7";
const SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

const encoder = new TextEncoder();

function toHex(bytes: ArrayBuffer): string {
  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function sha256(value: string): Promise<string> {
  return toHex(await crypto.subtle.digest("SHA-256", encoder.encode(value)));
}

function constantTimeEqual(left: string, right: string): boolean {
  let mismatch = left.length ^ right.length;
  const length = Math.max(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    mismatch |= (left.charCodeAt(index) || 0) ^ (right.charCodeAt(index) || 0);
  }
  return mismatch === 0;
}

function readCookie(request: Request, name: string): string | null {
  const cookies = request.headers.get("cookie");
  if (!cookies) return null;

  for (const part of cookies.split(";")) {
    const separator = part.indexOf("=");
    if (separator === -1 || part.slice(0, separator).trim() !== name) continue;
    try {
      return decodeURIComponent(part.slice(separator + 1).trim());
    } catch {
      return null;
    }
  }
  return null;
}

export async function verifyPasswordDigest(password: unknown, expectedHash: string): Promise<boolean> {
  if (typeof password !== "string" || password.length < 16 || password.length > 128) return false;
  return constantTimeEqual(await sha256(password), expectedHash);
}

export async function verifyOwnerPassword(password: unknown): Promise<boolean> {
  return verifyPasswordDigest(password, OWNER_PASSWORD_SHA256);
}

export async function isOwnerRequest(request: Request): Promise<boolean> {
  return verifyOwnerPassword(readCookie(request, OWNER_COOKIE));
}

function isLocalRequest(request: Request): boolean {
  const hostname = new URL(request.url).hostname;
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
}

export function createOwnerCookie(password: string, request: Request): string {
  const secure = isLocalRequest(request) ? "" : "; Secure";
  return `${OWNER_COOKIE}=${encodeURIComponent(password)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${SESSION_MAX_AGE_SECONDS}${secure}`;
}

export function clearOwnerCookie(request: Request): string {
  const secure = isLocalRequest(request) ? "" : "; Secure";
  return `${OWNER_COOKIE}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${secure}`;
}

export function privateHeaders(extra?: Record<string, string>): Headers {
  const headers = new Headers(extra);
  headers.set("Cache-Control", "private, no-store, max-age=0");
  headers.set("Pragma", "no-cache");
  headers.set("Referrer-Policy", "no-referrer");
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Vary", "Cookie");
  return headers;
}
