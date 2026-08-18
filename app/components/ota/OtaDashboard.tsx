import { useCallback, useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import {
  ApiError,
  bundleCreatedAt,
  deleteBundle,
  listBundles,
  listChannels,
  MAX_RELEASE_NOTE_LENGTH,
  patchBundle,
  type Bundle,
} from "./otaApi";

const REFRESH_INTERVAL_MS = 10_000;

const tableStyle: CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
  fontSize: "13px",
};

const cellStyle: React.CSSProperties = {
  textAlign: "left",
  padding: "10px 12px",
  borderBottom: "1px solid #e1e3e5",
  verticalAlign: "top",
};

const headCellStyle: React.CSSProperties = {
  ...cellStyle,
  color: "#6d7175",
  fontWeight: 600,
  fontSize: "12px",
  textTransform: "uppercase",
  letterSpacing: "0.03em",
  borderBottom: "1px solid #c9cccf",
  whiteSpace: "nowrap",
};

const badgeStyle = (
  kind: "on" | "off" | "force",
): React.CSSProperties => ({
  display: "inline-block",
  padding: "2px 8px",
  borderRadius: "999px",
  fontSize: "11px",
  fontWeight: 600,
  ...(kind === "on" && { background: "#e3f1df", color: "#007f5f" }),
  ...(kind === "force" && { background: "#ffea8a", color: "#6b5200" }),
  ...(kind === "off" && { background: "#edeeef", color: "#6d7175" }),
});

export default function OtaDashboard() {
  const [bundles, setBundles] = useState<Bundle[]>([]);
  const [channels, setChannels] = useState<string[]>([]);
  const [channelFilter, setChannelFilter] = useState<string>("all");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [bundlesRes, channelsRes] = await Promise.all([
        listBundles({
          channel: channelFilter === "all" ? undefined : channelFilter,
        }),
        listChannels(),
      ]);
      setBundles(bundlesRes.data);
      setChannels(channelsRes.data.channels);
      setLastUpdated(new Date());
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : `Failed to reach server: ${String(err)}`,
      );
    } finally {
      setLoading(false);
    }
  }, [channelFilter]);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, REFRESH_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [refresh]);

  const sortedBundles = useMemo(
    () => [...bundles].sort((a, b) => b.id.localeCompare(a.id)),
    [bundles],
  );

  const withPending = async (id: string, action: () => Promise<unknown>) => {
    setPendingIds(prev => new Set(prev).add(id));
    try {
      await action();
      await refresh();
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : `Action failed: ${String(err)}`,
      );
    } finally {
      setPendingIds(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const toggleEnabled = (bundle: Bundle) =>
    withPending(bundle.id, () =>
      patchBundle(bundle.id, { enabled: !bundle.enabled }),
    );

  const toggleForceUpdate = (bundle: Bundle) =>
    withPending(bundle.id, () =>
      patchBundle(bundle.id, {
        shouldForceUpdate: !bundle.shouldForceUpdate,
      }),
    );

  const startEditingNote = (bundle: Bundle) => {
    setEditingNoteId(bundle.id);
    setNoteDraft(bundle.message ?? "");
  };

  const cancelEditingNote = () => {
    setEditingNoteId(null);
    setNoteDraft("");
  };

  const saveNote = async (bundle: Bundle) => {
    const next = noteDraft.trim();
    if (!next) {
      setError("Release note cannot be empty.");
      return;
    }
    if (next === (bundle.message ?? "")) {
      cancelEditingNote();
      return;
    }

    // Deliberately not routed through withPending: that helper swallows the
    // error, and closing the editor on a failed save would throw away what the
    // user typed. Keep the editor open so they can retry.
    setPendingIds(prev => new Set(prev).add(bundle.id));
    setError(null);
    try {
      await patchBundle(bundle.id, { message: next });
      cancelEditingNote();
      await refresh();
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : `Failed to save release note: ${String(err)}`,
      );
    } finally {
      setPendingIds(prev => {
        const nextPending = new Set(prev);
        nextPending.delete(bundle.id);
        return nextPending;
      });
    }
  };

  const removeBundle = (bundle: Bundle) => {
    const confirmed = window.confirm(
      `Permanently delete this bundle?\n\n` +
        `Id:      ${bundle.id}\n` +
        `Platform: ${bundle.platform}\n` +
        `Channel:  ${bundle.channel}\n` +
        `Target:   ${bundle.targetAppVersion ?? "—"}\n` +
        `Release note: ${bundle.message ?? "—"}\n\n` +
        `This removes the bundle record and cannot be undone. Devices already ` +
        `running it are unaffected, but it can no longer be rolled back to. ` +
        `If you just want to stop serving it, use "Disable (rollback)" instead.`,
    );
    if (!confirmed) return;
    return withPending(bundle.id, () => deleteBundle(bundle.id));
  };

  return (
    <s-page heading="OTA Bundles">
      <s-stack direction="block" gap="base">
        <s-paragraph>
          Manage over-the-air update bundles served at{" "}
          <code>/hot-updater</code>. The update-check routes are public; this
          page is protected by your Shopify admin session.
        </s-paragraph>

        {error ? (
          <s-banner tone="critical" heading="Request failed">
            <s-paragraph>{error}</s-paragraph>
          </s-banner>
        ) : null}

        <s-box padding="base" border="base" borderRadius="base">
          <s-stack direction="inline" gap="small" alignItems="center" justifyContent="space-between">
            <s-stack direction="inline" gap="small" alignItems="center">
              <select
                aria-label="Channel filter"
                value={channelFilter}
                onChange={e => setChannelFilter(e.target.value)}
                style={{
                  padding: "6px 8px",
                  border: "1px solid #c9cccf",
                  borderRadius: "6px",
                  background: "#fff",
                  fontSize: "13px",
                  color: "#202223",
                }}
              >
                <option value="all">All channels</option>
                {["production", "staging", ...channels]
                  .filter((c, i, arr) => arr.indexOf(c) === i)
                  .map(c => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
              </select>
              <s-button
                variant="secondary"
                onClick={refresh}
                {...(loading ? { loading: true } : {})}
              >
                {loading ? "Refreshing…" : "Refresh now"}
              </s-button>
            </s-stack>
            <s-text color="subdued">
              {lastUpdated
                ? `Last updated ${lastUpdated.toLocaleTimeString()} · auto-refreshes every ${
                    REFRESH_INTERVAL_MS / 1000
                  }s`
                : "Loading…"}
            </s-text>
          </s-stack>

          {sortedBundles.length === 0 && !loading ? (
            <s-text color="subdued">
              No bundles deployed to this channel yet.
            </s-text>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={tableStyle}>
                <thead>
                  <tr>
                    <th style={headCellStyle}>Bundle id</th>
                    <th style={headCellStyle}>Platform</th>
                    <th style={headCellStyle}>Channel</th>
                    <th style={headCellStyle}>Target app version</th>
                    <th style={{ ...headCellStyle, minWidth: "220px" }}>
                      Release note
                    </th>
                    <th style={headCellStyle}>Status</th>
                    <th style={headCellStyle}>Force update</th>
                    <th style={headCellStyle}>Created</th>
                    <th style={headCellStyle}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedBundles.map(bundle => {
                    const createdAt = bundleCreatedAt(bundle.id);
                    const isPending = pendingIds.has(bundle.id);
                    return (
                      <tr
                        key={bundle.id}
                        style={!bundle.enabled ? { opacity: 0.55 } : undefined}
                      >
                        <td style={{ ...cellStyle, fontFamily: "ui-monospace, Menlo, monospace" }} title={bundle.id}>
                          {bundle.id.slice(0, 8)}…
                        </td>
                        <td style={cellStyle}>{bundle.platform}</td>
                        <td style={cellStyle}>{bundle.channel}</td>
                        <td style={cellStyle}>{bundle.targetAppVersion ?? "—"}</td>
                        <td style={cellStyle}>
                          {editingNoteId === bundle.id ? (
                            <s-stack direction="block" gap="small">
                              <textarea
                                value={noteDraft}
                                onChange={e => setNoteDraft(e.target.value)}
                                maxLength={MAX_RELEASE_NOTE_LENGTH}
                                rows={3}
                                // Focus is moved into the editor only after the
                                // user clicks Edit/Add — a user-initiated action,
                                // not load-time autofocus.
                                // eslint-disable-next-line jsx-a11y/no-autofocus
                                autoFocus
                                placeholder="What does this bundle change for users?"
                                style={{
                                  width: "100%",
                                  boxSizing: "border-box",
                                  padding: "8px 10px",
                                  border: "1px solid #c9cccf",
                                  borderRadius: "6px",
                                  fontSize: "13px",
                                  fontFamily: "inherit",
                                  resize: "vertical",
                                }}
                              />
                              <s-stack direction="inline" gap="small">
                                <s-button
                                  variant="primary"
                                  
                                  disabled={isPending || !noteDraft.trim()}
                                  onClick={() => saveNote(bundle)}
                                >
                                  {isPending ? "Saving…" : "Save"}
                                </s-button>
                                <s-button
                                  variant="secondary"
                                  
                                  disabled={isPending}
                                  onClick={cancelEditingNote}
                                >
                                  Cancel
                                </s-button>
                              </s-stack>
                            </s-stack>
                          ) : (
                            <s-stack direction="inline" gap="small" alignItems="start">
                              <span
                                style={{
                                  whiteSpace: "pre-wrap",
                                  overflowWrap: "anywhere",
                                  flex: 1,
                                  color: bundle.message ? "#202223" : "#6d7175",
                                  fontStyle: bundle.message ? undefined : "italic",
                                }}
                              >
                                {bundle.message ?? "No release note"}
                              </span>
                              <s-button
                                variant="tertiary"
                                
                                disabled={isPending}
                                onClick={() => startEditingNote(bundle)}
                              >
                                {bundle.message ? "Edit" : "Add"}
                              </s-button>
                            </s-stack>
                          )}
                        </td>
                        <td style={cellStyle}>
                          <span style={badgeStyle(bundle.enabled ? "on" : "off")}>
                            {bundle.enabled ? "enabled" : "disabled"}
                          </span>
                        </td>
                        <td style={cellStyle}>
                          <span
                            style={badgeStyle(bundle.shouldForceUpdate ? "force" : "off")}
                          >
                            {bundle.shouldForceUpdate ? "force" : "normal"}
                          </span>
                        </td>
                        <td style={cellStyle}>
                          {createdAt ? createdAt.toLocaleString() : "—"}
                        </td>
                        <td style={cellStyle}>
                          <s-stack direction="inline" gap="small">
                            <s-button
                              variant="secondary"
                              
                              disabled={isPending}
                              onClick={() => toggleEnabled(bundle)}
                            >
                              {bundle.enabled ? "Disable (rollback)" : "Re-enable"}
                            </s-button>
                            <s-button
                              variant="secondary"
                              
                              disabled={isPending}
                              onClick={() => toggleForceUpdate(bundle)}
                            >
                              {bundle.shouldForceUpdate
                                ? "Unset force update"
                                : "Force update"}
                            </s-button>
                            <s-button
                              variant="secondary"
                              
                              tone="critical"
                              disabled={isPending}
                              onClick={() => removeBundle(bundle)}
                            >
                              Delete
                            </s-button>
                          </s-stack>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </s-box>
      </s-stack>
    </s-page>
  );
}
