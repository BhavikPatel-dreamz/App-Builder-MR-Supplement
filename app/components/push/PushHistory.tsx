import { useEffect, useRef, useState } from "react";
import { useFetcher } from "react-router";

import { PhonePreview } from "./PhonePreview";
import { formatDate, formatTime } from "./toast";
import { PushModal } from "./Modal";
import { AppTabBar } from "../AppTabBar";

export type HistoryItem = {
  id: string;
  title: string;
  message: string;
  imageUrl: string | null;
  imageName: string | null;
  imageSize: number | null;
  deeplink: string | null;
  status: string;
  errorMessage: string | null;
  createdAt: string;
  sentAt: string | null;
};

export type HistoryData = {
  items: HistoryItem[];
  total: number;
  page: number;
  pages: number;
  counts: { all: number; sent: number; failed: number };
};

export type HistoryParams = {
  q: string;
  status: string;
  sort: "asc" | "desc";
  page: number;
};

function statusTone(status: string): "success" | "critical" | "caution" | "info" {
  if (status === "sent") return "success";
  if (status === "failed") return "critical";
  if (status === "pending") return "caution";
  return "info";
}

export function PushHistory({
  data,
  params,
  loading,
  error,
  onChange,
  onRefresh,
  onDuplicate,
  toast,
}: {
  data: HistoryData;
  params: HistoryParams;
  loading: boolean;
  error: string | null;
  onChange: (patch: Partial<HistoryParams>) => void;
  onRefresh: () => void;
  onDuplicate: (item: HistoryItem) => void;
  toast: (message: string, type?: "success" | "error" | "info") => void;
}) {
  const [search, setSearch] = useState(params.q);
  const [previewItem, setPreviewItem] = useState<HistoryItem | null>(null);
  const [deleteItem, setDeleteItem] = useState<HistoryItem | null>(null);
  const debounceRef = useRef<number | null>(null);
  const fetcher = useFetcher<{ ok?: boolean; error?: string; id?: string }>();
  const handledDelete = useRef<unknown>(null);
  const deleting = fetcher.state !== "idle";

  useEffect(() => {
    setSearch(params.q);
  }, [params.q]);

  useEffect(() => {
    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
  }, []);

  const onSearchInput = (value: string) => {
    setSearch(value);
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => {
      onChange({ q: value, page: 1 });
    }, 150);
  };

  useEffect(() => {
    if (fetcher.state !== "idle" || !fetcher.data) return;
    if (handledDelete.current === fetcher.data) return;
    handledDelete.current = fetcher.data;
    if (fetcher.data.ok) {
      toast("Notification deleted from history.", "success");
      setDeleteItem(null);
      onRefresh();
    } else if (fetcher.data.error) {
      toast(fetcher.data.error, "error");
    }
  }, [fetcher.state, fetcher.data, onRefresh, toast]);

  const { items, total, page, pages, counts } = data;
  const hasRows = items.length > 0;
  const filteredOut = counts.all > 0 && !hasRows;
  const start = total === 0 ? 0 : (page - 1) * 6 + 1;
  const end = Math.min((page - 1) * 6 + items.length, total);

  return (
    <s-stack direction="block" gap="base">
      {error ? (
        <s-banner tone="critical" heading="Couldn’t load history">
          <s-paragraph>{error}</s-paragraph>
          <s-button variant="secondary" onClick={onRefresh}>
            Retry
          </s-button>
        </s-banner>
      ) : null}

      <s-grid gridTemplateColumns="1fr 1fr" gap="base">
        <s-text-field
          label="Search"
          name="q"
          placeholder="Search title or message"
          value={search}
          onChange={(event: { currentTarget: { value: string } }) =>
            onSearchInput(event.currentTarget.value)
          }
        ></s-text-field>
        <s-select
          label="Sort"
          name="sort"
          value={params.sort}
          onChange={(event: { currentTarget: { value: string } }) =>
            onChange({
              sort: event.currentTarget.value === "asc" ? "asc" : "desc",
              page: 1,
            })
          }
        >
          <s-option value="desc">Newest first</s-option>
          <s-option value="asc">Oldest first</s-option>
        </s-select>
      </s-grid>

      <AppTabBar
        value={params.status}
        onChange={(id) => onChange({ status: id, page: 1 })}
        tabs={[
          { id: "all", label: `All (${counts.all})` },
          { id: "sent", label: `Sent (${counts.sent})` },
          { id: "failed", label: `Failed (${counts.failed})` },
        ]}
      />

      {loading ? (
        <s-paragraph>Loading history…</s-paragraph>
      ) : hasRows ? (
        <>
          <s-table>
            <s-table-header-row>
              <s-table-header>Title</s-table-header>
              <s-table-header>Message</s-table-header>
              <s-table-header>Image</s-table-header>
              <s-table-header>Deeplink</s-table-header>
              <s-table-header>Status</s-table-header>
              <s-table-header>Created</s-table-header>
              <s-table-header>Sent</s-table-header>
              <s-table-header>Actions</s-table-header>
            </s-table-header-row>
            <s-table-body>
              {items.map((item) => (
                <s-table-row key={item.id}>
                  <s-table-cell>{item.title}</s-table-cell>
                  <s-table-cell>
                    <s-text color="subdued">
                      {item.message.length > 80
                        ? `${item.message.slice(0, 80)}…`
                        : item.message}
                    </s-text>
                  </s-table-cell>
                  <s-table-cell>
                    {item.imageUrl ? (
                      <s-image
                        src={item.imageUrl}
                        alt={item.imageName || "Notification image"}
                      ></s-image>
                    ) : (
                      <s-text color="subdued">None</s-text>
                    )}
                  </s-table-cell>
                  <s-table-cell>
                    {item.deeplink ? (
                      <s-text color="subdued">{item.deeplink}</s-text>
                    ) : (
                      <s-text color="subdued">Home screen</s-text>
                    )}
                  </s-table-cell>
                  <s-table-cell>
                    <s-badge tone={statusTone(item.status)}>
                      {item.status}
                    </s-badge>
                    {item.status === "failed" && item.errorMessage ? (
                      <s-text color="subdued">{item.errorMessage}</s-text>
                    ) : null}
                  </s-table-cell>
                  <s-table-cell>
                    <s-text color="subdued">
                      {formatDate(item.createdAt)} {formatTime(item.createdAt)}
                    </s-text>
                  </s-table-cell>
                  <s-table-cell>
                    {item.sentAt ? (
                      <s-text color="subdued">
                        {formatDate(item.sentAt)} {formatTime(item.sentAt)}
                      </s-text>
                    ) : (
                      <s-text color="subdued">—</s-text>
                    )}
                  </s-table-cell>
                  <s-table-cell>
                    <s-stack direction="inline" gap="small">
                      <s-button
                        variant="tertiary"
                        onClick={() => setPreviewItem(item)}
                      >
                        Preview
                      </s-button>
                      <s-button
                        variant="tertiary"
                        onClick={() => onDuplicate(item)}
                      >
                        Duplicate
                      </s-button>
                      <button
                        type="button"
                        className="pn-btn pn-btn-sm pn-btn-danger"
                        onClick={() => setDeleteItem(item)}
                      >
                        Delete
                      </button>
                    </s-stack>
                  </s-table-cell>
                </s-table-row>
              ))}
            </s-table-body>
          </s-table>

          <s-stack direction="inline" gap="small" alignItems="center">
            <s-text color="subdued">
              Showing {start}–{end} of {total}
            </s-text>
            <s-button
              variant="secondary"
              disabled={page <= 1}
              onClick={() => onChange({ page: page - 1 })}
            >
              Previous
            </s-button>
            <s-text>
              Page {page} of {pages}
            </s-text>
            <s-button
              variant="secondary"
              disabled={page >= pages}
              onClick={() => onChange({ page: page + 1 })}
            >
              Next
            </s-button>
          </s-stack>
        </>
      ) : (
        <s-box padding="base" border="base" borderRadius="base" background="subdued">
          <s-stack direction="block" gap="base">
            <s-heading>
              {filteredOut ? "No notifications match" : "No notifications yet"}
            </s-heading>
            <s-paragraph>
              {filteredOut
                ? "Try a different search term or status filter."
                : "Write your first notification in Compose. Sent notifications appear here."}
            </s-paragraph>
            {filteredOut ? (
              <s-button
                variant="secondary"
                onClick={() => onChange({ q: "", status: "all", page: 1 })}
              >
                Clear search and filters
              </s-button>
            ) : null}
          </s-stack>
        </s-box>
      )}

      <PushModal
        open={Boolean(previewItem)}
        onClose={() => setPreviewItem(null)}
        label={previewItem ? `Mobile preview: ${previewItem.title}` : undefined}
        variant="phone"
      >
        {previewItem ? (
          <PhonePreview
            data={{
              title: previewItem.title,
              message: previewItem.message,
              imageUrl: previewItem.imageUrl,
              deeplink: previewItem.deeplink,
              sentAt: previewItem.sentAt || previewItem.createdAt,
            }}
            mode="expanded"
          />
        ) : null}
      </PushModal>

      <PushModal
        open={Boolean(deleteItem)}
        onClose={() => {
          if (!deleting) setDeleteItem(null);
        }}
        title="Delete this notification?"
        busy={deleting}
        footer={
          <>
            <button
              type="button"
              className="pn-btn"
              disabled={deleting}
              onClick={() => setDeleteItem(null)}
            >
              Cancel
            </button>
            <fetcher.Form method="post">
              <input type="hidden" name="intent" value="delete" />
              <input type="hidden" name="id" value={deleteItem?.id || ""} />
              <button
                type="submit"
                className="pn-btn pn-btn-danger"
                disabled={deleting || !deleteItem}
              >
                {deleting ? "Deleting…" : "Delete"}
              </button>
            </fetcher.Form>
          </>
        }
      >
        <div className="pn-modal-head">
          <h2 id="pn-modal-title">Delete this notification?</h2>
        </div>
        <div className="pn-modal-body">
          <p>
            “{deleteItem?.title}” will be removed from history. This does not
            remove the notification from devices that already received it.
          </p>
        </div>
      </PushModal>
    </s-stack>
  );
}
