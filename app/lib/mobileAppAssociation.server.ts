/**
 * Registers Android App Links and iOS Universal Links with Shopify.
 * Shopify hosts /.well-known/assetlinks.json and apple-app-site-association
 * on the shop's primary domain. This module does not host those files.
 *
 * Admin API version comes from the authenticated admin client
 * (app/shopify.server.ts). Queries and mutations follow the 2025-10
 * mobilePlatformApplication operations.
 */

import {
  buildAppleAppId,
  collectFormatIssues,
  evaluateAppleAppSiteAssociation,
  evaluateAssetLinks,
  isSha256Fingerprint,
  isValidAppId,
  isValidBundleId,
  isValidPackageName,
  isValidTeamId,
  normalizeFingerprint,
  normalizeShopHost,
  readMobileAppConfig,
  type AssociationExpected,
  type FileCheck,
  type MobileAppConfig,
} from "./mobile-app-association";

export {
  buildAppleAppId,
  isSha256Fingerprint,
  isValidAppId,
  isValidBundleId,
  isValidPackageName,
  isValidTeamId,
  normalizeFingerprint,
  normalizeShopHost,
  readMobileAppConfig,
};
export type { AssociationExpected, FileCheck, MobileAppConfig };

export const SCOPE_NOT_ENABLED_MESSAGE =
  "Shopify has not enabled mobile platform application access for this app. Ask Shopify Support to enable the write_mobile_platform_applications and read_mobile_platform_applications scopes, then reinstall the app or approve the updated access so this shop grants them.";

const HEADLESS_DETAIL =
  "If this storefront is not served by Shopify (for example Next.js on Vercel), proxy or rewrite /.well-known/* to the Shopify-hosted domain, or host assetlinks.json and apple-app-site-association on the frontend.";

export class MobileAppAssociationError extends Error {
  readonly code: "access_denied" | "user_error" | "graphql" | "config" | "throttle";

  constructor(message: string, code: MobileAppAssociationError["code"]) {
    super(message);
    this.name = "MobileAppAssociationError";
    this.code = code;
  }
}

export type AdminGraphqlClient = {
  graphql: (
    query: string,
    options?: { variables?: Record<string, unknown> },
  ) => Promise<Response>;
};

export type AndroidApplicationRecord = {
  id: string;
  platform: "android";
  applicationId: string;
  sha256CertFingerprints: string[];
  appLinksEnabled: boolean;
};

export type AppleApplicationRecord = {
  id: string;
  platform: "apple";
  appId: string;
  universalLinksEnabled: boolean;
  sharedWebCredentialsEnabled: boolean;
  appClipsEnabled: boolean;
};

export type MobileAppList = {
  android: AndroidApplicationRecord[];
  apple: AppleApplicationRecord[];
};

export type AndroidUpsertInput = {
  applicationId: string;
  sha256CertFingerprints: string[];
  appLinksEnabled?: boolean;
};

export type AppleUpsertInput = {
  appId?: string;
  teamId?: string;
  bundleId?: string;
  universalLinksEnabled?: boolean;
  sharedWebCredentialsEnabled?: boolean;
  appClipsEnabled?: boolean;
};

export type ShopDomains = {
  primaryHost: string;
  myshopifyHost: string;
  primaryUrl: string;
};

export type DomainVerification = {
  host: string;
  assetLinks: FileCheck;
  appleAppSiteAssociation: FileCheck;
};

type GraphqlError = {
  message?: string;
  extensions?: { code?: string };
};

type GraphqlPayload<T> = {
  data?: T;
  errors?: GraphqlError[];
};

type UserError = {
  field?: string[] | null;
  message?: string | null;
  code?: string | null;
};

type RawNode = {
  __typename?: string;
  id?: string;
  applicationId?: string | null;
  sha256CertFingerprints?: string[] | null;
  appLinksEnabled?: boolean | null;
  appId?: string | null;
  universalLinksEnabled?: boolean | null;
  sharedWebCredentialsEnabled?: boolean | null;
  appClipsEnabled?: boolean | null;
};

export const mobileAppAssociationTiming = {
  retryDelayMs(attempt: number): number {
    return 200 * 2 ** attempt;
  },
};

const startupIssues = collectFormatIssues(process.env);
if (startupIssues.length > 0) {
  console.error(`[mobile-app-association] ${startupIssues.join(" ")}`);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isAccessDenied(errors: GraphqlError[] | undefined): boolean {
  return (errors ?? []).some((error) => {
    const code = error.extensions?.code ?? "";
    const message = error.message ?? "";
    return (
      code === "ACCESS_DENIED" ||
      /access denied/i.test(message) ||
      /required access:/i.test(message)
    );
  });
}

function isThrottled(errors: GraphqlError[] | undefined, status: number): boolean {
  if (status === 429) return true;
  return (errors ?? []).some((error) => {
    const code = error.extensions?.code ?? "";
    const message = error.message ?? "";
    return code === "THROTTLED" || /throttl/i.test(message);
  });
}

async function adminGraphql<T>(
  admin: AdminGraphqlClient,
  query: string,
  variables?: Record<string, unknown>,
): Promise<T> {
  const maxAttempts = 4;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const response = await admin.graphql(query, variables ? { variables } : undefined);
    const json = await readGraphqlPayload<T>(response);

    if (isAccessDenied(json.errors)) {
      throw new MobileAppAssociationError(SCOPE_NOT_ENABLED_MESSAGE, "access_denied");
    }
    if (isThrottled(json.errors, response.status) && attempt < maxAttempts - 1) {
      await sleep(mobileAppAssociationTiming.retryDelayMs(attempt));
      continue;
    }
    if (isThrottled(json.errors, response.status)) {
      throw new MobileAppAssociationError(
        "Shopify throttled the Admin API request. Wait a moment and try again.",
        "throttle",
      );
    }
    if (json.errors?.length) {
      const message = json.errors.map((error) => error.message).filter(Boolean).join("; ");
      throw new MobileAppAssociationError(
        message || "Shopify Admin API request failed.",
        "graphql",
      );
    }
    if (!json.data) {
      throw new MobileAppAssociationError("Shopify Admin API returned no data.", "graphql");
    }
    return json.data;
  }

  throw new MobileAppAssociationError(
    "Shopify throttled the Admin API request. Wait a moment and try again.",
    "throttle",
  );
}

async function readGraphqlPayload<T>(response: Response): Promise<GraphqlPayload<T>> {
  const text = await response.text();
  if (!text) {
    if (response.status === 429) {
      return { errors: [{ message: "Throttled", extensions: { code: "THROTTLED" } }] };
    }
    return { errors: [{ message: `Shopify returned HTTP ${response.status}.` }] };
  }
  try {
    return JSON.parse(text) as GraphqlPayload<T>;
  } catch {
    throw new MobileAppAssociationError("Shopify returned a non-JSON response.", "graphql");
  }
}

function assertNoUserErrors(errors: UserError[] | null | undefined, fallback: string) {
  if (!errors?.length) return;
  const denied = errors.some(
    (error) =>
      error.code === "ACCESS_DENIED" || /access denied|required access:/i.test(error.message ?? ""),
  );
  if (denied) {
    throw new MobileAppAssociationError(SCOPE_NOT_ENABLED_MESSAGE, "access_denied");
  }
  const message = errors
    .map((error) => {
      const field = error.field?.filter(Boolean).join(".");
      const text = error.message?.trim() || error.code || fallback;
      return field ? `${field}: ${text}` : text;
    })
    .join("; ");
  throw new MobileAppAssociationError(message || fallback, "user_error");
}

function requireAndroidInput(input?: AndroidUpsertInput): {
  applicationId: string;
  sha256CertFingerprints: string[];
  appLinksEnabled: boolean;
} {
  const config = readMobileAppConfig();
  const applicationId = (input?.applicationId ?? config.packageName).trim();
  const fingerprints = (input?.sha256CertFingerprints ?? config.fingerprints)
    .map(normalizeFingerprint)
    .filter(Boolean);
  const unique = [...new Set(fingerprints)];
  const issues: string[] = [];
  if (!isValidPackageName(applicationId)) {
    issues.push("Android package name is missing or invalid.");
  }
  if (!unique.length) issues.push("Add at least one SHA-256 certificate fingerprint.");
  unique.forEach((fingerprint, index) => {
    if (!isSha256Fingerprint(fingerprint)) {
      issues.push(`Fingerprint ${index + 1} must be 32 colon-separated uppercase hex bytes.`);
    }
  });
  if (issues.length) {
    throw new MobileAppAssociationError(issues.join(" "), "config");
  }
  return {
    applicationId,
    sha256CertFingerprints: unique,
    appLinksEnabled: input?.appLinksEnabled ?? true,
  };
}

function requireAppleInput(input?: AppleUpsertInput): {
  appId: string;
  universalLinksEnabled: boolean;
  sharedWebCredentialsEnabled: boolean;
  appClipsEnabled: false;
} {
  const config = readMobileAppConfig();
  const appId = (
    input?.appId ||
    (input?.teamId || input?.bundleId
      ? buildAppleAppId(input.teamId ?? "", input.bundleId ?? "")
      : config.appId)
  ).trim();
  if (!isValidAppId(appId)) {
    throw new MobileAppAssociationError(
      "iOS app id must use TEAMID.bundle format (10-character team id, then the bundle id).",
      "config",
    );
  }
  return {
    appId,
    universalLinksEnabled: input?.universalLinksEnabled ?? true,
    sharedWebCredentialsEnabled: input?.sharedWebCredentialsEnabled ?? true,
    appClipsEnabled: false,
  };
}

const LIST_QUERY = `#graphql
  query ListMobilePlatformApplications($first: Int!, $after: String) {
    mobilePlatformApplications(first: $first, after: $after) {
      pageInfo {
        hasNextPage
        endCursor
      }
      edges {
        node {
          __typename
          id
          ... on AndroidApplication {
            applicationId
            sha256CertFingerprints
            appLinksEnabled
          }
          ... on AppleApplication {
            appId
            universalLinksEnabled
            sharedWebCredentialsEnabled
            appClipsEnabled
          }
        }
      }
    }
  }
`;

const CREATE_MUTATION = `#graphql
  mutation CreateMobilePlatformApplication($input: MobilePlatformApplicationCreateInput!) {
    mobilePlatformApplicationCreate(input: $input) {
      mobilePlatformApplication {
        __typename
        id
        ... on AndroidApplication {
          applicationId
          sha256CertFingerprints
          appLinksEnabled
        }
        ... on AppleApplication {
          appId
          universalLinksEnabled
          sharedWebCredentialsEnabled
          appClipsEnabled
        }
      }
      userErrors {
        field
        message
        code
      }
    }
  }
`;

const UPDATE_MUTATION = `#graphql
  mutation UpdateMobilePlatformApplication($id: ID!, $input: MobilePlatformApplicationUpdateInput!) {
    mobilePlatformApplicationUpdate(id: $id, input: $input) {
      mobilePlatformApplication {
        __typename
        id
        ... on AndroidApplication {
          applicationId
          sha256CertFingerprints
          appLinksEnabled
        }
        ... on AppleApplication {
          appId
          universalLinksEnabled
          sharedWebCredentialsEnabled
          appClipsEnabled
        }
      }
      userErrors {
        field
        message
        code
      }
    }
  }
`;

const DELETE_MUTATION = `#graphql
  mutation DeleteMobilePlatformApplication($id: ID!) {
    mobilePlatformApplicationDelete(id: $id) {
      deletedMobilePlatformApplicationId
      userErrors {
        field
        message
        code
      }
    }
  }
`;

const SHOP_DOMAIN_QUERY = `#graphql
  query ShopPrimaryDomain {
    shop {
      myshopifyDomain
      primaryDomain {
        host
        url
      }
    }
  }
`;

function toAndroid(node: RawNode): AndroidApplicationRecord | null {
  if (node.__typename !== "AndroidApplication" || !node.id || !node.applicationId) return null;
  return {
    id: node.id,
    platform: "android",
    applicationId: node.applicationId,
    sha256CertFingerprints: (node.sha256CertFingerprints ?? []).map(normalizeFingerprint),
    appLinksEnabled: Boolean(node.appLinksEnabled),
  };
}

function toApple(node: RawNode): AppleApplicationRecord | null {
  if (node.__typename !== "AppleApplication" || !node.id || !node.appId) return null;
  return {
    id: node.id,
    platform: "apple",
    appId: node.appId,
    universalLinksEnabled: Boolean(node.universalLinksEnabled),
    sharedWebCredentialsEnabled: Boolean(node.sharedWebCredentialsEnabled),
    appClipsEnabled: Boolean(node.appClipsEnabled),
  };
}

export async function listMobileApps(admin: AdminGraphqlClient): Promise<MobileAppList> {
  const android: AndroidApplicationRecord[] = [];
  const apple: AppleApplicationRecord[] = [];
  let after: string | null = null;

  for (let page = 0; page < 10; page++) {
    const data: {
      mobilePlatformApplications: {
        pageInfo: { hasNextPage: boolean; endCursor: string | null };
        edges: Array<{ node: RawNode }>;
      };
    } = await adminGraphql(admin, LIST_QUERY, { first: 50, after });
    const connection = data.mobilePlatformApplications;
    for (const edge of connection.edges ?? []) {
      const androidApp = toAndroid(edge.node);
      const appleApp = toApple(edge.node);
      if (androidApp) android.push(androidApp);
      if (appleApp) apple.push(appleApp);
    }
    if (!connection.pageInfo?.hasNextPage || !connection.pageInfo.endCursor) break;
    after = connection.pageInfo.endCursor;
  }

  return { android, apple };
}

function pickAndroid(apps: AndroidApplicationRecord[], applicationId: string) {
  return apps.find((app) => app.applicationId === applicationId) ?? apps[0] ?? null;
}

function pickApple(apps: AppleApplicationRecord[], appId: string) {
  return apps.find((app) => app.appId === appId) ?? apps[0] ?? null;
}

export async function upsertAndroidApp(
  admin: AdminGraphqlClient,
  input?: AndroidUpsertInput,
): Promise<AndroidApplicationRecord> {
  const android = requireAndroidInput(input);
  const existing = pickAndroid((await listMobileApps(admin)).android, android.applicationId);
  const variables = existing
    ? { id: existing.id, input: { android } }
    : { input: { android } };
  const query = existing ? UPDATE_MUTATION : CREATE_MUTATION;
  const data = await adminGraphql<
    | {
        mobilePlatformApplicationUpdate: {
          mobilePlatformApplication: RawNode | null;
          userErrors: UserError[];
        };
      }
    | {
        mobilePlatformApplicationCreate: {
          mobilePlatformApplication: RawNode | null;
          userErrors: UserError[];
        };
      }
  >(admin, query, variables);

  const payload =
    "mobilePlatformApplicationUpdate" in data
      ? data.mobilePlatformApplicationUpdate
      : data.mobilePlatformApplicationCreate;
  assertNoUserErrors(payload.userErrors, "Shopify could not save the Android app.");
  const record = payload.mobilePlatformApplication ? toAndroid(payload.mobilePlatformApplication) : null;
  if (!record) {
    throw new MobileAppAssociationError("Shopify did not return the Android app.", "graphql");
  }
  return record;
}

export async function upsertAppleApp(
  admin: AdminGraphqlClient,
  input?: AppleUpsertInput,
): Promise<AppleApplicationRecord> {
  const apple = requireAppleInput(input);
  const existing = pickApple((await listMobileApps(admin)).apple, apple.appId);
  const variables = existing ? { id: existing.id, input: { apple } } : { input: { apple } };
  const query = existing ? UPDATE_MUTATION : CREATE_MUTATION;
  const data = await adminGraphql<
    | {
        mobilePlatformApplicationUpdate: {
          mobilePlatformApplication: RawNode | null;
          userErrors: UserError[];
        };
      }
    | {
        mobilePlatformApplicationCreate: {
          mobilePlatformApplication: RawNode | null;
          userErrors: UserError[];
        };
      }
  >(admin, query, variables);

  const payload =
    "mobilePlatformApplicationUpdate" in data
      ? data.mobilePlatformApplicationUpdate
      : data.mobilePlatformApplicationCreate;
  assertNoUserErrors(payload.userErrors, "Shopify could not save the iOS app.");
  const record = payload.mobilePlatformApplication ? toApple(payload.mobilePlatformApplication) : null;
  if (!record) {
    throw new MobileAppAssociationError("Shopify did not return the iOS app.", "graphql");
  }
  return record;
}

export async function deleteMobileApp(admin: AdminGraphqlClient, id: string): Promise<string> {
  const appId = id.trim();
  if (!appId.startsWith("gid://shopify/MobilePlatformApplication/")) {
    throw new MobileAppAssociationError("A mobile platform application id is required.", "config");
  }
  const data = await adminGraphql<{
    mobilePlatformApplicationDelete: {
      deletedMobilePlatformApplicationId: string | null;
      userErrors: UserError[];
    };
  }>(admin, DELETE_MUTATION, { id: appId });
  assertNoUserErrors(
    data.mobilePlatformApplicationDelete.userErrors,
    "Shopify could not delete the mobile app.",
  );
  return data.mobilePlatformApplicationDelete.deletedMobilePlatformApplicationId || appId;
}

export async function resolveShopDomains(
  admin: AdminGraphqlClient,
  fallbackShop: string,
): Promise<ShopDomains> {
  const fallback = normalizeShopHost(fallbackShop);
  try {
    const data = await adminGraphql<{
      shop: {
        myshopifyDomain: string;
        primaryDomain: { host: string; url: string };
      };
    }>(admin, SHOP_DOMAIN_QUERY);
    const primaryHost = normalizeShopHost(data.shop.primaryDomain?.host || "") || fallback;
    const myshopifyHost = normalizeShopHost(data.shop.myshopifyDomain || "") || fallback;
    return {
      primaryHost,
      myshopifyHost,
      primaryUrl: data.shop.primaryDomain?.url || `https://${primaryHost}`,
    };
  } catch (error) {
    if (error instanceof MobileAppAssociationError && error.code === "access_denied") throw error;
    return {
      primaryHost: fallback,
      myshopifyHost: fallback,
      primaryUrl: fallback ? `https://${fallback}` : "",
    };
  }
}

export function expectedFromConfig(
  config: MobileAppConfig,
  apps?: MobileAppList,
): AssociationExpected {
  const androidReady = config.packageValid && config.fingerprintsValid;
  const appleReady = config.appIdValid;
  const registeredAndroid = apps?.android[0];
  const registeredApple = apps?.apple[0];

  return {
    applicationId: androidReady
      ? config.packageName
      : (registeredAndroid?.applicationId ?? ""),
    sha256CertFingerprints: androidReady
      ? config.fingerprints.filter(isSha256Fingerprint)
      : (registeredAndroid?.sha256CertFingerprints ?? []),
    appId: appleReady ? config.appId : (registeredApple?.appId ?? ""),
    androidSource: androidReady ? "environment" : registeredAndroid ? "shopify" : "incomplete",
    appleSource: appleReady ? "environment" : registeredApple ? "shopify" : "incomplete",
  };
}

async function fetchAssociation(url: string): Promise<{
  status: number | null;
  text: string | null;
  contentType: string;
  error?: string;
}> {
  try {
    const response = await fetch(url, {
      method: "GET",
      redirect: "follow",
      headers: { accept: "application/json, application/pkcs7-mime, */*" },
      signal: AbortSignal.timeout(12_000),
    });
    return {
      status: response.status,
      text: await response.text(),
      contentType: response.headers.get("content-type") ?? "",
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Request failed";
    return { status: null, text: null, contentType: "", error: message };
  }
}

function unreachableDetails(status: number | null, contentType: string, error?: string): string[] {
  const details = [
    error
      ? `Could not reach the URL (${error}).`
      : `HTTP ${status ?? "unknown"}${contentType ? ` (${contentType})` : ""}.`,
    HEADLESS_DETAIL,
  ];
  return details;
}

export async function verifyLiveFiles(
  shopDomain: string,
  expected?: AssociationExpected,
): Promise<DomainVerification> {
  const config = readMobileAppConfig();
  const target = expected ?? {
    applicationId: config.packageValid && config.fingerprintsValid ? config.packageName : "",
    sha256CertFingerprints:
      config.packageValid && config.fingerprintsValid
        ? config.fingerprints.filter(isSha256Fingerprint)
        : [],
    appId: config.appIdValid ? config.appId : "",
    androidSource: config.packageValid && config.fingerprintsValid ? "environment" : "incomplete",
    appleSource: config.appIdValid ? "environment" : "incomplete",
  };
  const host = normalizeShopHost(shopDomain);
  const assetLinksUrl = host ? `https://${host}/.well-known/assetlinks.json` : "";
  const appleUrl = host ? `https://${host}/.well-known/apple-app-site-association` : "";

  if (!host) {
    const failure: FileCheck = {
      url: "",
      pass: false,
      httpStatus: null,
      details: ["Shop domain is missing.", HEADLESS_DETAIL],
    };
    return { host: "", assetLinks: failure, appleAppSiteAssociation: { ...failure } };
  }

  const [assetLinksResponse, appleResponse] = await Promise.all([
    fetchAssociation(assetLinksUrl),
    fetchAssociation(appleUrl),
  ]);

  return {
    host,
    assetLinks: checkFile(assetLinksUrl, assetLinksResponse, (json) =>
      evaluateAssetLinks(json, target),
    ),
    appleAppSiteAssociation: checkFile(appleUrl, appleResponse, (json) =>
      evaluateAppleAppSiteAssociation(json, target),
    ),
  };
}

function checkFile(
  url: string,
  response: { status: number | null; text: string | null; contentType: string; error?: string },
  evaluate: (json: unknown) => { pass: boolean; details: string[] },
): FileCheck {
  if (response.error || response.status !== 200 || response.text == null) {
    return {
      url,
      pass: false,
      httpStatus: response.status,
      details: unreachableDetails(response.status, response.contentType, response.error),
    };
  }

  let json: unknown;
  try {
    json = JSON.parse(response.text);
  } catch {
    return {
      url,
      pass: false,
      httpStatus: response.status,
      details: [
        `Response is not valid JSON${response.contentType ? ` (${response.contentType})` : ""}.`,
        HEADLESS_DETAIL,
      ],
    };
  }

  const result = evaluate(json);
  return {
    url,
    pass: result.pass,
    httpStatus: response.status,
    details: result.details,
  };
}
