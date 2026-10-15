/**
 * Pure validators and live-file checks for Shopify mobile app association.
 * Safe to import from the embedded admin page. Env and Admin API access live
 * in mobileAppAssociation.server.ts.
 */

export const SHA256_FINGERPRINT_PATTERN = /^([0-9A-F]{2}:){31}[0-9A-F]{2}$/;

/** 10-character Apple Team ID. Compared after uppercasing. */
export const TEAM_ID_PATTERN = /^[A-Z0-9]{10}$/;

/** Reverse-DNS bundle id, at least two segments (com.example). */
export const BUNDLE_ID_PATTERN = /^[A-Za-z][A-Za-z0-9-]*(\.[A-Za-z][A-Za-z0-9-]*)+$/;

/** TEAMID.bundle — the appId Shopify stores for an Apple application. */
export const APP_ID_PATTERN =
  /^[A-Z0-9]{10}\.[A-Za-z][A-Za-z0-9-]*(\.[A-Za-z][A-Za-z0-9-]*)+$/;

export const PACKAGE_NAME_PATTERN =
  /^[A-Za-z][A-Za-z0-9_]*(\.[A-Za-z][A-Za-z0-9_]*)+$/;

export type EnvSource = {
  ANDROID_PACKAGE_NAME?: string;
  ANDROID_SHA256_FINGERPRINTS?: string;
  IOS_TEAM_ID?: string;
  IOS_BUNDLE_ID?: string;
};

export type MobileAppConfig = {
  packageName: string;
  fingerprints: string[];
  packageValid: boolean;
  fingerprintsValid: boolean;
  teamId: string;
  bundleId: string;
  appId: string;
  appIdValid: boolean;
  formatIssues: string[];
  missing: string[];
};

export type AssociationExpected = {
  applicationId: string;
  sha256CertFingerprints: string[];
  appId: string;
  androidSource: "environment" | "shopify" | "incomplete";
  appleSource: "environment" | "shopify" | "incomplete";
};

export type FileCheck = {
  url: string;
  pass: boolean;
  httpStatus: number | null;
  details: string[];
};

export function normalizeFingerprint(value: string): string {
  return value.trim().toUpperCase();
}

export function isSha256Fingerprint(value: string): boolean {
  return SHA256_FINGERPRINT_PATTERN.test(value);
}

export function isValidPackageName(value: string): boolean {
  return PACKAGE_NAME_PATTERN.test(value);
}

export function isValidTeamId(value: string): boolean {
  return TEAM_ID_PATTERN.test(value);
}

export function isValidBundleId(value: string): boolean {
  return BUNDLE_ID_PATTERN.test(value);
}

export function isValidAppId(value: string): boolean {
  return APP_ID_PATTERN.test(value);
}

export function buildAppleAppId(teamId: string, bundleId: string): string {
  return `${teamId.trim().toUpperCase()}.${bundleId.trim()}`;
}

export function splitAppleAppId(appId: string): { teamId: string; bundleId: string } {
  const trimmed = appId.trim();
  const dot = trimmed.indexOf(".");
  if (dot <= 0) return { teamId: trimmed.toUpperCase(), bundleId: "" };
  return {
    teamId: trimmed.slice(0, dot).toUpperCase(),
    bundleId: trimmed.slice(dot + 1),
  };
}

export function parseFingerprintList(raw: string): {
  fingerprints: string[];
  issues: string[];
} {
  const fingerprints: string[] = [];
  const issues: string[] = [];
  const parts = raw.split(",").map((part) => part.trim()).filter(Boolean);

  parts.forEach((part, index) => {
    const normalized = normalizeFingerprint(part);
    if (!isSha256Fingerprint(normalized)) {
      issues.push(
        `ANDROID_SHA256_FINGERPRINTS entry ${index + 1} must be 32 colon-separated uppercase hex bytes.`,
      );
    }
    if (!fingerprints.includes(normalized)) fingerprints.push(normalized);
  });

  return { fingerprints, issues };
}

export function collectFormatIssues(env: EnvSource): string[] {
  const issues: string[] = [];
  const packageName = env.ANDROID_PACKAGE_NAME?.trim() ?? "";
  if (packageName && !isValidPackageName(packageName)) {
    issues.push("ANDROID_PACKAGE_NAME is not a valid Android package name.");
  }

  const rawFingerprints = env.ANDROID_SHA256_FINGERPRINTS?.trim() ?? "";
  if (rawFingerprints) {
    issues.push(...parseFingerprintList(rawFingerprints).issues);
  }

  const teamId = (env.IOS_TEAM_ID ?? "").trim().toUpperCase();
  const bundleId = (env.IOS_BUNDLE_ID ?? "").trim();
  if (teamId && !isValidTeamId(teamId)) {
    issues.push("IOS_TEAM_ID must be a 10-character team id (letters and digits).");
  }
  if (bundleId && !isValidBundleId(bundleId)) {
    issues.push("IOS_BUNDLE_ID must be a reverse-DNS bundle id such as com.xxx.mrsupplement.");
  }
  if (
    teamId &&
    bundleId &&
    isValidTeamId(teamId) &&
    isValidBundleId(bundleId) &&
    !isValidAppId(buildAppleAppId(teamId, bundleId))
  ) {
    issues.push("IOS app id must use TEAMID.bundle format.");
  }

  return issues;
}

export function readMobileAppConfig(env: EnvSource = process.env): MobileAppConfig {
  const packageName = env.ANDROID_PACKAGE_NAME?.trim() ?? "";
  const parsedFingerprints = parseFingerprintList(env.ANDROID_SHA256_FINGERPRINTS ?? "");
  const teamId = (env.IOS_TEAM_ID ?? "").trim().toUpperCase();
  const bundleId = (env.IOS_BUNDLE_ID ?? "").trim();
  const appId = teamId && bundleId ? buildAppleAppId(teamId, bundleId) : "";
  const missing: string[] = [];

  if (!packageName) missing.push("ANDROID_PACKAGE_NAME is not set.");
  if (!env.ANDROID_SHA256_FINGERPRINTS?.trim()) {
    missing.push("ANDROID_SHA256_FINGERPRINTS is not set.");
  }
  if (!teamId) missing.push("IOS_TEAM_ID is not set.");
  if (!bundleId) missing.push("IOS_BUNDLE_ID is not set.");

  const fingerprintsValid =
    parsedFingerprints.fingerprints.length > 0 && parsedFingerprints.issues.length === 0;

  return {
    packageName,
    fingerprints: parsedFingerprints.fingerprints,
    packageValid: isValidPackageName(packageName),
    fingerprintsValid,
    teamId,
    bundleId,
    appId,
    appIdValid: isValidAppId(appId),
    formatIssues: collectFormatIssues(env),
    missing,
  };
}

export function normalizeShopHost(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return "";
  try {
    const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    return new URL(withProtocol).hostname.toLowerCase();
  } catch {
    return trimmed.replace(/^https?:\/\//i, "").split("/")[0]?.toLowerCase() ?? "";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function sameFingerprintSet(expected: string[], actual: string[]): boolean {
  const left = [...new Set(expected.map(normalizeFingerprint))].sort();
  const right = [...new Set(actual.map(normalizeFingerprint))].sort();
  return left.length > 0 && left.length === right.length && left.every((value, index) => value === right[index]);
}

function readStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

export function evaluateAssetLinks(
  json: unknown,
  expected: Pick<AssociationExpected, "applicationId" | "sha256CertFingerprints">,
): { pass: boolean; details: string[] } {
  const details: string[] = [];
  if (!expected.applicationId) {
    return {
      pass: false,
      details: ["ANDROID_PACKAGE_NAME is not set, so the live file cannot be matched."],
    };
  }
  if (!expected.sha256CertFingerprints.length) {
    return {
      pass: false,
      details: ["No SHA-256 fingerprints are configured, so the live file cannot be matched."],
    };
  }

  const statements = Array.isArray(json) ? json : isRecord(json) ? [json] : [];
  if (!statements.length) {
    return { pass: false, details: ["assetlinks.json did not contain a statement."] };
  }

  const packages: string[] = [];
  let matchedFingerprints: string[] | null = null;

  for (const statement of statements) {
    if (!isRecord(statement) || !isRecord(statement.target)) continue;
    const target = statement.target;
    const namespace = typeof target.namespace === "string" ? target.namespace : "";
    if (namespace && namespace !== "android_app") continue;
    const packageName =
      (typeof target.package_name === "string" && target.package_name) ||
      (typeof target.packageName === "string" && target.packageName) ||
      "";
    if (!packageName) continue;
    packages.push(packageName);
    if (packageName !== expected.applicationId) continue;
    matchedFingerprints = readStringList(
      target.sha256_cert_fingerprints ?? target.sha256CertFingerprints,
    ).map(normalizeFingerprint);
  }

  if (!matchedFingerprints) {
    const found = packages.length ? packages.join(", ") : "none";
    return {
      pass: false,
      details: [
        `Package ${expected.applicationId} was not in the live file (found: ${found}).`,
      ],
    };
  }

  if (!sameFingerprintSet(expected.sha256CertFingerprints, matchedFingerprints)) {
    const expectedSet = new Set(expected.sha256CertFingerprints.map(normalizeFingerprint));
    const actualSet = new Set(matchedFingerprints);
    const missing = [...expectedSet].filter((fingerprint) => !actualSet.has(fingerprint));
    const unexpected = [...actualSet].filter((fingerprint) => !expectedSet.has(fingerprint));
    if (missing.length) details.push(`Missing fingerprints: ${missing.join(", ")}.`);
    if (unexpected.length) details.push(`Unexpected fingerprints: ${unexpected.join(", ")}.`);
    if (!details.length) details.push("SHA-256 fingerprints do not match configuration.");
    return { pass: false, details };
  }

  return {
    pass: true,
    details: ["HTTP 200. Package name and SHA-256 fingerprints match configuration."],
  };
}

function collectApplinkIds(applinks: unknown): string[] {
  if (!isRecord(applinks)) return [];
  const ids = new Set<string>();
  const details = applinks.details;
  if (Array.isArray(details)) {
    for (const detail of details) {
      if (!isRecord(detail)) continue;
      if (typeof detail.appID === "string") ids.add(detail.appID);
      for (const appId of readStringList(detail.appIDs)) ids.add(appId);
    }
  } else if (isRecord(details)) {
    for (const appId of Object.keys(details)) ids.add(appId);
  }
  return [...ids];
}

function collectWebcredentialIds(webcredentials: unknown): string[] {
  if (!isRecord(webcredentials)) return [];
  return readStringList(webcredentials.apps);
}

export function evaluateAppleAppSiteAssociation(
  json: unknown,
  expected: Pick<AssociationExpected, "appId">,
): { pass: boolean; details: string[] } {
  if (!expected.appId) {
    return {
      pass: false,
      details: ["IOS_TEAM_ID and IOS_BUNDLE_ID are not set, so the live file cannot be matched."],
    };
  }
  if (!isRecord(json)) {
    return { pass: false, details: ["apple-app-site-association was not a JSON object."] };
  }

  const applinks = collectApplinkIds(json.applinks);
  const webcredentials = collectWebcredentialIds(json.webcredentials);
  const details: string[] = [];
  if (!applinks.includes(expected.appId)) {
    details.push(`appID ${expected.appId} is missing from applinks.`);
  }
  if (!webcredentials.includes(expected.appId)) {
    details.push(`appID ${expected.appId} is missing from webcredentials.`);
  }
  if (details.length) return { pass: false, details };

  return {
    pass: true,
    details: ["HTTP 200. appID is present under applinks and webcredentials."],
  };
}
