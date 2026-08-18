import { useCallback, useRef, useState, type ChangeEvent, type CSSProperties, type ReactNode } from "react";
import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";

import { getShopSettings, type ShopSettingsInput } from "../lib/settings.server";
import {
  EMPTY_COLLECTION_REF,
  EMPTY_PRODUCT_REF,
  hasCollectionRef,
  hasProductRef,
  type SettingsCollectionRef,
  type SettingsProductRef,
} from "../lib/settings-resources";
import {
  createMeditationEntry,
  todayDateKey,
  type TodaysMeditationEntry,
} from "../lib/todays-meditation";
import {
  createAffirmationEntry,
  type TodaysAffirmationEntry,
} from "../lib/todays-affirmation";
import { normalizeUploadFile } from "../lib/media-utils";
import { directUploadMedia } from "../lib/upload-client";
import { authenticate } from "../shopify.server";

type MeditationTab = "upcoming" | "past";
type AffirmationTab = "upcoming" | "past";

const twoCol = "1fr 1fr";
const threeCol = "minmax(220px, 0.9fr) minmax(240px, 1.1fr) minmax(220px, 1fr)";
const affirmationTwoCol = "minmax(240px, 1fr) minmax(240px, 1fr)";

const fieldLabelStyle: CSSProperties = {
  display: "block",
  marginBottom: "6px",
  fontSize: "13px",
  fontWeight: 600,
  color: "#303030",
};

const fieldHelpStyle: CSSProperties = {
  marginTop: "6px",
  fontSize: "12px",
  color: "#6d7175",
  lineHeight: 1.4,
};

const dateInputStyle: CSSProperties = {
  width: "100%",
  minHeight: "44px",
  padding: "10px 12px",
  border: "1px solid #8c9196",
  borderRadius: "10px",
  background: "#fff",
  fontSize: "14px",
  color: "#202223",
  boxSizing: "border-box",
  fontFamily: "inherit",
};

const mediaPreviewBoxStyle: CSSProperties = {
  marginTop: "10px",
  padding: "10px",
  borderRadius: "10px",
  border: "1px solid #e1e3e5",
  background: "#f6f6f7",
};

const iconButtonStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: "36px",
  height: "36px",
  borderRadius: "8px",
  border: "1px solid #c9cccf",
  background: "#fff",
  cursor: "pointer",
  padding: 0,
  color: "#202223",
};

const tabButtonStyle = (active: boolean): CSSProperties => ({
  minHeight: "36px",
  padding: "8px 14px",
  borderRadius: "8px",
  border: active ? "1px solid #202223" : "1px solid #c9cccf",
  background: active ? "#202223" : "#fff",
  color: active ? "#fff" : "#202223",
  fontSize: "13px",
  fontWeight: 600,
  cursor: "pointer",
});

function IconClone() {
  return (
    <svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <rect x="7" y="7" width="10" height="10" rx="2" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="M13 5V4a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h1"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconEdit() {
  return (
    <svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path
        d="M4 13.5V16h2.5L14.9 7.6l-2.5-2.5L4 13.5z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path d="M11.8 5.7l2.5 2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function IconDelete() {
  return (
    <svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M4 6h12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M8 6V4.5A1.5 1.5 0 0 1 9.5 3h1A1.5 1.5 0 0 1 12 4.5V6" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="M6.5 6l.6 9.2A1.5 1.5 0 0 0 8.6 16.5h2.8a1.5 1.5 0 0 0 1.5-1.3L13.5 6"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function MeditationActionIcon({
  label,
  tone = "default",
  onClick,
  children,
}: {
  label: string;
  tone?: "default" | "critical";
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      style={{
        ...iconButtonStyle,
        borderColor: tone === "critical" ? "#fda29b" : "#c9cccf",
        color: tone === "critical" ? "#d72c0d" : "#202223",
        background: tone === "critical" ? "#fff5f4" : "#fff",
      }}
    >
      {children}
    </button>
  );
}

function formatMeditationDate(date: string): string {
  if (!date) return "Untitled date";
  const parsed = new Date(`${date}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return date;
  return parsed.toLocaleDateString(undefined, {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function shortUrl(url: string): string {
  if (!url) return "";
  try {
    const parsed = new URL(url);
    const path = parsed.pathname.split("/").filter(Boolean).pop() || parsed.hostname;
    return path.length > 42 ? `${path.slice(0, 39)}…` : path;
  } catch {
    return url.length > 42 ? `${url.slice(0, 39)}…` : url;
  }
}

function isMeditationEntryComplete(entry: TodaysMeditationEntry): boolean {
  return Boolean(entry.date.trim() && entry.audioUrl.trim());
}

function isAffirmationEntryComplete(entry: TodaysAffirmationEntry): boolean {
  return Boolean(entry.date.trim());
}

const thumbnailStyle: CSSProperties = {
  width: "56px",
  height: "56px",
  borderRadius: "8px",
  objectFit: "cover",
  border: "1px solid #e1e3e5",
  flexShrink: 0,
  display: "block",
  background: "#f6f6f7",
};

async function pickCollection(): Promise<SettingsCollectionRef | null> {
  const picker =
    typeof window !== "undefined" ? window.shopify?.resourcePicker : null;
  if (!picker) return null;

  const selection = await picker({ type: "collection", multiple: false });
  const collection = selection?.[0];
  if (!collection?.id) return null;

  return {
    collectionId: String(collection.id),
    handle: collection.handle ? String(collection.handle) : "",
    title: collection.title ? String(collection.title) : "",
  };
}

async function pickProduct(): Promise<SettingsProductRef | null> {
  const picker =
    typeof window !== "undefined" ? window.shopify?.resourcePicker : null;
  if (!picker) return null;

  const selection = await picker({ type: "product", multiple: false });
  const product = selection?.[0];
  if (!product?.id) return null;

  return {
    productId: String(product.id),
    handle: product.handle ? String(product.handle) : "",
    title: product.title ? String(product.title) : "",
  };
}

function CollectionPickerField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: SettingsCollectionRef;
  onChange: (next: SettingsCollectionRef) => void;
}) {
  const selected = hasCollectionRef(value);

  return (
    <s-stack direction="block" gap="small">
      <s-text color="subdued">{label}</s-text>
      {selected ? (
        <s-stack direction="block" gap="small">
          <s-text>
            <strong>{value.title || "Selected collection"}</strong>
          </s-text>
          {value.handle ? <s-text color="subdued">{value.handle}</s-text> : null}
        </s-stack>
      ) : (
        <s-text color="subdued">No collection selected.</s-text>
      )}
      <s-stack direction="inline" gap="small" alignItems="center">
        <s-button
          variant="secondary"
          onClick={async () => {
            const picked = await pickCollection();
            if (picked) onChange(picked);
          }}
        >
          {selected ? "Change collection" : "Select collection"}
        </s-button>
        {selected ? (
          <s-button variant="tertiary" onClick={() => onChange({ ...EMPTY_COLLECTION_REF })}>
            Clear
          </s-button>
        ) : null}
      </s-stack>
    </s-stack>
  );
}

function ProductPickerField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: SettingsProductRef;
  onChange: (next: SettingsProductRef) => void;
}) {
  const selected = hasProductRef(value);

  return (
    <s-stack direction="block" gap="small">
      <s-text color="subdued">{label}</s-text>
      {selected ? (
        <s-stack direction="block" gap="small">
          <s-text>
            <strong>{value.title || "Selected product"}</strong>
          </s-text>
          {value.handle ? <s-text color="subdued">{value.handle}</s-text> : null}
        </s-stack>
      ) : (
        <s-text color="subdued">No product selected.</s-text>
      )}
      <s-stack direction="inline" gap="small" alignItems="center">
        <s-button
          variant="secondary"
          onClick={async () => {
            const picked = await pickProduct();
            if (picked) onChange(picked);
          }}
        >
          {selected ? "Change product" : "Select product"}
        </s-button>
        {selected ? (
          <s-button variant="tertiary" onClick={() => onChange({ ...EMPTY_PRODUCT_REF })}>
            Clear
          </s-button>
        ) : null}
      </s-stack>
    </s-stack>
  );
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const settings = await getShopSettings(session.shop);
  return { settings };
};

export default function AppSettings() {
  const { settings: initialSettings } = useLoaderData<typeof loader>();
  const [settings, setSettings] = useState<ShopSettingsInput>(initialSettings);
  const [saving, setSaving] = useState(false);
  const [uploadingMusic, setUploadingMusic] = useState(false);
  const [uploadingDefaultImage, setUploadingDefaultImage] = useState(false);
  const [uploadingEntryId, setUploadingEntryId] = useState<string | null>(null);
  const [editingMeditationId, setEditingMeditationId] = useState<string | null>(
    null,
  );
  const [meditationTab, setMeditationTab] = useState<MeditationTab>("upcoming");
  const [deleteConfirmEntry, setDeleteConfirmEntry] =
    useState<TodaysMeditationEntry | null>(null);
  const [confirmRemoveDefaultImage, setConfirmRemoveDefaultImage] =
    useState(false);
  const [uploadingAffirmationDefaultImage, setUploadingAffirmationDefaultImage] =
    useState(false);
  const [uploadingAffirmationEntryId, setUploadingAffirmationEntryId] = useState<
    string | null
  >(null);
  const [editingAffirmationId, setEditingAffirmationId] = useState<string | null>(
    null,
  );
  const [affirmationTab, setAffirmationTab] =
    useState<AffirmationTab>("upcoming");
  const [deleteConfirmAffirmationEntry, setDeleteConfirmAffirmationEntry] =
    useState<TodaysAffirmationEntry | null>(null);
  const [
    confirmRemoveAffirmationDefaultImage,
    setConfirmRemoveAffirmationDefaultImage,
  ] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const musicFileInputRef = useRef<HTMLInputElement>(null);
  const defaultImageInputRef = useRef<HTMLInputElement>(null);
  const entryAudioInputRef = useRef<HTMLInputElement>(null);
  const entryImageInputRef = useRef<HTMLInputElement>(null);
  const affirmationDefaultImageInputRef = useRef<HTMLInputElement>(null);
  const affirmationEntryImageInputRef = useRef<HTMLInputElement>(null);
  const [pendingEntryUpload, setPendingEntryUpload] = useState<{
    id: string;
    kind: "audio" | "image";
  } | null>(null);
  const [pendingAffirmationImageUploadId, setPendingAffirmationImageUploadId] =
    useState<string | null>(null);

  const setField = useCallback(
    <K extends keyof ShopSettingsInput>(key: K, value: ShopSettingsInput[K]) => {
      setSettings((current) => ({ ...current, [key]: value }));
      setSuccess(false);
    },
    [],
  );

  const saveSettings = useCallback(async () => {
    setSaving(true);
    setError("");
    setSuccess(false);

    try {
      const response = await fetch("/api/app/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });

      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload.error || "Failed to save settings.");
      }

      if (payload.settings) {
        setSettings(payload.settings);
      }

      setSuccess(true);
    } catch (saveError) {
      setError(
        saveError instanceof Error ? saveError.message : "Failed to save settings.",
      );
    } finally {
      setSaving(false);
    }
  }, [settings]);

  const onMusicFileChange = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.target.value = "";

      if (!file) return;

      setUploadingMusic(true);
      setError("");
      setSuccess(false);

      try {
        const uploaded = await directUploadMedia(file);
        setField("backgroundMusicFileUrl", uploaded.url);
      } catch (uploadError) {
        setError(
          uploadError instanceof Error
            ? uploadError.message
            : "Failed to upload music file.",
        );
      } finally {
        setUploadingMusic(false);
      }
    },
    [setField],
  );

  const uploadMediaFile = useCallback(async (file: File) => {
    const uploaded = await directUploadMedia(file);
    return uploaded.url;
  }, []);

  const updateMeditationEntry = useCallback(
    (id: string, patch: Partial<TodaysMeditationEntry>) => {
      setSettings((current) => ({
        ...current,
        todaysMeditationEntries: current.todaysMeditationEntries.map((entry) =>
          entry.id === id ? { ...entry, ...patch } : entry,
        ),
      }));
      setSuccess(false);
    },
    [],
  );

  const addMeditationEntry = useCallback(() => {
    const next = createMeditationEntry();
    setSettings((current) => ({
      ...current,
      todaysMeditationEntries: [...current.todaysMeditationEntries, next],
    }));
    setMeditationTab("upcoming");
    setEditingMeditationId(next.id);
    setSuccess(false);
  }, []);

  const cloneMeditationEntry = useCallback((entry: TodaysMeditationEntry) => {
    const cloned = createMeditationEntry({
      date: "",
      audioUrl: entry.audioUrl,
      imageUrl: entry.imageUrl,
    });
    setSettings((current) => ({
      ...current,
      todaysMeditationEntries: [...current.todaysMeditationEntries, cloned],
    }));
    setMeditationTab("upcoming");
    setEditingMeditationId(cloned.id);
    setSuccess(false);
  }, []);

  const removeMeditationEntry = useCallback((id: string) => {
    setSettings((current) => ({
      ...current,
      todaysMeditationEntries: current.todaysMeditationEntries.filter(
        (entry) => entry.id !== id,
      ),
    }));
    setEditingMeditationId((current) => (current === id ? null : current));
    setDeleteConfirmEntry(null);
    setSuccess(false);
  }, []);

  const doneEditingMeditationEntry = useCallback((entry: TodaysMeditationEntry) => {
    if (!isMeditationEntryComplete(entry)) {
      setError("Each meditation entry needs a scheduled date and audio before it can be collapsed.");
      return;
    }
    setError("");
    setEditingMeditationId(null);
    const today = todayDateKey();
    setMeditationTab(entry.date < today ? "past" : "upcoming");
  }, []);

  const onDefaultImageChange = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.target.value = "";
      if (!file) return;

      setUploadingDefaultImage(true);
      setError("");
      setSuccess(false);
      try {
        const url = await uploadMediaFile(file);
        setField("todaysMeditationDefaultImageUrl", url);
      } catch (uploadError) {
        setError(
          uploadError instanceof Error
            ? uploadError.message
            : "Failed to upload default meditation image.",
        );
      } finally {
        setUploadingDefaultImage(false);
      }
    },
    [setField, uploadMediaFile],
  );

  const onEntryMediaChange = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.target.value = "";
      if (!file || !pendingEntryUpload) return;

      const { id, kind } = pendingEntryUpload;
      setPendingEntryUpload(null);
      setUploadingEntryId(id);
      setError("");
      setSuccess(false);

      try {
        const url = await uploadMediaFile(file);
        updateMeditationEntry(
          id,
          kind === "audio" ? { audioUrl: url } : { imageUrl: url },
        );
      } catch (uploadError) {
        setError(
          uploadError instanceof Error
            ? uploadError.message
            : `Failed to upload meditation ${kind}.`,
        );
      } finally {
        setUploadingEntryId(null);
      }
    },
    [pendingEntryUpload, updateMeditationEntry, uploadMediaFile],
  );

  const updateAffirmationEntry = useCallback(
    (id: string, patch: Partial<TodaysAffirmationEntry>) => {
      setSettings((current) => ({
        ...current,
        todaysAffirmationEntries: current.todaysAffirmationEntries.map((entry) =>
          entry.id === id ? { ...entry, ...patch } : entry,
        ),
      }));
      setSuccess(false);
    },
    [],
  );

  const addAffirmationEntry = useCallback(() => {
    const next = createAffirmationEntry();
    setSettings((current) => ({
      ...current,
      todaysAffirmationEntries: [...current.todaysAffirmationEntries, next],
    }));
    setAffirmationTab("upcoming");
    setEditingAffirmationId(next.id);
    setSuccess(false);
  }, []);

  const cloneAffirmationEntry = useCallback((entry: TodaysAffirmationEntry) => {
    const cloned = createAffirmationEntry({
      date: "",
      imageUrl: entry.imageUrl,
    });
    setSettings((current) => ({
      ...current,
      todaysAffirmationEntries: [...current.todaysAffirmationEntries, cloned],
    }));
    setAffirmationTab("upcoming");
    setEditingAffirmationId(cloned.id);
    setSuccess(false);
  }, []);

  const removeAffirmationEntry = useCallback((id: string) => {
    setSettings((current) => ({
      ...current,
      todaysAffirmationEntries: current.todaysAffirmationEntries.filter(
        (entry) => entry.id !== id,
      ),
    }));
    setEditingAffirmationId((current) => (current === id ? null : current));
    setDeleteConfirmAffirmationEntry(null);
    setSuccess(false);
  }, []);

  const doneEditingAffirmationEntry = useCallback(
    (entry: TodaysAffirmationEntry) => {
      if (!isAffirmationEntryComplete(entry)) {
        setError(
          "Each affirmation entry needs a scheduled date before it can be collapsed.",
        );
        return;
      }
      setError("");
      setEditingAffirmationId(null);
      const today = todayDateKey();
      setAffirmationTab(entry.date < today ? "past" : "upcoming");
    },
    [],
  );

  const onAffirmationDefaultImageChange = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.target.value = "";
      if (!file) return;

      setUploadingAffirmationDefaultImage(true);
      setError("");
      setSuccess(false);
      try {
        const url = await uploadMediaFile(file);
        setField("todaysAffirmationDefaultImageUrl", url);
      } catch (uploadError) {
        setError(
          uploadError instanceof Error
            ? uploadError.message
            : "Failed to upload default affirmation image.",
        );
      } finally {
        setUploadingAffirmationDefaultImage(false);
      }
    },
    [setField, uploadMediaFile],
  );

  const onAffirmationEntryImageChange = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.target.value = "";
      if (!file || !pendingAffirmationImageUploadId) return;

      const id = pendingAffirmationImageUploadId;
      setPendingAffirmationImageUploadId(null);
      setUploadingAffirmationEntryId(id);
      setError("");
      setSuccess(false);

      try {
        const url = await uploadMediaFile(file);
        updateAffirmationEntry(id, { imageUrl: url });
      } catch (uploadError) {
        setError(
          uploadError instanceof Error
            ? uploadError.message
            : "Failed to upload affirmation image.",
        );
      } finally {
        setUploadingAffirmationEntryId(null);
      }
    },
    [pendingAffirmationImageUploadId, updateAffirmationEntry, uploadMediaFile],
  );

  const resolvedMusicUrl =
    settings.backgroundMusicFileUrl.trim() ||
    settings.backgroundMusicUrl.trim() ||
    "";

  const meditationEntries = Array.isArray(settings.todaysMeditationEntries)
    ? settings.todaysMeditationEntries
    : [];
  const todayKey = todayDateKey();
  const pastEntries = meditationEntries.filter(
    (entry) => entry.date && entry.date < todayKey,
  );
  const upcomingEntries = meditationEntries.filter(
    (entry) => !entry.date || entry.date >= todayKey,
  );
  const visibleMeditationEntries =
    meditationTab === "past" ? pastEntries : upcomingEntries;

  const affirmationEntries = Array.isArray(settings.todaysAffirmationEntries)
    ? settings.todaysAffirmationEntries
    : [];
  const pastAffirmationEntries = affirmationEntries.filter(
    (entry) => entry.date && entry.date < todayKey,
  );
  const upcomingAffirmationEntries = affirmationEntries.filter(
    (entry) => !entry.date || entry.date >= todayKey,
  );
  const visibleAffirmationEntries =
    affirmationTab === "past"
      ? pastAffirmationEntries
      : upcomingAffirmationEntries;

  return (
    <s-page heading="Settings">
      <s-button
        slot="primary-action"
        variant="primary"
        onClick={saveSettings}
        {...(saving ? { loading: true } : {})}
      >
        Save
      </s-button>

      {error ? (
        <s-banner tone="critical" heading="Something went wrong">
          <s-paragraph>{error}</s-paragraph>
        </s-banner>
      ) : null}

      {success ? (
        <s-banner tone="success" heading="Settings saved">
          <s-paragraph>Your app configuration has been updated.</s-paragraph>
        </s-banner>
      ) : null}

      <s-section heading="Force Update Configuration">
        <s-stack direction="block" gap="base">
          <s-paragraph>
            When force update is enabled, the mobile app compares the installed
            version with the configured version. If the installed version is
            lower, users must update via the store URL before continuing.
          </s-paragraph>

          <s-box padding="base" border="base" borderRadius="base">
            <s-stack direction="block" gap="base">
              <s-heading>Android</s-heading>

              <s-grid gridTemplateColumns={twoCol} gap="base">
                <s-text-field
                  label="Android App Version"
                  name="androidAppVersion"
                  placeholder="e.g. 2.1.0"
                  value={settings.androidAppVersion}
                  onChange={(event) =>
                    setField("androidAppVersion", event.currentTarget.value)
                  }
                ></s-text-field>

                <s-text-field
                  label="Play Store URL"
                  name="androidPlayStoreUrl"
                  placeholder="https://play.google.com/store/apps/details?id=…"
                  value={settings.androidPlayStoreUrl}
                  onChange={(event) =>
                    setField("androidPlayStoreUrl", event.currentTarget.value)
                  }
                ></s-text-field>
              </s-grid>

              <s-checkbox
                label="Enable Force Update"
                name="androidForceUpdateEnabled"
                checked={settings.androidForceUpdateEnabled}
                onChange={(event) =>
                  setField("androidForceUpdateEnabled", event.currentTarget.checked)
                }
              ></s-checkbox>
            </s-stack>
          </s-box>

          <s-box padding="base" border="base" borderRadius="base">
            <s-stack direction="block" gap="base">
              <s-heading>iOS</s-heading>

              <s-grid gridTemplateColumns={twoCol} gap="base">
                <s-text-field
                  label="iOS App Version"
                  name="iosAppVersion"
                  placeholder="e.g. 2.1.0"
                  value={settings.iosAppVersion}
                  onChange={(event) =>
                    setField("iosAppVersion", event.currentTarget.value)
                  }
                ></s-text-field>

                <s-text-field
                  label="App Store URL"
                  name="iosAppStoreUrl"
                  placeholder="https://apps.apple.com/app/id…"
                  value={settings.iosAppStoreUrl}
                  onChange={(event) =>
                    setField("iosAppStoreUrl", event.currentTarget.value)
                  }
                ></s-text-field>
              </s-grid>

              <s-checkbox
                label="Enable Force Update"
                name="iosForceUpdateEnabled"
                checked={settings.iosForceUpdateEnabled}
                onChange={(event) =>
                  setField("iosForceUpdateEnabled", event.currentTarget.checked)
                }
              ></s-checkbox>
            </s-stack>
          </s-box>
        </s-stack>
      </s-section>

                {/*
      <s-section heading="Background Music">
        <s-stack direction="block" gap="base">
          <s-paragraph>
            Configure background music that plays automatically when the app
            launches and continues globally unless stopped by app logic. If both
            an uploaded file and a URL are provided, the uploaded file takes
            priority.
          </s-paragraph>

          <s-box padding="base" border="base" borderRadius="base">
            <s-stack direction="block" gap="base">
              <s-text color="subdued">Upload music file</s-text>

              <s-stack direction="inline" gap="small" alignItems="center">
                <s-button
                  variant="secondary"
                  onClick={() => musicFileInputRef.current?.click()}
                  {...(uploadingMusic ? { loading: true } : {})}
                >
                  {settings.backgroundMusicFileUrl ? "Replace file" : "Upload file"}
                </s-button>

                {settings.backgroundMusicFileUrl ? (
                  <s-button
                    variant="tertiary"
                    tone="critical"
                    onClick={() => setField("backgroundMusicFileUrl", "")}
                  >
                    Remove upload
                  </s-button>
                ) : null}
              </s-stack>

              {settings.backgroundMusicFileUrl ? (
                <s-text color="subdued">
                  Uploaded file: {settings.backgroundMusicFileUrl}
                </s-text>
              ) : null}

              <input
                ref={musicFileInputRef}
                type="file"
                accept="audio/*"
                style={{ display: "none" }}
                onChange={onMusicFileChange}
              />

              <s-divider></s-divider>

              <s-text-field
                label="Music URL"
                name="backgroundMusicUrl"
                placeholder="https://cdn.example.com/music.mp3"
                details="Used when no uploaded file is set."
                value={settings.backgroundMusicUrl}
                onChange={(event) =>
                  setField("backgroundMusicUrl", event.currentTarget.value)
                }
              ></s-text-field>

              {resolvedMusicUrl ? (
                <s-banner tone="info" heading="Resolved music source">
                  <s-paragraph>
                    {settings.backgroundMusicFileUrl.trim()
                      ? "The uploaded file will be used."
                      : "The music URL will be used."}
                  </s-paragraph>
                  <s-paragraph>{resolvedMusicUrl}</s-paragraph>
                </s-banner>
              ) : null}
            </s-stack>
          </s-box>
        </s-stack>
      </s-section>

      <s-section heading="Bottom Tab Actions">
        <s-stack direction="block" gap="base">
          <s-paragraph>
            Configure where the mobile app bottom tabs navigate. Products and
            Courses open a collection. Yagnas can open either a collection or a
            single product.
          </s-paragraph>

          <s-box padding="base" border="base" borderRadius="base">
            <s-stack direction="block" gap="base">
              <s-heading>Products</s-heading>
              <CollectionPickerField
                label="Collection"
                value={settings.productsTabCollection}
                onChange={(next) => setField("productsTabCollection", next)}
              />
            </s-stack>
          </s-box>

          <s-box padding="base" border="base" borderRadius="base">
            <s-stack direction="block" gap="base">
              <s-heading>Courses</s-heading>
              <CollectionPickerField
                label="Collection"
                value={settings.coursesTabCollection}
                onChange={(next) => setField("coursesTabCollection", next)}
              />
            </s-stack>
          </s-box>

          <s-box padding="base" border="base" borderRadius="base">
            <s-stack direction="block" gap="base">
              <s-heading>Yagnas</s-heading>
              <s-paragraph>
                Select either a collection or a product. Choosing one clears
                the other.
              </s-paragraph>
              <CollectionPickerField
                label="Collection"
                value={settings.yagnasTabCollection}
                onChange={(next) => {
                  setSettings((current) => ({
                    ...current,
                    yagnasTabCollection: next,
                    yagnasTabProduct: { ...EMPTY_PRODUCT_REF },
                  }));
                  setSuccess(false);
                }}
              />
              <s-divider></s-divider>
              <ProductPickerField
                label="Product"
                value={settings.yagnasTabProduct}
                onChange={(next) => {
                  setSettings((current) => ({
                    ...current,
                    yagnasTabProduct: next,
                    yagnasTabCollection: { ...EMPTY_COLLECTION_REF },
                  }));
                  setSuccess(false);
                }}
              />
            </s-stack>
          </s-box>
        </s-stack>
      </s-section>

      <s-section heading="Today's Meditation">
        <s-stack direction="block" gap="base">
          <s-paragraph>
            Schedule meditation audio for specific dates. The mobile app shows
            today&apos;s entry automatically. If an entry has no background
            image, the default meditation background is used.
          </s-paragraph>

          <s-box padding="base" border="base" borderRadius="base">
            <s-stack direction="block" gap="base">
              <s-heading>Default background image</s-heading>
              <s-paragraph>
                Optional fallback image used when a dated entry does not include
                its own background.
              </s-paragraph>

              <s-stack direction="inline" gap="small" alignItems="center">
                <s-button
                  variant="secondary"
                  onClick={() => defaultImageInputRef.current?.click()}
                  {...(uploadingDefaultImage ? { loading: true } : {})}
                >
                  {settings.todaysMeditationDefaultImageUrl
                    ? "Replace default image"
                    : "Upload default image"}
                </s-button>
                {settings.todaysMeditationDefaultImageUrl ? (
                  <s-button
                    variant="tertiary"
                    tone="critical"
                    onClick={() => setConfirmRemoveDefaultImage(true)}
                  >
                    Remove
                  </s-button>
                ) : null}
              </s-stack>

              {settings.todaysMeditationDefaultImageUrl ? (
                <s-stack direction="inline" gap="base" alignItems="center">
                  <img
                    src={settings.todaysMeditationDefaultImageUrl}
                    alt="Default meditation background"
                    style={{
                      width: "72px",
                      height: "72px",
                      borderRadius: "8px",
                      objectFit: "cover",
                      border: "1px solid #e1e3e5",
                      flexShrink: 0,
                      display: "block",
                    }}
                  />
                  <s-text color="subdued">
                    {shortUrl(settings.todaysMeditationDefaultImageUrl)}
                  </s-text>
                </s-stack>
              ) : (
                <s-text color="subdued">No default image uploaded.</s-text>
              )}

              <input
                ref={defaultImageInputRef}
                type="file"
                accept="image/*"
                style={{ display: "none" }}
                onChange={onDefaultImageChange}
              />
            </s-stack>
          </s-box>

          <s-box padding="base" border="base" borderRadius="base">
            <s-stack direction="block" gap="base">
              <s-stack
                direction="inline"
                gap="base"
                alignItems="center"
                justifyContent="space-between"
              >
                <s-heading>Scheduled meditations</s-heading>
                <s-button variant="primary" onClick={addMeditationEntry}>
                  Add date
                </s-button>
              </s-stack>

              <s-stack direction="inline" gap="small" alignItems="center">
                <button
                  type="button"
                  style={tabButtonStyle(meditationTab === "upcoming")}
                  onClick={() => setMeditationTab("upcoming")}
                >
                  Upcoming ({upcomingEntries.length})
                </button>
                <button
                  type="button"
                  style={tabButtonStyle(meditationTab === "past")}
                  onClick={() => setMeditationTab("past")}
                >
                  Past ({pastEntries.length})
                </button>
              </s-stack>

              {visibleMeditationEntries.length === 0 ? (
                <s-box padding="base" border="base" borderRadius="base" background="subdued">
                  <s-stack direction="block" gap="small">
                    <s-text>
                      {meditationTab === "past"
                        ? "No past meditations yet."
                        : "No upcoming meditations scheduled."}
                    </s-text>
                    {meditationTab === "upcoming" ? (
                      <s-text color="subdued">
                        Click <strong>Add date</strong> to create your first entry.
                      </s-text>
                    ) : null}
                  </s-stack>
                </s-box>
              ) : null}

              {visibleMeditationEntries.map((entry) => {
                const index = meditationEntries.findIndex((item) => item.id === entry.id);
                const isUploading = uploadingEntryId === entry.id;
                const missingAudio = !entry.audioUrl.trim();
                const missingDate = !entry.date.trim();
                const isComplete = isMeditationEntryComplete(entry);
                const isEditing =
                  editingMeditationId === entry.id || !isComplete;

                if (!isEditing) {
                  const previewImage =
                    entry.imageUrl.trim() ||
                    settings.todaysMeditationDefaultImageUrl.trim();

                  return (
                    <s-box
                      key={entry.id}
                      padding="base"
                      border="base"
                      borderRadius="base"
                      background="base"
                    >
                      <s-stack
                        direction="inline"
                        gap="base"
                        alignItems="center"
                        justifyContent="space-between"
                      >
                        <s-stack direction="inline" gap="base" alignItems="center">
                          {previewImage ? (
                            <img
                              src={previewImage}
                              alt=""
                              style={thumbnailStyle}
                            />
                          ) : (
                            <div
                              style={{
                                ...thumbnailStyle,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                color: "#6d7175",
                                fontSize: "11px",
                              }}
                            >
                              No img
                            </div>
                          )}
                          <s-stack direction="block" gap="small">
                            <s-heading>{formatMeditationDate(entry.date)}</s-heading>
                            <s-text color="subdued">
                              Entry {index + 1} · Audio ready
                              {entry.imageUrl.trim()
                                ? " · Custom image"
                                : " · Default image"}
                            </s-text>
                          </s-stack>
                        </s-stack>

                        <s-stack direction="inline" gap="small" alignItems="center">
                          <MeditationActionIcon
                            label="Clone meditation"
                            onClick={() => cloneMeditationEntry(entry)}
                          >
                            <IconClone />
                          </MeditationActionIcon>
                          <MeditationActionIcon
                            label="Edit meditation"
                            onClick={() => setEditingMeditationId(entry.id)}
                          >
                            <IconEdit />
                          </MeditationActionIcon>
                          <MeditationActionIcon
                            label="Delete meditation"
                            tone="critical"
                            onClick={() => setDeleteConfirmEntry(entry)}
                          >
                            <IconDelete />
                          </MeditationActionIcon>
                        </s-stack>
                      </s-stack>
                    </s-box>
                  );
                }

                return (
                  <s-box
                    key={entry.id}
                    padding="base"
                    border="base"
                    borderRadius="base"
                    background="base"
                  >
                    <s-stack direction="block" gap="base">
                      <s-stack
                        direction="inline"
                        gap="base"
                        alignItems="center"
                        justifyContent="space-between"
                      >
                        <s-stack direction="block" gap="small">
                          <s-heading>
                            {formatMeditationDate(entry.date)}
                          </s-heading>
                          <s-text color="subdued">
                            Entry {index + 1}
                            {isComplete
                              ? " · Editing"
                              : " · Incomplete — date and audio are required"}
                          </s-text>
                        </s-stack>
                        <s-stack direction="inline" gap="small" alignItems="center">
                          {isComplete ? (
                            <s-button
                              variant="primary"
                              onClick={() => doneEditingMeditationEntry(entry)}
                            >
                              Done
                            </s-button>
                          ) : null}
                          <MeditationActionIcon
                            label="Clone meditation"
                            onClick={() => cloneMeditationEntry(entry)}
                          >
                            <IconClone />
                          </MeditationActionIcon>
                          <MeditationActionIcon
                            label="Delete meditation"
                            tone="critical"
                            onClick={() => setDeleteConfirmEntry(entry)}
                          >
                            <IconDelete />
                          </MeditationActionIcon>
                        </s-stack>
                      </s-stack>

                      <s-grid gridTemplateColumns={threeCol} gap="base">
                        <s-box padding="base" border="base" borderRadius="base">
                          <label htmlFor={`meditation-date-${entry.id}`} style={fieldLabelStyle}>
                            Scheduled date
                          </label>
                          <div style={{ position: "relative" }}>
                            <input
                              id={`meditation-date-${entry.id}`}
                              type="date"
                              name={`meditation-date-${entry.id}`}
                              value={entry.date || ""}
                              required
                              onChange={(event) =>
                                updateMeditationEntry(entry.id, {
                                  date: event.currentTarget.value,
                                })
                              }
                              style={{
                                ...dateInputStyle,
                                borderColor: missingDate ? "#d72c0d" : "#8c9196",
                              }}
                            />
                          </div>
                          <div style={fieldHelpStyle}>
                            {missingDate
                              ? "Choose the day this meditation should appear."
                              : "Opens the calendar picker. One unique date per entry."}
                          </div>
                        </s-box>

                        <s-box padding="base" border="base" borderRadius="base">
                          <div style={fieldLabelStyle}>Meditation audio</div>
                          <s-stack direction="inline" gap="small" alignItems="center">
                            <s-button
                              variant="secondary"
                              onClick={() => {
                                setPendingEntryUpload({ id: entry.id, kind: "audio" });
                                entryAudioInputRef.current?.click();
                              }}
                              {...(isUploading ? { loading: true } : {})}
                            >
                              {entry.audioUrl ? "Replace audio" : "Upload audio"}
                            </s-button>
                            {entry.audioUrl ? (
                              <s-button
                                variant="tertiary"
                                tone="critical"
                                onClick={() =>
                                  updateMeditationEntry(entry.id, { audioUrl: "" })
                                }
                              >
                                Clear
                              </s-button>
                            ) : null}
                          </s-stack>
                          {entry.audioUrl ? (
                            <div style={mediaPreviewBoxStyle}>
                              <audio
                                controls
                                src={entry.audioUrl}
                                style={{ width: "100%", display: "block" }}
                              />
                              <div style={{ ...fieldHelpStyle, marginTop: "8px" }}>
                                {shortUrl(entry.audioUrl)}
                              </div>
                            </div>
                          ) : (
                            <div style={fieldHelpStyle}>
                              Required. Upload an MP3 / M4A / WAV file.
                            </div>
                          )}
                        </s-box>

                        <s-box padding="base" border="base" borderRadius="base">
                          <div style={fieldLabelStyle}>Background image</div>
                          <s-stack direction="inline" gap="small" alignItems="center">
                            <s-button
                              variant="secondary"
                              onClick={() => {
                                setPendingEntryUpload({ id: entry.id, kind: "image" });
                                entryImageInputRef.current?.click();
                              }}
                              {...(isUploading ? { loading: true } : {})}
                            >
                              {entry.imageUrl ? "Replace image" : "Upload image"}
                            </s-button>
                            {entry.imageUrl ? (
                              <s-button
                                variant="tertiary"
                                tone="critical"
                                onClick={() =>
                                  updateMeditationEntry(entry.id, { imageUrl: "" })
                                }
                              >
                                Clear
                              </s-button>
                            ) : null}
                          </s-stack>
                          {entry.imageUrl ? (
                            <div style={{ ...mediaPreviewBoxStyle, display: "flex", gap: "10px", alignItems: "center" }}>
                              <img
                                src={entry.imageUrl}
                                alt={`Meditation background for ${
                                  entry.date || "entry"
                                }`}
                                style={thumbnailStyle}
                              />
                              <div style={fieldHelpStyle}>
                                {shortUrl(entry.imageUrl)}
                              </div>
                            </div>
                          ) : (
                            <div style={fieldHelpStyle}>
                              Optional. Falls back to the default background.
                            </div>
                          )}
                        </s-box>
                      </s-grid>
                    </s-stack>
                  </s-box>
                );
              })}

              <input
                ref={entryAudioInputRef}
                type="file"
                accept="audio/*,video/*"
                style={{ display: "none" }}
                onChange={onEntryMediaChange}
              />
              <input
                ref={entryImageInputRef}
                type="file"
                accept="image/*"
                style={{ display: "none" }}
                onChange={onEntryMediaChange}
              />
            </s-stack>
          </s-box>

          {confirmRemoveDefaultImage ? (
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="remove-default-image-title"
              style={{
                position: "fixed",
                inset: 0,
                zIndex: 1000,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "rgba(0, 0, 0, 0.45)",
                padding: "16px",
              }}
            >
              <s-box
                padding="base"
                border="base"
                borderRadius="base"
                background="base"
              >
                <div style={{ width: "min(420px, 100%)" }}>
                  <s-stack direction="block" gap="base">
                    <s-heading id="remove-default-image-title">
                      Remove default background image?
                    </s-heading>
                    <s-paragraph>
                      Entries without their own background image will no longer
                      have a fallback image until you upload a new default.
                    </s-paragraph>
                    <s-stack direction="inline" gap="small" justifyContent="end">
                      <s-button
                        variant="secondary"
                        onClick={() => setConfirmRemoveDefaultImage(false)}
                      >
                        Cancel
                      </s-button>
                      <s-button
                        variant="primary"
                        tone="critical"
                        onClick={() => {
                          setField("todaysMeditationDefaultImageUrl", "");
                          setConfirmRemoveDefaultImage(false);
                        }}
                      >
                        Remove
                      </s-button>
                    </s-stack>
                  </s-stack>
                </div>
              </s-box>
            </div>
          ) : null}

          {deleteConfirmEntry ? (
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="delete-meditation-title"
              style={{
                position: "fixed",
                inset: 0,
                zIndex: 1000,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "rgba(0, 0, 0, 0.45)",
                padding: "16px",
              }}
            >
              <s-box
                padding="base"
                border="base"
                borderRadius="base"
                background="base"
              >
                <div style={{ width: "min(420px, 100%)" }}>
                  <s-stack direction="block" gap="base">
                    <s-heading id="delete-meditation-title">
                      Delete meditation?
                    </s-heading>
                    <s-paragraph>
                      This will permanently remove{" "}
                      <strong>
                        {formatMeditationDate(deleteConfirmEntry.date)}
                      </strong>
                      . This action cannot be undone.
                    </s-paragraph>
                    <s-stack direction="inline" gap="small" justifyContent="end">
                      <s-button
                        variant="secondary"
                        onClick={() => setDeleteConfirmEntry(null)}
                      >
                        Cancel
                      </s-button>
                      <s-button
                        variant="primary"
                        tone="critical"
                        onClick={() => removeMeditationEntry(deleteConfirmEntry.id)}
                      >
                        Delete
                      </s-button>
                    </s-stack>
                  </s-stack>
                </div>
              </s-box>
            </div>
          ) : null}
        </s-stack>
      </s-section>

      <s-section heading="Today's Affirmation">
        <s-stack direction="block" gap="base">
          <s-paragraph>
            Schedule affirmation backgrounds for specific dates. The mobile app
            shows today&apos;s entry automatically. If an entry has no background
            image, the default affirmation background is used.
          </s-paragraph>

          <s-box padding="base" border="base" borderRadius="base">
            <s-stack direction="block" gap="base">
              <s-heading>Default background image</s-heading>
              <s-paragraph>
                Optional fallback image used when a dated entry does not include
                its own background.
              </s-paragraph>

              <s-stack direction="inline" gap="small" alignItems="center">
                <s-button
                  variant="secondary"
                  onClick={() => affirmationDefaultImageInputRef.current?.click()}
                  {...(uploadingAffirmationDefaultImage ? { loading: true } : {})}
                >
                  {settings.todaysAffirmationDefaultImageUrl
                    ? "Replace default image"
                    : "Upload default image"}
                </s-button>
                {settings.todaysAffirmationDefaultImageUrl ? (
                  <s-button
                    variant="tertiary"
                    tone="critical"
                    onClick={() => setConfirmRemoveAffirmationDefaultImage(true)}
                  >
                    Remove
                  </s-button>
                ) : null}
              </s-stack>

              {settings.todaysAffirmationDefaultImageUrl ? (
                <s-stack direction="inline" gap="base" alignItems="center">
                  <img
                    src={settings.todaysAffirmationDefaultImageUrl}
                    alt="Default affirmation background"
                    style={{
                      width: "72px",
                      height: "72px",
                      borderRadius: "8px",
                      objectFit: "cover",
                      border: "1px solid #e1e3e5",
                      flexShrink: 0,
                      display: "block",
                    }}
                  />
                  <s-text color="subdued">
                    {shortUrl(settings.todaysAffirmationDefaultImageUrl)}
                  </s-text>
                </s-stack>
              ) : (
                <s-text color="subdued">No default image uploaded.</s-text>
              )}

              <input
                ref={affirmationDefaultImageInputRef}
                type="file"
                accept="image/*"
                style={{ display: "none" }}
                onChange={onAffirmationDefaultImageChange}
              />
            </s-stack>
          </s-box>

          <s-box padding="base" border="base" borderRadius="base">
            <s-stack direction="block" gap="base">
              <s-stack
                direction="inline"
                gap="base"
                alignItems="center"
                justifyContent="space-between"
              >
                <s-heading>Scheduled affirmations</s-heading>
                <s-button variant="primary" onClick={addAffirmationEntry}>
                  Add date
                </s-button>
              </s-stack>

              <s-stack direction="inline" gap="small" alignItems="center">
                <button
                  type="button"
                  style={tabButtonStyle(affirmationTab === "upcoming")}
                  onClick={() => setAffirmationTab("upcoming")}
                >
                  Upcoming ({upcomingAffirmationEntries.length})
                </button>
                <button
                  type="button"
                  style={tabButtonStyle(affirmationTab === "past")}
                  onClick={() => setAffirmationTab("past")}
                >
                  Past ({pastAffirmationEntries.length})
                </button>
              </s-stack>

              {visibleAffirmationEntries.length === 0 ? (
                <s-box
                  padding="base"
                  border="base"
                  borderRadius="base"
                  background="subdued"
                >
                  <s-stack direction="block" gap="small">
                    <s-text>
                      {affirmationTab === "past"
                        ? "No past affirmations yet."
                        : "No upcoming affirmations scheduled."}
                    </s-text>
                    {affirmationTab === "upcoming" ? (
                      <s-text color="subdued">
                        Click <strong>Add date</strong> to create your first entry.
                      </s-text>
                    ) : null}
                  </s-stack>
                </s-box>
              ) : null}

              {visibleAffirmationEntries.map((entry) => {
                const index = affirmationEntries.findIndex(
                  (item) => item.id === entry.id,
                );
                const isUploading = uploadingAffirmationEntryId === entry.id;
                const missingDate = !entry.date.trim();
                const isComplete = isAffirmationEntryComplete(entry);
                const isEditing =
                  editingAffirmationId === entry.id || !isComplete;

                if (!isEditing) {
                  const previewImage =
                    entry.imageUrl.trim() ||
                    settings.todaysAffirmationDefaultImageUrl.trim();

                  return (
                    <s-box
                      key={entry.id}
                      padding="base"
                      border="base"
                      borderRadius="base"
                      background="base"
                    >
                      <s-stack
                        direction="inline"
                        gap="base"
                        alignItems="center"
                        justifyContent="space-between"
                      >
                        <s-stack direction="inline" gap="base" alignItems="center">
                          {previewImage ? (
                            <img
                              src={previewImage}
                              alt=""
                              style={thumbnailStyle}
                            />
                          ) : (
                            <div
                              style={{
                                ...thumbnailStyle,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                color: "#6d7175",
                                fontSize: "11px",
                              }}
                            >
                              No img
                            </div>
                          )}
                          <s-stack direction="block" gap="small">
                            <s-heading>
                              {formatMeditationDate(entry.date)}
                            </s-heading>
                            <s-text color="subdued">
                              Entry {index + 1}
                              {entry.imageUrl.trim()
                                ? " · Custom image"
                                : " · Default image"}
                            </s-text>
                          </s-stack>
                        </s-stack>

                        <s-stack direction="inline" gap="small" alignItems="center">
                          <MeditationActionIcon
                            label="Clone affirmation"
                            onClick={() => cloneAffirmationEntry(entry)}
                          >
                            <IconClone />
                          </MeditationActionIcon>
                          <MeditationActionIcon
                            label="Edit affirmation"
                            onClick={() => setEditingAffirmationId(entry.id)}
                          >
                            <IconEdit />
                          </MeditationActionIcon>
                          <MeditationActionIcon
                            label="Delete affirmation"
                            tone="critical"
                            onClick={() =>
                              setDeleteConfirmAffirmationEntry(entry)
                            }
                          >
                            <IconDelete />
                          </MeditationActionIcon>
                        </s-stack>
                      </s-stack>
                    </s-box>
                  );
                }

                return (
                  <s-box
                    key={entry.id}
                    padding="base"
                    border="base"
                    borderRadius="base"
                    background="base"
                  >
                    <s-stack direction="block" gap="base">
                      <s-stack
                        direction="inline"
                        gap="base"
                        alignItems="center"
                        justifyContent="space-between"
                      >
                        <s-stack direction="block" gap="small">
                          <s-heading>
                            {formatMeditationDate(entry.date)}
                          </s-heading>
                          <s-text color="subdued">
                            Entry {index + 1}
                            {isComplete
                              ? " · Editing"
                              : " · Incomplete — date is required"}
                          </s-text>
                        </s-stack>
                        <s-stack direction="inline" gap="small" alignItems="center">
                          {isComplete ? (
                            <s-button
                              variant="primary"
                              onClick={() => doneEditingAffirmationEntry(entry)}
                            >
                              Done
                            </s-button>
                          ) : null}
                          <MeditationActionIcon
                            label="Clone affirmation"
                            onClick={() => cloneAffirmationEntry(entry)}
                          >
                            <IconClone />
                          </MeditationActionIcon>
                          <MeditationActionIcon
                            label="Delete affirmation"
                            tone="critical"
                            onClick={() =>
                              setDeleteConfirmAffirmationEntry(entry)
                            }
                          >
                            <IconDelete />
                          </MeditationActionIcon>
                        </s-stack>
                      </s-stack>

                      <s-grid gridTemplateColumns={affirmationTwoCol} gap="base">
                        <s-box padding="base" border="base" borderRadius="base">
                          <label
                            htmlFor={`affirmation-date-${entry.id}`}
                            style={fieldLabelStyle}
                          >
                            Scheduled date
                          </label>
                          <div style={{ position: "relative" }}>
                            <input
                              id={`affirmation-date-${entry.id}`}
                              type="date"
                              name={`affirmation-date-${entry.id}`}
                              value={entry.date || ""}
                              required
                              onChange={(event) =>
                                updateAffirmationEntry(entry.id, {
                                  date: event.currentTarget.value,
                                })
                              }
                              style={{
                                ...dateInputStyle,
                                borderColor: missingDate ? "#d72c0d" : "#8c9196",
                              }}
                            />
                          </div>
                          <div style={fieldHelpStyle}>
                            {missingDate
                              ? "Choose the day this affirmation should appear."
                              : "Opens the calendar picker. One unique date per entry."}
                          </div>
                        </s-box>

                        <s-box padding="base" border="base" borderRadius="base">
                          <div style={fieldLabelStyle}>Background image</div>
                          <s-stack
                            direction="inline"
                            gap="small"
                            alignItems="center"
                          >
                            <s-button
                              variant="secondary"
                              onClick={() => {
                                setPendingAffirmationImageUploadId(entry.id);
                                affirmationEntryImageInputRef.current?.click();
                              }}
                              {...(isUploading ? { loading: true } : {})}
                            >
                              {entry.imageUrl ? "Replace image" : "Upload image"}
                            </s-button>
                            {entry.imageUrl ? (
                              <s-button
                                variant="tertiary"
                                tone="critical"
                                onClick={() =>
                                  updateAffirmationEntry(entry.id, {
                                    imageUrl: "",
                                  })
                                }
                              >
                                Clear
                              </s-button>
                            ) : null}
                          </s-stack>
                          {entry.imageUrl ? (
                            <div
                              style={{
                                ...mediaPreviewBoxStyle,
                                display: "flex",
                                gap: "10px",
                                alignItems: "center",
                              }}
                            >
                              <img
                                src={entry.imageUrl}
                                alt={`Affirmation background for ${
                                  entry.date || "entry"
                                }`}
                                style={thumbnailStyle}
                              />
                              <div style={fieldHelpStyle}>
                                {shortUrl(entry.imageUrl)}
                              </div>
                            </div>
                          ) : (
                            <div style={fieldHelpStyle}>
                              Optional. Falls back to the default background.
                            </div>
                          )}
                        </s-box>
                      </s-grid>
                    </s-stack>
                  </s-box>
                );
              })}

              <input
                ref={affirmationEntryImageInputRef}
                type="file"
                accept="image/*"
                style={{ display: "none" }}
                onChange={onAffirmationEntryImageChange}
              />
            </s-stack>
          </s-box>

          {confirmRemoveAffirmationDefaultImage ? (
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="remove-affirmation-default-image-title"
              style={{
                position: "fixed",
                inset: 0,
                zIndex: 1000,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "rgba(0, 0, 0, 0.45)",
                padding: "16px",
              }}
            >
              <s-box
                padding="base"
                border="base"
                borderRadius="base"
                background="base"
              >
                <div style={{ width: "min(420px, 100%)" }}>
                  <s-stack direction="block" gap="base">
                    <s-heading id="remove-affirmation-default-image-title">
                      Remove default background image?
                    </s-heading>
                    <s-paragraph>
                      Entries without their own background image will no longer
                      have a fallback image until you upload a new default.
                    </s-paragraph>
                    <s-stack direction="inline" gap="small" justifyContent="end">
                      <s-button
                        variant="secondary"
                        onClick={() =>
                          setConfirmRemoveAffirmationDefaultImage(false)
                        }
                      >
                        Cancel
                      </s-button>
                      <s-button
                        variant="primary"
                        tone="critical"
                        onClick={() => {
                          setField("todaysAffirmationDefaultImageUrl", "");
                          setConfirmRemoveAffirmationDefaultImage(false);
                        }}
                      >
                        Remove
                      </s-button>
                    </s-stack>
                  </s-stack>
                </div>
              </s-box>
            </div>
          ) : null}

          {deleteConfirmAffirmationEntry ? (
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="delete-affirmation-title"
              style={{
                position: "fixed",
                inset: 0,
                zIndex: 1000,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "rgba(0, 0, 0, 0.45)",
                padding: "16px",
              }}
            >
              <s-box
                padding="base"
                border="base"
                borderRadius="base"
                background="base"
              >
                <div style={{ width: "min(420px, 100%)" }}>
                  <s-stack direction="block" gap="base">
                    <s-heading id="delete-affirmation-title">
                      Delete affirmation?
                    </s-heading>
                    <s-paragraph>
                      This will permanently remove{" "}
                      <strong>
                        {formatMeditationDate(deleteConfirmAffirmationEntry.date)}
                      </strong>
                      . This action cannot be undone.
                    </s-paragraph>
                    <s-stack direction="inline" gap="small" justifyContent="end">
                      <s-button
                        variant="secondary"
                        onClick={() => setDeleteConfirmAffirmationEntry(null)}
                      >
                        Cancel
                      </s-button>
                      <s-button
                        variant="primary"
                        tone="critical"
                        onClick={() =>
                          removeAffirmationEntry(
                            deleteConfirmAffirmationEntry.id,
                          )
                        }
                      >
                        Delete
                      </s-button>
                    </s-stack>
                  </s-stack>
                </div>
              </s-box>
            </div>
          ) : null}
        </s-stack>
      </s-section> */}
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
