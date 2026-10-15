import type { Request } from "react-router";

function secretsFromEnv(): string[] {
  return [process.env.CRON_SECRET, process.env.CACHE_CRON_SECRET].filter(
    (value): value is string => Boolean(value && value.length > 0),
  );
}

export function isCacheCronAuthorized(request: Request): boolean {
  if (request.headers.get("x-vercel-cron") === "1") return true;
  if ((request.headers.get("user-agent") || "").startsWith("vercel-cron/")) return true;

  const bearer = request.headers.get("authorization") || "";
  const header = request.headers.get("x-cron-secret") || "";
  return secretsFromEnv().some(
    (secret) => bearer === `Bearer ${secret}` || header === secret,
  );
}
