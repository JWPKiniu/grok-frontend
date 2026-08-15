let userApiKey: string | null = null;

const IMAGE_MODEL = "grok-imagine-image-quality";
const VIDEO_MODEL = "grok-imagine-video-1.5";
const PROXY_BASE = "/api/proxy";
const XAI_MEDIA_HOSTS = new Set(["imgen.x.ai", "vidgen.x.ai"]);
const IMAGE_REQUEST_TIMEOUT_MS = 3 * 60 * 1000;
const VIDEO_REQUEST_TIMEOUT_MS = 60 * 1000;
const VIDEO_POLL_TIMEOUT_MS = 30 * 1000;
const VIDEO_TOTAL_TIMEOUT_MS = 15 * 60 * 1000;
const VIDEO_POLL_INTERVAL_MS = 5 * 1000;

/** Set the API key from the UI input. Pass null to clear it from memory. */
export function setGrokApiKey(key: string | null): void {
  userApiKey = key?.trim() || null;
}

function getApiKey(): string {
  if (!userApiKey) throw new Error("The xAI API key is not set. Enter it again.");
  return userApiKey;
}

function proxyUrl(fullTargetUrl: string): string {
  return `${PROXY_BASE}?url=${encodeURIComponent(fullTargetUrl)}`;
}

function isAllowedMediaUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && XAI_MEDIA_HOSTS.has(url.hostname);
  } catch {
    return false;
  }
}

function privateMediaUrl(value: string): string {
  if (!isAllowedMediaUrl(value)) throw new Error("xAI returned an unsupported media URL.");
  return proxyUrl(value);
}

export interface GrokApiError extends Error {
  status?: number;
  responseBody?: string;
  responseJson?: unknown;
}

function statusMessage(status: number): string {
  switch (status) {
    case 400:
    case 422:
      return "xAI rejected the request.";
    case 401:
      return "Authentication failed. Check the private session and xAI API key.";
    case 403:
      return "xAI denied access to this model or request.";
    case 413:
      return "The uploaded image is too large for the secure proxy.";
    case 429:
      return "xAI rate limit reached. Wait a moment and try again.";
    case 500:
    case 503:
      return "xAI is temporarily unavailable. Try again shortly.";
    case 502:
    case 504:
      return "The secure proxy could not reach xAI.";
    default:
      return `The request failed (${status}).`;
  }
}

function extractApiMessage(value: unknown, depth = 0): string | null {
  if (depth > 3) return null;
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed && trimmed.length <= 300 ? trimmed : null;
  }
  if (!value || typeof value !== "object") return null;

  const object = value as Record<string, unknown>;
  for (const key of ["error", "message", "detail"]) {
    const message = extractApiMessage(object[key], depth + 1);
    if (message) return message;
  }
  return null;
}

function getErrorMessage(error: unknown): string {
  if (error && typeof error === "object" && "status" in error) {
    const apiError = error as GrokApiError;
    const hint = typeof apiError.status === "number" ? statusMessage(apiError.status) : "Request failed.";
    let detail = extractApiMessage(apiError.responseJson);
    if (!detail && apiError.responseBody) {
      try {
        detail = extractApiMessage(JSON.parse(apiError.responseBody) as unknown);
      } catch {
        detail = extractApiMessage(apiError.responseBody);
      }
    }
    return detail && !hint.toLowerCase().includes(detail.toLowerCase()) ? `${hint} ${detail}` : hint;
  }

  if (error instanceof DOMException && error.name === "AbortError") {
    return "The request timed out. Try again.";
  }
  if (error instanceof TypeError && /fetch|network/i.test(error.message)) {
    return "Network error. Check the connection and try again.";
  }
  if (error instanceof Error) return error.message;
  return "Request failed.";
}

function apiError(status: number, body: string): GrokApiError {
  const error = new Error(`Request failed: ${status}`) as GrokApiError;
  error.status = status;
  error.responseBody = body || undefined;
  if (body) {
    try {
      error.responseJson = JSON.parse(body) as unknown;
    } catch {
      // Plain-text upstream response.
    }
  }
  return error;
}

async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    window.clearTimeout(timeout);
  }
}

async function xaiPostRaw(
  path: "/images/generations" | "/images/edits" | "/videos/generations",
  body: Record<string, unknown>,
  timeoutMs: number,
): Promise<string> {
  const response = await fetchWithTimeout(
    proxyUrl(`https://api.x.ai/v1${path}`),
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${getApiKey()}`,
      },
      body: JSON.stringify(body),
      credentials: "same-origin",
      cache: "no-store",
    },
    timeoutMs,
  );

  const text = await response.text();
  if (!response.ok) throw apiError(response.status, text);
  return text;
}

function detectImageMime(base64: string): string {
  if (base64.startsWith("/9j/")) return "image/jpeg";
  if (base64.startsWith("iVBOR")) return "image/png";
  if (base64.startsWith("UklGR")) return "image/webp";
  if (base64.startsWith("R0lGOD")) return "image/gif";
  return "image/jpeg";
}

export type ImageGenOutcome =
  | { kind: "success"; resultUrl: string }
  | { kind: "unknown_error"; message: string };

/** Accept both current URL responses and Base64 responses for backwards compatibility. */
export function processImageGenerationResponse(rawText: string): ImageGenOutcome {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawText) as unknown;
  } catch {
    return { kind: "unknown_error", message: "xAI returned an unreadable image response." };
  }

  if (parsed && typeof parsed === "object" && "data" in parsed) {
    const response = parsed as {
      data?: Array<{ b64_json?: string; mime_type?: string; url?: string }>;
    };
    const first = response.data?.[0];
    if (typeof first?.b64_json === "string" && first.b64_json) {
      const mime = typeof first.mime_type === "string" && /^image\/[a-z0-9+.-]+$/i.test(first.mime_type)
        ? first.mime_type
        : detectImageMime(first.b64_json);
      return { kind: "success", resultUrl: `data:${mime};base64,${first.b64_json}` };
    }
    if (typeof first?.url === "string" && isAllowedMediaUrl(first.url)) {
      return { kind: "success", resultUrl: privateMediaUrl(first.url) };
    }
  }

  return {
    kind: "unknown_error",
    message: extractApiMessage(parsed) ?? "xAI returned an image response without an image.",
  };
}

export async function textToImage(prompt: string): Promise<string> {
  try {
    const text = await xaiPostRaw(
      "/images/generations",
      {
        model: IMAGE_MODEL,
        prompt: prompt.trim(),
        response_format: "url",
        n: 1,
      },
      IMAGE_REQUEST_TIMEOUT_MS,
    );
    const outcome = processImageGenerationResponse(text);
    if (outcome.kind === "success") return outcome.resultUrl;
    throw new Error(outcome.message);
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}

export async function imageEdit(prompt: string, imageDataUri: string): Promise<string> {
  try {
    const text = await xaiPostRaw(
      "/images/edits",
      {
        model: IMAGE_MODEL,
        prompt: prompt.trim(),
        image: { url: imageDataUri, type: "image_url" },
        response_format: "url",
        n: 1,
      },
      IMAGE_REQUEST_TIMEOUT_MS,
    );
    const outcome = processImageGenerationResponse(text);
    if (outcome.kind === "success") return outcome.resultUrl;
    throw new Error(outcome.message);
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}

export type VideoPollOutcome =
  | { kind: "pending" }
  | { kind: "success"; videoUrl: string }
  | { kind: "known_error"; message: string }
  | { kind: "unknown_error"; message: string };

export function processVideoPollResponse(rawText: string): VideoPollOutcome {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawText) as unknown;
  } catch {
    return { kind: "unknown_error", message: "xAI returned an unreadable video response." };
  }
  if (!parsed || typeof parsed !== "object") {
    return { kind: "unknown_error", message: "xAI returned an invalid video response." };
  }

  const data = parsed as {
    status?: string;
    video?: { url?: string };
    error?: unknown;
    message?: unknown;
  };
  const status = data.status?.toLowerCase();

  if (["pending", "processing", "queued", "running"].includes(status ?? "")) {
    return { kind: "pending" };
  }
  if (typeof data.video?.url === "string" && isAllowedMediaUrl(data.video.url)) {
    return { kind: "success", videoUrl: privateMediaUrl(data.video.url) };
  }
  if (["failed", "expired", "cancelled", "canceled"].includes(status ?? "") || data.error) {
    return {
      kind: "known_error",
      message: extractApiMessage(data.error)
        ?? extractApiMessage(data.message)
        ?? `Video generation ${status || "failed"}.`,
    };
  }
  if (status === "done") {
    return { kind: "known_error", message: "xAI finished the request without a video URL." };
  }
  return { kind: "unknown_error", message: "xAI returned an unknown video status." };
}

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}

export async function imageToVideo(
  prompt: string,
  imageDataUri: string,
  options?: { duration?: number; resolution?: string },
): Promise<string> {
  try {
    const startText = await xaiPostRaw(
      "/videos/generations",
      {
        model: VIDEO_MODEL,
        prompt: prompt.trim(),
        image: { url: imageDataUri },
        duration: options?.duration ?? 5,
        resolution: options?.resolution === "720p" ? "720p" : "480p",
      },
      VIDEO_REQUEST_TIMEOUT_MS,
    );

    let startData: { request_id?: unknown };
    try {
      startData = JSON.parse(startText) as { request_id?: unknown };
    } catch {
      throw new Error("xAI returned an unreadable video-start response.");
    }
    if (typeof startData.request_id !== "string" || !startData.request_id) {
      throw new Error("xAI did not return a video request ID.");
    }

    const startedAt = Date.now();
    while (Date.now() - startedAt < VIDEO_TOTAL_TIMEOUT_MS) {
      await wait(VIDEO_POLL_INTERVAL_MS);
      const response = await fetchWithTimeout(
        proxyUrl(`https://api.x.ai/v1/videos/${encodeURIComponent(startData.request_id)}`),
        {
          method: "GET",
          headers: { Authorization: `Bearer ${getApiKey()}` },
          credentials: "same-origin",
          cache: "no-store",
        },
        VIDEO_POLL_TIMEOUT_MS,
      );
      const text = await response.text();

      if (response.status === 429 || response.status === 502 || response.status === 503) continue;
      if (!response.ok) throw apiError(response.status, text);

      const outcome = processVideoPollResponse(text);
      if (outcome.kind === "pending") continue;
      if (outcome.kind === "success") return outcome.videoUrl;
      throw new Error(outcome.message);
    }

    throw new Error("Video generation took longer than 15 minutes and was stopped.");
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}
