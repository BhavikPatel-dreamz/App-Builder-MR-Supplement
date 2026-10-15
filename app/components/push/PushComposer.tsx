import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type ChangeEvent,
} from "react";

import {
  MESSAGE_MAX,
  TITLE_MAX,
  formatBytes,
  validateDeeplink,
  validateDeviceToken,
  validateImageFile,
  validateMessage,
  validateTitle,
  type PushFieldErrors,
} from "../../lib/push-validation";
import { PhonePreview, duplicateTitle } from "./PhonePreview";
import { PushModal } from "./Modal";
import { pushPageActionUrl, pushUploadUrl } from "../../lib/push-client";

export type ComposerImage = {
  url: string;
  name: string;
  size: number;
  local?: boolean;
};

export type DuplicateRequest = {
  nonce: number;
  title: string;
  message: string;
  deeplink: string;
  imageUrl: string | null;
  imageName: string | null;
  imageSize: number | null;
};

export type PushComposerHandle = {
  requestSend: () => void;
};

type FieldName = "title" | "message" | "deeplink" | "deviceToken";

const TOKEN_STORAGE_KEY = "pn-fcm-test-token";

function maskToken(token: string): string {
  const t = token.trim();
  if (t.length <= 12) return "This device";
  return `…${t.slice(-8)}`;
}

function newIdempotencyKey(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `idem-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export const PushComposer = forwardRef<
  PushComposerHandle,
  {
    onSent: () => void;
    toast: (message: string, type?: "success" | "error" | "info") => void;
    duplicateRequest: DuplicateRequest | null;
    onDuplicateHandled: () => void;
  }
>(function PushComposer(
  { onSent, toast, duplicateRequest, onDuplicateHandled },
  ref,
) {
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [deeplink, setDeeplink] = useState("");
  const [deviceToken, setDeviceToken] = useState("");
  const [image, setImage] = useState<ComposerImage | null>(null);
  const [errors, setErrors] = useState<PushFieldErrors>({});
  const [touched, setTouched] = useState<Partial<Record<FieldName, boolean>>>(
    {},
  );
  const [previewMode, setPreviewMode] = useState<"expanded" | "collapsed">(
    "expanded",
  );
  const [uploading, setUploading] = useState(false);
  const [sending, setSending] = useState(false);
  const [showInvalidModal, setShowInvalidModal] = useState(false);
  const [showSendModal, setShowSendModal] = useState(false);
  const [showClearModal, setShowClearModal] = useState(false);
  const [replaceRequest, setReplaceRequest] = useState<DuplicateRequest | null>(
    null,
  );

  const idemKeyRef = useRef<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const objectUrlRef = useRef<string | null>(null);

  const isFormEmpty =
    !title.trim() && !message.trim() && !deeplink.trim() && !image;

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(TOKEN_STORAGE_KEY);
      if (saved) setDeviceToken(saved);
    } catch {
      /* private mode */
    }
  }, []);

  const setFieldError = useCallback((field: FieldName, value: string) => {
    setErrors((current) => {
      if (value) return { ...current, [field]: value };
      const next = { ...current };
      delete next[field];
      return next;
    });
  }, []);

  const runFullValidation = useCallback((): Array<{
    field: FieldName;
    message: string;
  }> => {
    const candidates: Array<{ field: FieldName; message: string }> = [
      { field: "title", message: validateTitle(title) },
      { field: "message", message: validateMessage(message) },
      { field: "deeplink", message: validateDeeplink(deeplink) },
      { field: "deviceToken", message: validateDeviceToken(deviceToken) },
    ];
    setTouched({
      title: true,
      message: true,
      deeplink: true,
      deviceToken: true,
    });
    setErrors(
      Object.fromEntries(
        candidates
          .filter((entry) => entry.message)
          .map((entry) => [entry.field, entry.message]),
      ),
    );
    return candidates.filter((entry) => entry.message);
  }, [title, message, deeplink, deviceToken]);

  const revokeLocalUrl = useCallback(() => {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
  }, []);

  const handleFile = useCallback(
    async (file: File | undefined | null) => {
      if (!file) return;
      const clientError = validateImageFile(file);
      if (clientError) {
        setErrors((current) => ({ ...current, imageUrl: clientError }));
        toast(clientError, "error");
        return;
      }
      setErrors((current) => {
        const next = { ...current };
        delete next.imageUrl;
        return next;
      });
      revokeLocalUrl();
      const localUrl = URL.createObjectURL(file);
      objectUrlRef.current = localUrl;
      setImage({ url: localUrl, name: file.name, size: file.size, local: true });
      setUploading(true);
      try {
        const body = new FormData();
        body.append("file", file);
        const response = await fetch(pushUploadUrl(), { method: "POST", body });
        const json = (await response.json().catch(() => ({}))) as {
          ok?: boolean;
          url?: string;
          error?: string;
        };
        if (!response.ok || !json.ok || !json.url) {
          throw new Error(json.error || "Upload failed.");
        }
        revokeLocalUrl();
        setImage({ url: json.url, name: file.name, size: file.size });
        toast("Image uploaded.", "success");
      } catch (error) {
        const reason = error instanceof Error ? error.message : "Upload failed.";
        revokeLocalUrl();
        setImage(null);
        setErrors((current) => ({ ...current, imageUrl: reason }));
        toast(reason, "error");
      } finally {
        setUploading(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    },
    [revokeLocalUrl, toast],
  );

  const fillForm = useCallback(
    (next: {
      title?: string;
      message?: string;
      deeplink?: string;
      image?: ComposerImage | null;
    }) => {
      revokeLocalUrl();
      setTitle(next.title || "");
      setMessage(next.message || "");
      setDeeplink(next.deeplink || "");
      setImage(next.image ?? null);
      setTouched({});
      setErrors({});
    },
    [revokeLocalUrl],
  );

  const applyDuplicate = useCallback(
    (request: DuplicateRequest) => {
      const nextTitle = duplicateTitle(request.title);
      fillForm({
        title: nextTitle,
        message: request.message,
        deeplink: request.deeplink,
        image: request.imageUrl
          ? {
              url: request.imageUrl,
              name: request.imageName || "image",
              size: request.imageSize || 0,
            }
          : null,
      });
      toast(`Loaded “${nextTitle}” into the composer.`, "success");
    },
    [fillForm, toast],
  );

  useEffect(() => {
    if (!duplicateRequest) return;
    if (isFormEmpty) {
      applyDuplicate(duplicateRequest);
      onDuplicateHandled();
    } else {
      setReplaceRequest(duplicateRequest);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [duplicateRequest]);

  const requestSend = useCallback(() => {
    const problems = runFullValidation();
    if (problems.length > 0) {
      setShowInvalidModal(true);
      return;
    }
    if (uploading) {
      toast("Wait for the image upload to finish.", "info");
      return;
    }
    idemKeyRef.current = newIdempotencyKey();
    setShowSendModal(true);
  }, [runFullValidation, toast, uploading]);

  useImperativeHandle(ref, () => ({ requestSend }), [requestSend]);

  const performSend = async () => {
    setSending(true);
    try {
      const response = await fetch(pushPageActionUrl(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          intent: "send",
          title: title.trim(),
          message: message.trim(),
          deeplink: deeplink.trim(),
          imageUrl: image && !image.local ? image.url : "",
          imageName: image?.name || "",
          imageSize: image?.size || undefined,
          deviceToken: deviceToken.trim(),
          idempotencyKey: idemKeyRef.current || "",
        }),
      });
      const json = (await response.json().catch(() => ({}))) as {
        ok?: boolean;
        status?: string;
        error?: string;
        fields?: PushFieldErrors;
      };
      if (response.ok && json.ok) {
        idemKeyRef.current = null;
        setShowSendModal(false);
        fillForm({});
        toast(
          deviceToken.trim()
            ? "Notification sent to this test device."
            : "Notification sent.",
          "success",
        );
        onSent();
        return;
      }
      idemKeyRef.current = null;
      if (json.fields && Object.keys(json.fields).length > 0) {
        setErrors((current) => ({ ...current, ...json.fields }));
      }
      setShowSendModal(false);
      toast(json.error || "Sending failed.", "error");
      if (json.status === "failed" || json.status === "sent") onSent();
    } catch {
      setShowSendModal(false);
      toast(
        "Couldn’t reach the server. Check your connection and try again.",
        "error",
      );
    } finally {
      setSending(false);
    }
  };

  const persistToken = (value: string) => {
    setDeviceToken(value);
    try {
      if (value.trim()) window.localStorage.setItem(TOKEN_STORAGE_KEY, value.trim());
      else window.localStorage.removeItem(TOKEN_STORAGE_KEY);
    } catch {
      /* private mode */
    }
  };

  const problems = (
    ["title", "message", "deeplink", "deviceToken"] as FieldName[]
  )
    .map((field) => ({ field, message: errors[field] || "" }))
    .filter((entry) => entry.message);

  return (
    <>
      <s-grid gridTemplateColumns="1fr 320px" gap="base">
        <s-stack direction="block" gap="base">
          <s-paragraph>
            Compose a notification. Title and message are required. Validation
            matches the server (title 65, message 240, safe deeplink).
          </s-paragraph>

          <s-text-field
            label="Title"
            name="title"
            required
            placeholder="e.g. Weekend sale starts now"
            value={title}
            maxLength={TITLE_MAX}
            details={`${title.trim().length} / ${TITLE_MAX}`}
            error={touched.title ? errors.title || undefined : undefined}
            disabled={sending}
            onChange={(event: ChangeEvent<HTMLInputElement>) => {
              const value = event.currentTarget.value;
              setTitle(value);
              if (touched.title) setFieldError("title", validateTitle(value));
            }}
            onBlur={() => {
              setTouched((current) => ({ ...current, title: true }));
              setFieldError("title", validateTitle(title));
            }}
          ></s-text-field>

          <s-text-area
            label="Message"
            name="message"
            required
            rows={4}
            placeholder="Tell customers what's new and why they should tap."
            value={message}
            maxLength={MESSAGE_MAX}
            details={`${message.trim().length} / ${MESSAGE_MAX}. Most phones show the first two lines on the lock screen.`}
            error={touched.message ? errors.message || undefined : undefined}
            disabled={sending}
            onChange={(event: ChangeEvent<HTMLTextAreaElement>) => {
              const value = event.currentTarget.value;
              setMessage(value);
              if (touched.message) setFieldError("message", validateMessage(value));
            }}
            onBlur={() => {
              setTouched((current) => ({ ...current, message: true }));
              setFieldError("message", validateMessage(message));
            }}
          ></s-text-area>

          <s-stack direction="block" gap="small">
            <s-text>Image (optional)</s-text>
            {image ? (
              <s-box padding="base" border="base" borderRadius="base">
                <s-stack direction="inline" gap="base" alignItems="center">
                  <s-image src={image.url} alt="Selected notification"></s-image>
                  <s-stack direction="block" gap="small">
                    <s-text>
                      <strong>{image.name}</strong>
                    </s-text>
                    <s-text color="subdued">
                      {image.size ? formatBytes(image.size) : ""}
                      {uploading ? " · Uploading…" : ""}
                    </s-text>
                    <s-stack direction="inline" gap="small">
                      <s-button
                        variant="secondary"
                        disabled={sending || uploading}
                        onClick={() => fileInputRef.current?.click()}
                      >
                        Replace
                      </s-button>
                      <s-button
                        variant="tertiary"
                        disabled={sending || uploading}
                        onClick={() => {
                          revokeLocalUrl();
                          setImage(null);
                          setErrors((current) => {
                            const next = { ...current };
                            delete next.imageUrl;
                            return next;
                          });
                        }}
                      >
                        Remove
                      </s-button>
                    </s-stack>
                  </s-stack>
                </s-stack>
              </s-box>
            ) : (
              <s-stack direction="block" gap="small">
                <s-paragraph>
                  PNG, JPG, WEBP or GIF up to 2 MB. A 2:1 ratio displays best.
                </s-paragraph>
                <s-button
                  variant="secondary"
                  disabled={sending}
                  onClick={() => fileInputRef.current?.click()}
                >
                  Upload image
                </s-button>
              </s-stack>
            )}
            {errors.imageUrl ? (
              <s-banner tone="critical" heading="Image">
                <s-paragraph>{errors.imageUrl}</s-paragraph>
              </s-banner>
            ) : null}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              hidden
              onChange={(event) => void handleFile(event.target.files?.[0])}
            />
          </s-stack>

          <s-text-field
            label="Deeplink URL"
            name="deeplink"
            placeholder="https://www.mrsupplement.com.au/… or mrsupplement://…"
            value={deeplink}
            details="Optional. Empty opens the app home screen. https://, http:// with a domain, or mrsupplement:// only."
            error={touched.deeplink ? errors.deeplink || undefined : undefined}
            disabled={sending}
            onChange={(event: ChangeEvent<HTMLInputElement>) => {
              const value = event.currentTarget.value;
              setDeeplink(value);
              if (touched.deeplink) setFieldError("deeplink", validateDeeplink(value));
            }}
            onBlur={() => {
              if (!deeplink.trim()) {
                setTouched((current) => ({ ...current, deeplink: false }));
                setFieldError("deeplink", "");
                return;
              }
              setTouched((current) => ({ ...current, deeplink: true }));
              setFieldError("deeplink", validateDeeplink(deeplink));
            }}
          ></s-text-field>

          <s-text-field
            label="Test device token"
            name="deviceToken"
            placeholder="Paste an FCM token to send to one phone"
            value={deviceToken}
            details="Optional. Leave empty to send to the topic (all subscribed devices). Not stored in the database."
            error={
              touched.deviceToken ? errors.deviceToken || undefined : undefined
            }
            disabled={sending}
            onChange={(event: ChangeEvent<HTMLInputElement>) => {
              const value = event.currentTarget.value;
              persistToken(value);
              if (touched.deviceToken) {
                setFieldError("deviceToken", validateDeviceToken(value));
              }
            }}
            onBlur={() => {
              if (!deviceToken.trim()) {
                setTouched((current) => ({ ...current, deviceToken: false }));
                setFieldError("deviceToken", "");
                return;
              }
              setTouched((current) => ({ ...current, deviceToken: true }));
              setFieldError("deviceToken", validateDeviceToken(deviceToken));
            }}
          ></s-text-field>

          <s-stack direction="inline" gap="small">
            <s-button
              variant="secondary"
              disabled={sending}
              onClick={() => {
                if (isFormEmpty) {
                  toast("The form is already empty.", "info");
                  return;
                }
                setShowClearModal(true);
              }}
            >
              Clear form
            </s-button>
            <s-button
              variant="primary"
              disabled={sending || uploading}
              {...(sending ? { loading: true } : {})}
              onClick={requestSend}
            >
              Send notification
            </s-button>
          </s-stack>
        </s-stack>

        <s-box padding="base" border="base" borderRadius="base" background="subdued">
          <s-stack direction="block" gap="base">
            <s-heading>Live preview</s-heading>
            <s-stack direction="inline" gap="small">
              <s-button
                variant={previewMode === "expanded" ? "primary" : "secondary"}
                onClick={() => setPreviewMode("expanded")}
              >
                Expanded
              </s-button>
              <s-button
                variant={previewMode === "collapsed" ? "primary" : "secondary"}
                onClick={() => setPreviewMode("collapsed")}
              >
                Lock screen
              </s-button>
            </s-stack>
            <PhonePreview
              data={{ title, message, imageUrl: image?.url || null, deeplink }}
              mode={previewMode}
            />
            <s-text color="subdued">
              Approximate rendering. Appearance varies by iOS and Android.
            </s-text>
          </s-stack>
        </s-box>
      </s-grid>

      <PushModal
        open={showInvalidModal}
        onClose={() => setShowInvalidModal(false)}
        title="Notification isn’t ready to send"
        footer={
          <s-button variant="primary" onClick={() => setShowInvalidModal(false)}>
            Fix fields
          </s-button>
        }
      >
        <div className="pn-modal-head">
          <h2 id="pn-modal-title">Notification isn’t ready to send</h2>
        </div>
        <div className="pn-modal-body">
          <p>Fix the following before sending:</p>
          <ul>
            {problems.map((entry) => (
              <li key={entry.field}>{entry.message}</li>
            ))}
          </ul>
        </div>
      </PushModal>

      <PushModal
        open={showSendModal}
        onClose={() => {
          if (!sending) setShowSendModal(false);
        }}
        title="Send this notification?"
        busy={sending}
        footer={
          <>
            <s-button disabled={sending} onClick={() => setShowSendModal(false)}>
              Cancel
            </s-button>
            <s-button
              variant="primary"
              disabled={sending}
              {...(sending ? { loading: true } : {})}
              onClick={() => void performSend()}
            >
              {sending ? "Sending…" : "Send notification"}
            </s-button>
          </>
        }
      >
        <div className="pn-modal-head">
          <h2 id="pn-modal-title">Send this notification?</h2>
        </div>
        <div className="pn-modal-body">
          <p>
            Once delivered, a notification can’t be recalled from devices.
          </p>
          <dl className="pn-confirm-summary">
            <dt>Title</dt>
            <dd>{title.trim()}</dd>
            <dt>Message</dt>
            <dd>{message.trim()}</dd>
            <dt>Image</dt>
            <dd>{image ? image.name : "None"}</dd>
            <dt>Opens</dt>
            <dd>{deeplink.trim() || "App home screen"}</dd>
            <dt>Audience</dt>
            <dd>
              {deviceToken.trim()
                ? `This device only (${maskToken(deviceToken)})`
                : "All devices on the topic"}
            </dd>
          </dl>
        </div>
      </PushModal>

      <PushModal
        open={showClearModal}
        onClose={() => setShowClearModal(false)}
        title="Clear the form?"
        footer={
          <>
            <s-button onClick={() => setShowClearModal(false)}>Cancel</s-button>
            <s-button
              variant="primary"
              tone="critical"
              onClick={() => {
                setShowClearModal(false);
                fillForm({});
                toast("Form cleared.", "info");
              }}
            >
              Clear form
            </s-button>
          </>
        }
      >
        <div className="pn-modal-head">
          <h2 id="pn-modal-title">Clear the form?</h2>
        </div>
        <div className="pn-modal-body">
          <p>
            Title, message, image and deeplink will be removed. The test token is
            kept.
          </p>
        </div>
      </PushModal>

      <PushModal
        open={Boolean(replaceRequest)}
        onClose={() => {
          setReplaceRequest(null);
          onDuplicateHandled();
        }}
        title="Replace what’s in the composer?"
        footer={
          <>
            <s-button
              onClick={() => {
                setReplaceRequest(null);
                onDuplicateHandled();
              }}
            >
              Cancel
            </s-button>
            <s-button
              variant="primary"
              onClick={() => {
                if (replaceRequest) applyDuplicate(replaceRequest);
                setReplaceRequest(null);
                onDuplicateHandled();
              }}
            >
              Replace
            </s-button>
          </>
        }
      >
        <div className="pn-modal-head">
          <h2 id="pn-modal-title">Replace what’s in the composer?</h2>
        </div>
        <div className="pn-modal-body">
          <p>The form has unsent content. Duplicating replaces it.</p>
        </div>
      </PushModal>
    </>
  );
});
