import {
  clearOwnerCookie,
  createOwnerCookie,
  isOwnerRequest,
  privateHeaders,
  verifyOwnerPassword,
} from "../server/ownerAuth";

function json(body: Record<string, string>, status: number, extraHeaders?: Record<string, string>): Response {
  return Response.json(body, {
    status,
    headers: privateHeaders(extraHeaders),
  });
}

export async function authFetch(request: Request): Promise<Response> {
  if (request.method === "GET") {
    return (await isOwnerRequest(request))
      ? new Response(null, { status: 204, headers: privateHeaders() })
      : json({ error: "Private access required." }, 401);
  }

  if (request.method === "POST") {
    let password: unknown;
    try {
      const body = (await request.json()) as { password?: unknown };
      password = body.password;
    } catch {
      return json({ error: "Invalid request." }, 400);
    }

    if (!(await verifyOwnerPassword(password))) {
      await new Promise((resolve) => setTimeout(resolve, 350));
      return json({ error: "Wrong private-access password." }, 401);
    }

    return json(
      { ok: "true" },
      200,
      { "Set-Cookie": createOwnerCookie(password as string, request) },
    );
  }

  if (request.method === "DELETE") {
    return new Response(null, {
      status: 204,
      headers: privateHeaders({ "Set-Cookie": clearOwnerCookie(request) }),
    });
  }

  return json({ error: "Method not allowed." }, 405, { Allow: "GET, POST, DELETE" });
}

export default { fetch: authFetch };
