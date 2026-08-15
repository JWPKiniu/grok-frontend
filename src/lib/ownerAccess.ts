const AUTH_ENDPOINT = "/api/auth";

async function readError(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { error?: unknown };
    if (typeof body.error === "string") return body.error;
  } catch {
    // The generic message below is safer than exposing a raw server response.
  }
  return "Private-access check failed.";
}

export async function hasOwnerAccess(signal?: AbortSignal): Promise<boolean> {
  const response = await fetch(AUTH_ENDPOINT, {
    method: "GET",
    credentials: "same-origin",
    cache: "no-store",
    signal,
  });
  if (response.status === 401) return false;
  if (!response.ok) throw new Error(await readError(response));
  return true;
}

export async function unlockOwnerAccess(password: string): Promise<void> {
  const response = await fetch(AUTH_ENDPOINT, {
    method: "POST",
    credentials: "same-origin",
    cache: "no-store",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password }),
  });
  if (!response.ok) throw new Error(await readError(response));
}

export async function lockOwnerAccess(): Promise<void> {
  const response = await fetch(AUTH_ENDPOINT, {
    method: "DELETE",
    credentials: "same-origin",
    cache: "no-store",
  });
  if (!response.ok) throw new Error(await readError(response));
}
