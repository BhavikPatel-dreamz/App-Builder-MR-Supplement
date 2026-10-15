import { env } from "./env.server";

/**
 * Bearer-token guard for CLI /hot-updater management + storage routes.
 * Returns a 401 Response when the Authorization header doesn't match
 * MANAGEMENT_TOKEN, or null to let the request through. The embedded
 * dashboard does not use this — it authenticates via authenticate.admin
 * and skips this check. Update-check routes stay unauthenticated.
 */
export function requireManagementToken(request: Request): Response | null {
  const header = request.headers.get("authorization") ?? "";
  const [scheme, token] = header.split(" ");

  if (scheme !== "Bearer" || !token || token !== env.managementToken) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  return null;
}
