import { useEffect, useState } from "react";
import type { ActionFunctionArgs, HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useFetcher, useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";

import {
  buildAppleAppId,
  isSha256Fingerprint,
  isValidAppId,
  isValidBundleId,
  isValidPackageName,
  isValidTeamId,
  normalizeFingerprint,
} from "../lib/mobile-app-association";
import {
  deleteMobileApp,
  expectedFromConfig,
  listMobileApps,
  MobileAppAssociationError,
  readMobileAppConfig,
  resolveShopDomains,
  upsertAndroidApp,
  upsertAppleApp,
  verifyLiveFiles,
  type AppleApplicationRecord,
  type AndroidApplicationRecord,
  type DomainVerification,
  type FileCheck,
} from "../lib/mobileAppAssociation.server";
import { authenticate } from "../shopify.server";

const HEADLESS_WARNING =
  "Shopify hosts these files on the store's primary domain after the apps are saved. If this storefront is not served by Shopify (for example Next.js on Vercel), proxy or rewrite /.well-known/* to the Shopify-hosted domain, or host assetlinks.json and apple-app-site-association on the frontend.";

function readBool(form: FormData, name: string, fallback: boolean): boolean {
  const value = form.get(name);
  if (value == null || value === "") return fallback;
  return value === "true" || value === "on" || value === "1";
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const config = readMobileAppConfig();
  const domains = await resolveShopDomains(admin, session.shop);

  let android: AndroidApplicationRecord[] = [];
  let apple: AppleApplicationRecord[] = [];
  let scopeError: string | null = null;
  let loadError: string | null = null;

  try {
    const listed = await listMobileApps(admin);
    android = listed.android;
    apple = listed.apple;
  } catch (error) {
    if (error instanceof MobileAppAssociationError && error.code === "access_denied") {
      scopeError = error.message;
    } else {
      loadError = error instanceof Error ? error.message : "Could not load mobile apps.";
    }
  }

  const apps = { android, apple };
  const expected = expectedFromConfig(config, apps);
  const verification = await verifyLiveFiles(domains.primaryHost, expected);
  const shopifyVerification =
    domains.myshopifyHost && domains.myshopifyHost !== domains.primaryHost
      ? await verifyLiveFiles(domains.myshopifyHost, expected)
      : null;

  const registeredAndroid = android[0] ?? null;
  const registeredApple = apple[0] ?? null;
  const appleParts = registeredApple
    ? {
        teamId: registeredApple.appId.split(".")[0] ?? "",
        bundleId: registeredApple.appId.split(".").slice(1).join("."),
      }
    : { teamId: "", bundleId: "" };

  return {
    config,
    expected,
    domains,
    verification,
    shopifyVerification,
    scopeError,
    loadError,
    form: {
      android: {
        id: registeredAndroid?.id ?? "",
        applicationId: config.packageName || registeredAndroid?.applicationId || "",
        fingerprints: config.fingerprints.length
          ? config.fingerprints
          : registeredAndroid?.sha256CertFingerprints?.length
            ? registeredAndroid.sha256CertFingerprints
            : [""],
        appLinksEnabled: registeredAndroid?.appLinksEnabled ?? true,
        registeredApplicationId: registeredAndroid?.applicationId ?? "",
      },
      apple: {
        id: registeredApple?.id ?? "",
        teamId: config.teamId || appleParts.teamId,
        bundleId: config.bundleId || appleParts.bundleId,
        universalLinksEnabled: registeredApple?.universalLinksEnabled ?? true,
        sharedWebCredentialsEnabled: registeredApple?.sharedWebCredentialsEnabled ?? true,
        registeredAppId: registeredApple?.appId ?? "",
      },
    },
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  const form = await request.formData();
  const intent = String(form.get("intent") || "");

  try {
    if (intent === "save-android") {
      await upsertAndroidApp(admin, {
        applicationId: String(form.get("applicationId") || ""),
        sha256CertFingerprints: form.getAll("sha256CertFingerprints").map(String),
        appLinksEnabled: readBool(form, "appLinksEnabled", true),
      });
      return { ok: true as const, message: "Android app links saved." };
    }

    if (intent === "save-ios") {
      await upsertAppleApp(admin, {
        teamId: String(form.get("teamId") || ""),
        bundleId: String(form.get("bundleId") || ""),
        universalLinksEnabled: readBool(form, "universalLinksEnabled", true),
        sharedWebCredentialsEnabled: readBool(form, "sharedWebCredentialsEnabled", true),
        appClipsEnabled: false,
      });
      return { ok: true as const, message: "iOS universal links saved." };
    }

    if (intent === "delete") {
      await deleteMobileApp(admin, String(form.get("id") || ""));
      return { ok: true as const, message: "Mobile app removed from Shopify." };
    }

    if (intent === "verify") {
      return { ok: true as const, message: "Checked the live association files." };
    }

    return Response.json({ error: "Unknown action.", code: "config" }, { status: 400 });
  } catch (error) {
    const code = error instanceof MobileAppAssociationError ? error.code : "graphql";
    const message = error instanceof Error ? error.message : "Mobile app association failed.";
    const status = code === "access_denied" ? 403 : 400;
    return Response.json({ error: message, code }, { status });
  }
};

function fingerprintError(value: string): string {
  if (!value.trim()) return "";
  return isSha256Fingerprint(normalizeFingerprint(value))
    ? ""
    : "Use 32 colon-separated uppercase hex bytes.";
}

function sourceLabel(source: "environment" | "shopify" | "incomplete"): string {
  if (source === "environment") return "environment variables";
  if (source === "shopify") return "the app registered in Shopify (environment variables are incomplete)";
  return "an incomplete configuration";
}

function FileStatus({ title, file }: { title: string; file: FileCheck }) {
  return (
    <s-stack direction="block" gap="small">
      <s-stack direction="inline" gap="small" alignItems="center">
        <s-badge tone={file.pass ? "success" : "critical"}>{file.pass ? "Passing" : "Failing"}</s-badge>
        <s-text type="strong">{title}</s-text>
      </s-stack>
      {file.url ? (
        <s-link href={file.url} target="_blank">
          {file.url}
        </s-link>
      ) : null}
      {file.details.length ? (
        <s-unordered-list>
          {file.details.map((detail, index) => (
            <s-list-item key={`${title}-${index}`}>{detail}</s-list-item>
          ))}
        </s-unordered-list>
      ) : null}
    </s-stack>
  );
}

function DomainStatus({
  heading,
  verification,
}: {
  heading: string;
  verification: DomainVerification;
}) {
  return (
    <s-stack direction="block" gap="base">
      <s-heading>{heading}</s-heading>
      <FileStatus title="Android assetlinks.json" file={verification.assetLinks} />
      <FileStatus title="Apple app site association" file={verification.appleAppSiteAssociation} />
    </s-stack>
  );
}

export default function MobileAppLinksPage() {
  const data = useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();
  const androidForm = data.form.android;
  const appleForm = data.form.apple;

  const [applicationId, setApplicationId] = useState(androidForm.applicationId);
  const [fingerprints, setFingerprints] = useState(androidForm.fingerprints);
  const [appLinksEnabled, setAppLinksEnabled] = useState(androidForm.appLinksEnabled);
  const [teamId, setTeamId] = useState(appleForm.teamId);
  const [bundleId, setBundleId] = useState(appleForm.bundleId);
  const [universalLinksEnabled, setUniversalLinksEnabled] = useState(appleForm.universalLinksEnabled);
  const [sharedWebCredentialsEnabled, setSharedWebCredentialsEnabled] = useState(
    appleForm.sharedWebCredentialsEnabled,
  );
  const [localError, setLocalError] = useState("");

  useEffect(() => {
    setApplicationId(androidForm.applicationId);
    setFingerprints(androidForm.fingerprints.length ? androidForm.fingerprints : [""]);
    setAppLinksEnabled(androidForm.appLinksEnabled);
  }, [androidForm.applicationId, androidForm.appLinksEnabled, androidForm.fingerprints]);

  useEffect(() => {
    setTeamId(appleForm.teamId);
    setBundleId(appleForm.bundleId);
    setUniversalLinksEnabled(appleForm.universalLinksEnabled);
    setSharedWebCredentialsEnabled(appleForm.sharedWebCredentialsEnabled);
  }, [
    appleForm.teamId,
    appleForm.bundleId,
    appleForm.universalLinksEnabled,
    appleForm.sharedWebCredentialsEnabled,
  ]);

  const pending = fetcher.state !== "idle" ? String(fetcher.formData?.get("intent") || "") : "";
  const serverError = fetcher.data && "error" in fetcher.data ? String(fetcher.data.error) : "";
  const serverCode = fetcher.data && "code" in fetcher.data ? String(fetcher.data.code) : "";
  const success = fetcher.data && "message" in fetcher.data ? String(fetcher.data.message) : "";
  const scopeError = data.scopeError || (serverCode === "access_denied" ? serverError : "");
  const genericError = localError || data.loadError || (serverCode === "access_denied" ? "" : serverError);
  const primaryFailed = !data.verification.assetLinks.pass || !data.verification.appleAppSiteAssociation.pass;
  const composedAppId =
    teamId.trim() && bundleId.trim() ? buildAppleAppId(teamId, bundleId) : "";

  function submit(intent: string, fields: Record<string, string | string[]>) {
    const form = new FormData();
    form.set("intent", intent);
    for (const [key, value] of Object.entries(fields)) {
      if (Array.isArray(value)) {
        for (const item of value) form.append(key, item);
      } else {
        form.set(key, value);
      }
    }
    setLocalError("");
    fetcher.submit(form, { method: "post" });
  }

  function saveAndroid() {
    const packageName = applicationId.trim();
    const entered = fingerprints.map(normalizeFingerprint).filter(Boolean);
    const invalid = entered.filter((fingerprint) => !isSha256Fingerprint(fingerprint));
    if (!isValidPackageName(packageName)) {
      setLocalError("Enter a valid Android package name, such as com.xxx.mrsupplement.");
      return;
    }
    if (!entered.length || invalid.length) {
      setLocalError("Each fingerprint must be 32 colon-separated uppercase hex bytes.");
      return;
    }
    submit("save-android", {
      applicationId: packageName,
      sha256CertFingerprints: entered,
      appLinksEnabled: appLinksEnabled ? "true" : "false",
    });
  }

  function saveIos() {
    const team = teamId.trim().toUpperCase();
    const bundle = bundleId.trim();
    const appId = team && bundle ? buildAppleAppId(team, bundle) : "";
    if (!isValidTeamId(team) || !isValidBundleId(bundle) || !isValidAppId(appId)) {
      setLocalError("iOS app id must use TEAMID.bundle format: a 10-character team id and a bundle id.");
      return;
    }
    submit("save-ios", {
      teamId: team,
      bundleId: bundle,
      universalLinksEnabled: universalLinksEnabled ? "true" : "false",
      sharedWebCredentialsEnabled: sharedWebCredentialsEnabled ? "true" : "false",
    });
  }

  return (
    <s-page heading="Mobile App Links">
      <s-button
        slot="primary-action"
        variant="secondary"
        onClick={() => submit("verify", {})}
        {...(pending === "verify" ? { loading: true } : {})}
      >
        Re-verify
      </s-button>

      {scopeError ? (
        <s-banner tone="critical" heading="Mobile app scopes are not enabled">
          <s-paragraph>{scopeError}</s-paragraph>
        </s-banner>
      ) : null}
      {genericError ? (
        <s-banner tone="critical" heading="Mobile app links need attention">
          <s-paragraph>{genericError}</s-paragraph>
        </s-banner>
      ) : null}
      {success ? (
        <s-banner tone="success" heading={success.startsWith("Checked") ? "Verification" : "Saved"}>
          <s-paragraph>{success}</s-paragraph>
        </s-banner>
      ) : null}
      {data.config.formatIssues.length ? (
        <s-banner tone="critical" heading="Environment configuration is invalid">
          <s-unordered-list>
            {data.config.formatIssues.map((issue) => (
              <s-list-item key={issue}>{issue}</s-list-item>
            ))}
          </s-unordered-list>
        </s-banner>
      ) : null}
      {data.config.missing.length ? (
        <s-banner tone="info" heading="Environment defaults are incomplete">
          <s-paragraph>
            {data.config.missing.join(" ")} Values saved from this page are still registered with
            Shopify. Verification prefers the environment variables when they are valid.
          </s-paragraph>
        </s-banner>
      ) : null}
      {primaryFailed ? (
        <s-banner tone="warning" heading="Live association files did not match">
          <s-paragraph>{HEADLESS_WARNING}</s-paragraph>
        </s-banner>
      ) : null}

      <s-section heading="Status">
        <s-stack direction="block" gap="base">
          <s-paragraph>
            Android is checked against {sourceLabel(data.expected.androidSource)}. iOS is checked
            against {sourceLabel(data.expected.appleSource)}. Shopify serves the files; this app
            does not host them.
          </s-paragraph>
          <DomainStatus
            heading={`Primary domain (${data.domains.primaryHost || "unknown"})`}
            verification={data.verification}
          />
          {data.shopifyVerification ? (
            <DomainStatus
              heading={`Shopify domain (${data.domains.myshopifyHost})`}
              verification={data.shopifyVerification}
            />
          ) : null}
        </s-stack>
      </s-section>

      <s-section heading="Android">
        <s-stack direction="block" gap="base">
          <s-paragraph>
            Package name and SHA-256 fingerprints default from ANDROID_PACKAGE_NAME and
            ANDROID_SHA256_FINGERPRINTS. Include the upload key and the Play App Signing key.
          </s-paragraph>
          {androidForm.registeredApplicationId &&
          androidForm.registeredApplicationId !== applicationId.trim() ? (
            <s-banner tone="warning" heading="Shopify Android registration differs">
              <s-paragraph>
                Shopify currently has {androidForm.registeredApplicationId}. Saving updates that
                registration to the package name in this form.
              </s-paragraph>
            </s-banner>
          ) : (
            <s-text color="subdued">
              {androidForm.registeredApplicationId
                ? `Registered in Shopify as ${androidForm.registeredApplicationId}.`
                : "No Android app is registered in Shopify yet."}
            </s-text>
          )}
          <s-text-field
            label="Package name"
            name="applicationId"
            value={applicationId}
            placeholder="com.xxx.mrsupplement"
            onChange={(event) => setApplicationId(event.currentTarget.value)}
          ></s-text-field>
          {fingerprints.map((fingerprint, index) => {
            const error = fingerprintError(fingerprint);
            return (
              <s-grid key={`fingerprint-${index}`} gridTemplateColumns="1fr auto" gap="base" alignItems="end">
                <s-stack direction="block" gap="small">
                  <s-text-field
                    label={index === 0 ? "SHA-256 certificate fingerprint" : `Fingerprint ${index + 1}`}
                    name={`fingerprint-${index}`}
                    value={fingerprint}
                    placeholder="AA:BB:CC:..."
                    onChange={(event) => {
                      const next = fingerprints.slice();
                      next[index] = event.currentTarget.value.toUpperCase();
                      setFingerprints(next);
                    }}
                  ></s-text-field>
                  {error ? <s-text tone="critical">{error}</s-text> : null}
                </s-stack>
                <s-button
                  variant="tertiary"
                  tone="critical"
                  accessibilityLabel={`Remove fingerprint ${index + 1}`}
                  onClick={() => setFingerprints(fingerprints.filter((_, item) => item !== index))}
                >
                  Remove
                </s-button>
              </s-grid>
            );
          })}
          <s-button variant="secondary" onClick={() => setFingerprints([...fingerprints, ""])}>
            Add fingerprint
          </s-button>
          <s-switch
            label="Enable Android App Links"
            checked={appLinksEnabled}
            onChange={(event) => setAppLinksEnabled(Boolean(event.currentTarget.checked))}
          ></s-switch>
          <s-stack direction="inline" gap="small">
            <s-button
              variant="primary"
              onClick={saveAndroid}
              {...(pending === "save-android" ? { loading: true } : {})}
            >
              Save
            </s-button>
            {androidForm.id ? (
              <s-button
                variant="secondary"
                tone="critical"
                onClick={() => {
                  if (window.confirm("Remove the Android app from Shopify?")) {
                    submit("delete", { id: androidForm.id });
                  }
                }}
                {...(pending === "delete" && fetcher.formData?.get("id") === androidForm.id
                  ? { loading: true }
                  : {})}
              >
                Remove
              </s-button>
            ) : null}
          </s-stack>
        </s-stack>
      </s-section>

      <s-section heading="iOS">
        <s-stack direction="block" gap="base">
          <s-paragraph>
            Team ID and bundle ID default from IOS_TEAM_ID and IOS_BUNDLE_ID. Shopify receives the
            app id as TEAMID.bundleid.
          </s-paragraph>
          {appleForm.registeredAppId && appleForm.registeredAppId !== composedAppId ? (
            <s-banner tone="warning" heading="Shopify iOS registration differs">
              <s-paragraph>
                Shopify currently has {appleForm.registeredAppId}. Saving updates that registration
                to the app id shown below.
              </s-paragraph>
            </s-banner>
          ) : (
            <s-text color="subdued">
              {appleForm.registeredAppId
                ? `Registered in Shopify as ${appleForm.registeredAppId}.`
                : "No Apple app is registered in Shopify yet."}
            </s-text>
          )}
          <s-grid gridTemplateColumns="1fr 1fr" gap="base">
            <s-text-field
              label="Team ID"
              name="teamId"
              value={teamId}
              placeholder="TEAMID1234"
              onChange={(event) => setTeamId(event.currentTarget.value.toUpperCase())}
            ></s-text-field>
            <s-text-field
              label="Bundle ID"
              name="bundleId"
              value={bundleId}
              placeholder="com.xxx.mrsupplement"
              onChange={(event) => setBundleId(event.currentTarget.value)}
            ></s-text-field>
          </s-grid>
          {composedAppId ? <s-text type="strong">App ID sent to Shopify: {composedAppId}</s-text> : null}
          <s-switch
            label="Enable universal links"
            checked={universalLinksEnabled}
            onChange={(event) => setUniversalLinksEnabled(Boolean(event.currentTarget.checked))}
          ></s-switch>
          <s-switch
            label="Enable shared web credentials"
            checked={sharedWebCredentialsEnabled}
            onChange={(event) =>
              setSharedWebCredentialsEnabled(Boolean(event.currentTarget.checked))
            }
          ></s-switch>
          <s-stack direction="inline" gap="small">
            <s-button
              variant="primary"
              onClick={saveIos}
              {...(pending === "save-ios" ? { loading: true } : {})}
            >
              Save
            </s-button>
            {appleForm.id ? (
              <s-button
                variant="secondary"
                tone="critical"
                onClick={() => {
                  if (window.confirm("Remove the iOS app from Shopify?")) {
                    submit("delete", { id: appleForm.id });
                  }
                }}
                {...(pending === "delete" && fetcher.formData?.get("id") === appleForm.id
                  ? { loading: true }
                  : {})}
              >
                Remove
              </s-button>
            ) : null}
          </s-stack>
        </s-stack>
      </s-section>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
