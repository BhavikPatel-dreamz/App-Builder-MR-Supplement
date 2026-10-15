import { afterEach, describe, expect, it, vi } from "vitest";

import {
  buildAppleAppId,
  evaluateAppleAppSiteAssociation,
  evaluateAssetLinks,
  isSha256Fingerprint,
  isValidAppId,
  normalizeFingerprint,
  parseFingerprintList,
  readMobileAppConfig,
} from "../mobile-app-association";
import {
  mobileAppAssociationTiming,
  SCOPE_NOT_ENABLED_MESSAGE,
  upsertAndroidApp,
  upsertAppleApp,
  verifyLiveFiles,
  type AdminGraphqlClient,
} from "../mobileAppAssociation.server";

const FINGERPRINT_A = Array.from({ length: 32 }, () => "AB").join(":");
const FINGERPRINT_B = Array.from({ length: 32 }, () => "CD").join(":");
const APP_ID = "QY5HPP7P53.com.xxx.mrsupplement";

type RawNode = Record<string, unknown>;

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function createAdmin() {
  const calls: Array<{ query: string; variables?: Record<string, unknown> }> = [];
  let apps: RawNode[] = [];
  let mode: "ok" | "access-denied" | "user-error" | "throttle-once" = "ok";
  let throttled = false;

  const admin: AdminGraphqlClient = {
    graphql: async (query, options) => {
      calls.push({ query, variables: options?.variables });
      if (mode === "access-denied") {
        return jsonResponse({
          errors: [
            {
              message:
                "Access denied for mobilePlatformApplications field. Required access: `read_mobile_platform_applications` access scope.",
              extensions: { code: "ACCESS_DENIED" },
            },
          ],
        });
      }
      if (mode === "throttle-once" && !throttled) {
        throttled = true;
        return jsonResponse({
          errors: [{ message: "Throttled", extensions: { code: "THROTTLED" } }],
        });
      }
      if (query.includes("mobilePlatformApplications(")) {
        return jsonResponse({
          data: {
            mobilePlatformApplications: {
              pageInfo: { hasNextPage: false, endCursor: null },
              edges: apps.map((node) => ({ node })),
            },
          },
        });
      }
      if (query.includes("mobilePlatformApplicationCreate")) {
        const input = options?.variables?.input as {
          android?: RawNode;
          apple?: RawNode;
        };
        if (mode === "user-error") {
          return jsonResponse({
            data: {
              mobilePlatformApplicationCreate: {
                mobilePlatformApplication: null,
                userErrors: [{ field: ["android", "applicationId"], message: "is invalid" }],
              },
            },
          });
        }
        const node = input.android
          ? {
              __typename: "AndroidApplication",
              id: "gid://shopify/MobilePlatformApplication/1",
              ...input.android,
            }
          : {
              __typename: "AppleApplication",
              id: "gid://shopify/MobilePlatformApplication/2",
              ...input.apple,
            };
        apps.push(node);
        return jsonResponse({
          data: {
            mobilePlatformApplicationCreate: {
              mobilePlatformApplication: node,
              userErrors: [],
            },
          },
        });
      }
      if (query.includes("mobilePlatformApplicationUpdate")) {
        const id = options?.variables?.id;
        const input = options?.variables?.input as { android?: RawNode; apple?: RawNode };
        const index = apps.findIndex((app) => app.id === id);
        const patch = input.android ?? input.apple ?? {};
        apps[index] = { ...apps[index], ...patch };
        return jsonResponse({
          data: {
            mobilePlatformApplicationUpdate: {
              mobilePlatformApplication: apps[index],
              userErrors: [],
            },
          },
        });
      }
      throw new Error(`Unexpected query: ${query.slice(0, 80)}`);
    },
  };

  return {
    admin,
    calls,
    apps: () => apps,
    setMode(next: typeof mode) {
      mode = next;
      throttled = false;
    },
    seed(next: RawNode[]) {
      apps = next;
    },
  };
}

describe("mobile app association validators", () => {
  it("accepts an uppercase colon-separated SHA-256 fingerprint", () => {
    expect(isSha256Fingerprint(FINGERPRINT_A)).toBe(true);
    expect(isSha256Fingerprint(normalizeFingerprint(FINGERPRINT_A.toLowerCase()))).toBe(true);
  });

  it("rejects fingerprints that are not 32 uppercase colon-separated bytes", () => {
    expect(isSha256Fingerprint(FINGERPRINT_A.toLowerCase())).toBe(false);
    expect(isSha256Fingerprint("AA:BB")).toBe(false);
    expect(isSha256Fingerprint(FINGERPRINT_A.replaceAll(":", ""))).toBe(false);
    expect(parseFingerprintList(`zz,${FINGERPRINT_A}`).issues).toHaveLength(1);
    expect(parseFingerprintList(`${FINGERPRINT_A},${FINGERPRINT_B}`).fingerprints).toEqual([
      FINGERPRINT_A,
      FINGERPRINT_B,
    ]);
  });

  it("builds a TEAMID.bundle app id and rejects other shapes", () => {
    expect(buildAppleAppId("qy5hpp7p53", "com.xxx.mrsupplement")).toBe(APP_ID);
    expect(isValidAppId(APP_ID)).toBe(true);
    expect(isValidAppId("SHORT.com.xxx.mrsupplement")).toBe(false);
    expect(isValidAppId("QY5HPP7P53")).toBe(false);
    expect(isValidAppId("QY5HPP7P53.bundle")).toBe(false);
  });

  it("reads env config without treating lowercase fingerprints as already valid", () => {
    const config = readMobileAppConfig({
      ANDROID_PACKAGE_NAME: "com.xxx.mrsupplement",
      ANDROID_SHA256_FINGERPRINTS: `${FINGERPRINT_A.toLowerCase()}, ${FINGERPRINT_B}`,
      IOS_TEAM_ID: "qy5hpp7p53",
      IOS_BUNDLE_ID: "com.xxx.mrsupplement",
    });
    expect(config.packageValid).toBe(true);
    expect(config.fingerprintsValid).toBe(true);
    expect(config.fingerprints).toEqual([FINGERPRINT_A, FINGERPRINT_B]);
    expect(config.appId).toBe(APP_ID);
    expect(config.appIdValid).toBe(true);
    expect(config.formatIssues).toEqual([]);
  });
});

describe("mobile app association upsert", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("creates an Android app once and updates it on the second save", async () => {
    const mock = createAdmin();
    const input = {
      applicationId: "com.xxx.mrsupplement",
      sha256CertFingerprints: [FINGERPRINT_A.toLowerCase(), FINGERPRINT_A, FINGERPRINT_B],
      appLinksEnabled: true,
    };

    const created = await upsertAndroidApp(mock.admin, input);
    const updated = await upsertAndroidApp(mock.admin, input);

    expect(created.id).toBe("gid://shopify/MobilePlatformApplication/1");
    expect(updated.applicationId).toBe("com.xxx.mrsupplement");
    expect(mock.apps()).toHaveLength(1);
    const mutations = mock.calls.filter((call) => call.query.includes("mutation"));
    expect(mutations.map((call) => call.query)).toEqual([
      expect.stringContaining("mobilePlatformApplicationCreate"),
      expect.stringContaining("mobilePlatformApplicationUpdate"),
    ]);
    expect(mutations[0]?.variables).toEqual({
      input: {
        android: {
          applicationId: "com.xxx.mrsupplement",
          appLinksEnabled: true,
          sha256CertFingerprints: [FINGERPRINT_A, FINGERPRINT_B],
        },
      },
    });
    expect(mutations[1]?.variables).toMatchObject({
      id: "gid://shopify/MobilePlatformApplication/1",
    });
  });

  it("updates an existing Apple app instead of creating a duplicate", async () => {
    const mock = createAdmin();
    mock.seed([
      {
        __typename: "AppleApplication",
        id: "gid://shopify/MobilePlatformApplication/9",
        appId: APP_ID,
        universalLinksEnabled: false,
        sharedWebCredentialsEnabled: false,
        appClipsEnabled: true,
      },
    ]);

    const saved = await upsertAppleApp(mock.admin, {
      teamId: "qy5hpp7p53",
      bundleId: "com.xxx.mrsupplement",
      universalLinksEnabled: true,
      sharedWebCredentialsEnabled: true,
      appClipsEnabled: true,
    });

    expect(saved.appId).toBe(APP_ID);
    expect(saved.appClipsEnabled).toBe(false);
    expect(mock.apps()).toHaveLength(1);
    expect(mock.calls.some((call) => call.query.includes("mobilePlatformApplicationCreate"))).toBe(
      false,
    );
    expect(mock.calls.at(-1)?.variables).toEqual({
      id: "gid://shopify/MobilePlatformApplication/9",
      input: {
        apple: {
          appId: APP_ID,
          universalLinksEnabled: true,
          sharedWebCredentialsEnabled: true,
          appClipsEnabled: false,
        },
      },
    });
  });

  it("throws userErrors and does not create a second app", async () => {
    const mock = createAdmin();
    mock.setMode("user-error");
    await expect(
      upsertAndroidApp(mock.admin, {
        applicationId: "com.xxx.mrsupplement",
        sha256CertFingerprints: [FINGERPRINT_A],
      }),
    ).rejects.toThrow(/is invalid/);
    expect(mock.apps()).toHaveLength(0);
  });

  it("surfaces an access-denied message when Shopify has not enabled the scope", async () => {
    const mock = createAdmin();
    mock.setMode("access-denied");
    await expect(
      upsertAndroidApp(mock.admin, {
        applicationId: "com.xxx.mrsupplement",
        sha256CertFingerprints: [FINGERPRINT_A],
      }),
    ).rejects.toThrow(SCOPE_NOT_ENABLED_MESSAGE);
    expect(mock.calls).toHaveLength(1);
  });

  it("retries a throttled Admin API request", async () => {
    vi.spyOn(mobileAppAssociationTiming, "retryDelayMs").mockReturnValue(0);
    const mock = createAdmin();
    mock.setMode("throttle-once");
    const saved = await upsertAndroidApp(mock.admin, {
      applicationId: "com.xxx.mrsupplement",
      sha256CertFingerprints: [FINGERPRINT_A],
    });
    expect(saved.applicationId).toBe("com.xxx.mrsupplement");
    expect(mock.calls.length).toBeGreaterThan(1);
  });

  it("rejects an invalid fingerprint before calling Shopify", async () => {
    const mock = createAdmin();
    await expect(
      upsertAndroidApp(mock.admin, {
        applicationId: "com.xxx.mrsupplement",
        sha256CertFingerprints: ["AA:BB"],
      }),
    ).rejects.toThrow(/Fingerprint/);
    expect(mock.calls).toHaveLength(0);
  });
});

describe("live association files", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("passes when both well-known files match configuration", () => {
    expect(
      evaluateAssetLinks(
        [
          {
            relation: ["delegate_permission/common.handle_all_urls"],
            target: {
              namespace: "android_app",
              package_name: "com.xxx.mrsupplement",
              sha256_cert_fingerprints: [FINGERPRINT_B, FINGERPRINT_A.toLowerCase()],
            },
          },
        ],
        {
          applicationId: "com.xxx.mrsupplement",
          sha256CertFingerprints: [FINGERPRINT_A, FINGERPRINT_B],
        },
      ).pass,
    ).toBe(true);

    expect(
      evaluateAppleAppSiteAssociation(
        {
          applinks: { apps: [], details: [{ appID: APP_ID, paths: ["/*"] }] },
          webcredentials: { apps: [APP_ID] },
        },
        { appId: APP_ID },
      ).pass,
    ).toBe(true);
  });

  it("fails a non-200 response and explains a headless storefront", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (String(url).includes("assetlinks")) {
          return new Response("not found", { status: 404, headers: { "content-type": "text/html" } });
        }
        return new Response("not found", { status: 404, headers: { "content-type": "text/html" } });
      }),
    );

    const result = await verifyLiveFiles("mr-supplement.example", {
      applicationId: "com.xxx.mrsupplement",
      sha256CertFingerprints: [FINGERPRINT_A],
      appId: APP_ID,
      androidSource: "environment",
      appleSource: "environment",
    });

    expect(result.assetLinks.pass).toBe(false);
    expect(result.assetLinks.httpStatus).toBe(404);
    expect(result.assetLinks.details.join(" ")).toMatch(/HTTP 404/);
    expect(result.assetLinks.details.join(" ")).toMatch(/\.well-known/);
    expect(result.appleAppSiteAssociation.pass).toBe(false);
  });
});
