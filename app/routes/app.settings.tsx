import { useCallback, useEffect, useRef, useState, type ChangeEvent, type CSSProperties } from "react";
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
import { directUploadMedia } from "../lib/upload-client";
import { authenticate } from "../shopify.server";
import { BottomTabsEditor } from "../components/settings/BottomTabsEditor";

const twoCol = "1fr 1fr";

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
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [cmsPages, setCmsPages] = useState<Array<{ id: string; title: string; slug?: string }>>([]);
  const musicFileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/cms/pages")
      .then((response) => (response.ok ? response.json() : []))
      .then((pages) => {
        if (!cancelled && Array.isArray(pages)) setCmsPages(pages);
      })
      .catch(() => {
        if (!cancelled) setCmsPages([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

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

  const resolvedMusicUrl =
    settings.backgroundMusicFileUrl.trim() ||
    settings.backgroundMusicUrl.trim() ||
    "";

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

      <BottomTabsEditor
        tabBackgroundColor={settings.tabBackgroundColor || "#ffffff"}
        tabs={settings.bottomTabs || []}
        pages={cmsPages}
        onBackgroundColorChange={(color) => setField("tabBackgroundColor", color)}
        onTabsChange={(tabs) => setField("bottomTabs", tabs)}
        onError={setError}
      />
       
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
