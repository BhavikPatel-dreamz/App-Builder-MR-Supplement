import { TITLE_MAX, APP_SCHEME } from "../../lib/push-validation";

export type PreviewData = {
  title: string;
  message: string;
  imageUrl?: string | null;
  deeplink?: string | null;
  sentAt?: string | null;
};

const APP_NAME = "MRSUPPLEMENT";

/** Human form of the link target: hostname+path for web, host for app links. */
function prettyLink(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.protocol.startsWith("http")
      ? parsed.hostname + parsed.pathname.replace(/\/$/, "")
      : parsed.host + parsed.pathname.replace(/\/$/, "");
  } catch {
    return url;
  }
}

function relTime(iso: string): string {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function clockTime(): string {
  return new Date().toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

function clockDate(): string {
  return new Date().toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

/**
 * Phone mockup showing how the notification will look. All text is rendered
 * as React text nodes (auto-escaped) — no dangerouslySetInnerHTML anywhere.
 */
export function PhonePreview({
  data,
  mode = "expanded",
}: {
  data: PreviewData;
  mode?: "expanded" | "collapsed";
}) {
  const collapsed = mode === "collapsed";
  const title = (data.title || "").trim();
  const message = (data.message || "").trim();
  const image = data.imageUrl || "";
  const deeplink = (data.deeplink || "").trim();
  const stamp = data.sentAt ? relTime(data.sentAt) : "now";
  const time = clockTime();

  const ariaLabel = `Phone preview: ${APP_NAME} notification. ${title || "No title"}. ${message || "No message"}.${image ? " Includes image." : ""}${deeplink ? ` Opens ${deeplink}.` : ""}`;

  return (
    <div className="pn-phone" role="img" aria-label={ariaLabel}>
      <div className="pn-phone-screen">
        <div className="pn-phone-island" aria-hidden="true" />
        <div className="pn-phone-status" aria-hidden="true">
          <span>{time}</span>
          <span>●●● 5G</span>
        </div>
        <div className="pn-phone-clock" aria-hidden="true">
          <div className="pn-date">{clockDate()}</div>
          <div className="pn-time">{time}</div>
        </div>
        <div
          className={`pn-notif${collapsed ? " collapsed" : ""}`}
          aria-hidden="true"
        >
          <div className="pn-notif-top">
            <div className="pn-notif-icon">{APP_NAME.charAt(0)}</div>
            <div className="pn-notif-app">{APP_NAME}</div>
            <div className="pn-notif-time">{stamp}</div>
          </div>
          <div className="pn-notif-body">
            <div className="pn-notif-text">
              <div className={`pn-notif-title${title ? "" : " pn-placeholder"}`}>
                {title || "Notification title"}
              </div>
              <div className={`pn-notif-msg${message ? "" : " pn-placeholder"}`}>
                {message || "Your message will appear here."}
              </div>
            </div>
            {image && collapsed ? (
              <img className="pn-notif-thumb" src={image} alt="" />
            ) : null}
          </div>
          {image && !collapsed ? (
            <img className="pn-notif-image" src={image} alt="" />
          ) : null}
          {!collapsed && deeplink ? (
            <div className="pn-notif-link" title={deeplink}>
              <LinkIcon />
              <span>Opens {prettyLink(deeplink)}</span>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function LinkIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      aria-hidden="true"
    >
      <path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7" />
      <path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7" />
    </svg>
  );
}

/** Build the duplicate title: "<title> Copy" trimmed to TITLE_MAX chars. */
export function duplicateTitle(title: string): string {
  const suffix = " Copy";
  const next = title + suffix;
  if (next.length <= TITLE_MAX) return next;
  return title.slice(0, TITLE_MAX - suffix.length).trimEnd() + suffix;
}

export { APP_SCHEME };
