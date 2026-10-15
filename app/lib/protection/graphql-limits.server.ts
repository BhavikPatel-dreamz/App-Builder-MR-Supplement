import { protectionConfig } from "./config.server";

export type GraphqlLimitError = {
  error: string;
  status: number;
};

export function validateGraphqlRequestLimits(input: {
  query?: string;
  variablesRaw?: string | null;
  urlLength?: number;
  viaPersistedHash?: boolean;
}): GraphqlLimitError | null {
  const { query, variablesRaw, urlLength, viaPersistedHash } = input;

  if (urlLength !== undefined && urlLength > protectionConfig.graphql.maxUrlLength) {
    return { error: "Request URL exceeds maximum length.", status: 413 };
  }

  if (protectionConfig.graphql.requirePersistedQueries && !viaPersistedHash) {
    if (query) {
      return {
        error: "Full GraphQL queries are disabled. Use GET ?sha256=<hash>&variables=…",
        status: 400,
      };
    }
  }

  if (query && query.length > protectionConfig.graphql.maxQueryLength) {
    return { error: "GraphQL query exceeds maximum length.", status: 413 };
  }

  if (
    variablesRaw &&
    variablesRaw.length > protectionConfig.graphql.maxVariablesJsonLength
  ) {
    return { error: "GraphQL variables exceed maximum size.", status: 413 };
  }

  return null;
}

export function clientIpFromRequest(request: Request): string {
  const forwarded = request.headers.get("X-Forwarded-For");
  if (forwarded) {
    return forwarded.split(",")[0]?.trim() || "unknown";
  }
  const realIp = request.headers.get("X-Real-IP");
  if (realIp) return realIp.trim();
  return "unknown";
}
