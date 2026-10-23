/**
 * Server-only FCM client. Uses a Google service account (never sent to the
 * browser). Do not import this file from client code.
 *
 * Credentials (first match wins):
 *   1. FIREBASE_SERVICE_ACCOUNT_JSON  — full JSON as a single env string
 *   2. FIREBASE_SERVICE_ACCOUNT_PATH / GOOGLE_APPLICATION_CREDENTIALS — file path
 *   3. FIREBASE_PROJECT_ID + FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY
 *
 * Targeting:
 *   - FCM_DEVICE_TOKEN — if set, send to that one device (use for tests)
 *   - otherwise FCM_TOPIC (default "all"); devices must subscribe to that topic
 */

import { cert, getApps, initializeApp, type ServiceAccount } from "firebase-admin/app";
import { getMessaging } from "firebase-admin/messaging";
import { readFileSync } from "node:fs";

export type PushPayload = {
  title: string;
  message: string;
  imageUrl?: string;
  deeplink?: string;
  /** One-device test; when set, topic is not used. */
  deviceToken?: string;
};

export type PushSendResult = {
  ok: boolean;
  providerId?: string;
  error?: string;
};

function env(name: string): string {
  return (process.env[name] || "").trim();
}

function loadServiceAccount(): ServiceAccount | { error: string } {
  const rawJson = env("FIREBASE_SERVICE_ACCOUNT_JSON");
  if (rawJson) {
    try {
      return JSON.parse(rawJson) as ServiceAccount;
    } catch {
      return { error: "FIREBASE_SERVICE_ACCOUNT_JSON is not valid JSON." };
    }
  }

  const path =
    env("FIREBASE_SERVICE_ACCOUNT_PATH") || env("GOOGLE_APPLICATION_CREDENTIALS");
  if (path) {
    try {
      return JSON.parse(readFileSync(path, "utf8")) as ServiceAccount;
    } catch (error) {
      return {
        error:
          error instanceof Error
            ? `Could not read Firebase credentials file: ${error.message}`
            : "Could not read Firebase credentials file.",
      };
    }
  }

  const projectId = env("FIREBASE_PROJECT_ID");
  const clientEmail = env("FIREBASE_CLIENT_EMAIL");
  const privateKey = env("FIREBASE_PRIVATE_KEY").replace(/\\n/g, "\n");
  if (projectId && clientEmail && privateKey) {
    return { projectId, clientEmail, privateKey };
  }

  return {
    error:
      "Firebase is not configured. Set FIREBASE_SERVICE_ACCOUNT_PATH (local JSON file) or FIREBASE_SERVICE_ACCOUNT_JSON (production).",
  };
}

function getMessagingClient(): ReturnType<typeof getMessaging> | { error: string } {
  const account = loadServiceAccount();
  if ("error" in account) return account;

  try {
    if (!getApps().length) {
      initializeApp({ credential: cert(account) });
    }
    return getMessaging();
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? `Firebase init failed: ${error.message}`.slice(0, 300)
          : "Firebase init failed.",
    };
  }
}

function buildMessage(payload: PushPayload) {
  const token = (payload.deviceToken || env("FCM_DEVICE_TOKEN")).trim();
  const data: Record<string, string> = {
    title: payload.title,
    body: payload.message,
  };
  if (payload.deeplink) data.deeplink = payload.deeplink;
  if (payload.imageUrl) data.imageUrl = payload.imageUrl;

  const target = token
    ? { token }
    : { topic: env("FCM_TOPIC") || "all" };

  return {
    ...target,
    notification: {
      title: payload.title,
      body: payload.message,
      ...(payload.imageUrl ? { imageUrl: payload.imageUrl } : {}),
    },
    data,
    android: payload.imageUrl
      ? { notification: { imageUrl: payload.imageUrl } }
      : undefined,
    apns: payload.imageUrl
      ? {
          payload: { aps: { "mutable-content": 1 } },
          fcmOptions: { imageUrl: payload.imageUrl },
        }
      : undefined,
  };
}

function fcmErrorMessage(error: unknown): string {
  if (!(error instanceof Error)) return "Firebase Cloud Messaging failed.";
  const code =
    "code" in error && typeof error.code === "string" ? error.code : "";
  if (code.includes("messaging/registration-token-not-registered")) {
    return "This FCM device token is invalid or expired. Get a fresh token from the app.";
  }
  if (code.includes("messaging/invalid-argument")) {
    return `Invalid FCM payload: ${error.message}`.slice(0, 300);
  }
  if (error.name === "TimeoutError" || /timeout/i.test(error.message)) {
    return "Push API timed out after 10s.";
  }
  return `FCM error: ${error.message}`.slice(0, 300);
}

/**
 * Send one notification to FCM_TOPIC. Upstream failures resolve to
 * { ok: false, error } — they do not throw.
 */
export async function sendPush(payload: PushPayload): Promise<PushSendResult> {
  const messaging = getMessagingClient();
  if ("error" in messaging) {
    return { ok: false, error: messaging.error };
  }

  try {
    const messageId = await messaging.send(buildMessage(payload));
    return { ok: true, providerId: messageId };
  } catch (error) {
    return { ok: false, error: fcmErrorMessage(error) };
  }
}
