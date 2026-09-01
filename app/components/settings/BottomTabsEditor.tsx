import { useCallback, useRef, useState, type ChangeEvent, type CSSProperties } from "react";

import { directUploadMedia } from "../../lib/upload-client";
import {
  createEmptyBottomTab,
  type BottomTabItem,
} from "../../lib/bottom-tabs";
import { TabActionEditor } from "./TabActionEditor";

const twoCol = "1fr 1fr";
const threeCol = "1fr 1fr 1fr";

const colorInputStyle: CSSProperties = {
  width: 44,
  height: 32,
  padding: 0,
  border: "1px solid #c9cccf",
  borderRadius: 6,
  background: "transparent",
  cursor: "pointer",
};

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
}) {
  return (
    <s-stack direction="block" gap="small">
      <s-text color="subdued">{label}</s-text>
      <s-stack direction="inline" gap="small" alignItems="center">
        <input
          type="color"
          aria-label={label}
          value={/^#([0-9a-fA-F]{6})$/.test(value) ? value : "#ffffff"}
          onChange={(event) => onChange(event.currentTarget.value)}
          style={colorInputStyle}
        />
        <s-text-field
          label="Hex"
          value={value}
          onChange={(event) => onChange(event.currentTarget.value)}
        ></s-text-field>
      </s-stack>
    </s-stack>
  );
}

function IconPickerField({
  label,
  url,
  uploading,
  onUpload,
  onClear,
}: {
  label: string;
  url: string;
  uploading: boolean;
  onUpload: (file: File) => void;
  onClear: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <s-stack direction="block" gap="small">
      <s-text color="subdued">{label}</s-text>
      {url ? (
        <img
          src={url}
          alt={label}
          style={{ width: 40, height: 40, objectFit: "contain", borderRadius: 8 }}
        />
      ) : (
        <s-text color="subdued">No icon selected.</s-text>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(event: ChangeEvent<HTMLInputElement>) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) onUpload(file);
        }}
      />
      <s-stack direction="inline" gap="small" alignItems="center">
        <s-button
          variant="secondary"
          onClick={() => inputRef.current?.click()}
          {...(uploading ? { loading: true } : {})}
        >
          {url ? "Change icon" : "Upload icon"}
        </s-button>
        {url ? (
          <s-button variant="tertiary" onClick={onClear}>
            Clear
          </s-button>
        ) : null}
      </s-stack>
    </s-stack>
  );
}

export function BottomTabsEditor({
  tabBackgroundColor,
  tabs,
  pages,
  onBackgroundColorChange,
  onTabsChange,
  onError,
}: {
  tabBackgroundColor: string;
  tabs: BottomTabItem[];
  pages: Array<{ id: string; title: string; slug?: string }>;
  onBackgroundColorChange: (color: string) => void;
  onTabsChange: (tabs: BottomTabItem[]) => void;
  onError: (message: string) => void;
}) {
  const [uploadingKey, setUploadingKey] = useState("");

  const updateTab = useCallback(
    (index: number, patch: Partial<BottomTabItem>) => {
      onTabsChange(tabs.map((tab, i) => (i === index ? { ...tab, ...patch } : tab)));
    },
    [onTabsChange, tabs],
  );

  const uploadIcon = useCallback(
    async (index: number, field: "actionIcon" | "inActiveIcon", file: File) => {
      const key = `${index}:${field}`;
      setUploadingKey(key);
      try {
        const uploaded = await directUploadMedia(file);
        updateTab(index, { [field]: uploaded.url });
      } catch (error) {
        onError(error instanceof Error ? error.message : "Failed to upload icon.");
      } finally {
        setUploadingKey("");
      }
    },
    [onError, updateTab],
  );

  return (
    <s-section heading="Bottom Tab">
      <s-stack direction="block" gap="base">
        <s-paragraph>
          Configure the native app tab bar. Saved tabs are served on GET
          /cms/settings (and still on the App Proxy /proxy/settings).
        </s-paragraph>

        <ColorField
          label="Tab Background Color"
          value={tabBackgroundColor}
          onChange={onBackgroundColorChange}
        />

        {tabs.map((tab, index) => (
          <s-box key={`tab-${index}`} padding="base" border="base" borderRadius="base">
            <s-stack direction="block" gap="base">
              <s-stack direction="inline" gap="small" alignItems="center" justifyContent="space-between">
                <s-heading>Tab {index + 1}</s-heading>
                <s-stack direction="inline" gap="small">
                  <s-button
                    variant="tertiary"
                    disabled={index === 0}
                    onClick={() => {
                      const next = [...tabs];
                      [next[index - 1], next[index]] = [next[index], next[index - 1]];
                      onTabsChange(next);
                    }}
                  >
                    Move up
                  </s-button>
                  <s-button
                    variant="tertiary"
                    disabled={index === tabs.length - 1}
                    onClick={() => {
                      const next = [...tabs];
                      [next[index + 1], next[index]] = [next[index], next[index + 1]];
                      onTabsChange(next);
                    }}
                  >
                    Move down
                  </s-button>
                  <s-button
                    tone="critical"
                    variant="tertiary"
                    onClick={() => onTabsChange(tabs.filter((_, i) => i !== index))}
                  >
                    Remove
                  </s-button>
                </s-stack>
              </s-stack>

              <s-grid gridTemplateColumns={twoCol} gap="base">
                <s-text-field
                  label="Page ID"
                  value={tab.pageId}
                  placeholder="home"
                  onChange={(event) =>
                    updateTab(index, {
                      pageId: event.currentTarget.value,
                    })
                  }
                ></s-text-field>
                <s-text-field
                  label="Tab Title"
                  value={tab.title}
                  placeholder="Home"
                  onChange={(event) =>
                    updateTab(index, {
                      title: event.currentTarget.value,
                    })
                  }
                ></s-text-field>
              </s-grid>

              <s-grid gridTemplateColumns={twoCol} gap="base">
                <IconPickerField
                  label="Active Icon"
                  url={tab.actionIcon}
                  uploading={uploadingKey === `${index}:actionIcon`}
                  onUpload={(file) => void uploadIcon(index, "actionIcon", file)}
                  onClear={() => updateTab(index, { actionIcon: "" })}
                />
                <IconPickerField
                  label="Inactive Icon"
                  url={tab.inActiveIcon}
                  uploading={uploadingKey === `${index}:inActiveIcon`}
                  onUpload={(file) => void uploadIcon(index, "inActiveIcon", file)}
                  onClear={() => updateTab(index, { inActiveIcon: "" })}
                />
              </s-grid>

              <s-grid gridTemplateColumns={twoCol} gap="base">
                <ColorField
                  label="Active Text Color"
                  value={tab.activeTextColor}
                  onChange={(color) => updateTab(index, { activeTextColor: color })}
                />
                <ColorField
                  label="Inactive Text Color"
                  value={tab.inActiveTextColor}
                  onChange={(color) => updateTab(index, { inActiveTextColor: color })}
                />
              </s-grid>

              <s-grid gridTemplateColumns={threeCol} gap="base">
                <s-text-field
                  label="Font Size"
                  value={String(tab.fontSize)}
                  onChange={(event) =>
                    updateTab(index, {
                      fontSize: Number(event.currentTarget.value) || 0,
                    })
                  }
                ></s-text-field>
                <s-text-field
                  label="Active Icon Size"
                  value={String(tab.activeIconSize)}
                  onChange={(event) =>
                    updateTab(index, {
                      activeIconSize: Number(event.currentTarget.value) || 0,
                    })
                  }
                ></s-text-field>
                <s-text-field
                  label="Inactive Icon Size"
                  value={String(tab.inActiveIconSize)}
                  onChange={(event) =>
                    updateTab(index, {
                      inActiveIconSize: Number(event.currentTarget.value) || 0,
                    })
                  }
                ></s-text-field>
              </s-grid>

              <s-checkbox
                label="Open as Separate Page"
                checked={tab.openAsSaperatePage}
                onChange={(event) =>
                  updateTab(index, {
                    openAsSaperatePage: event.currentTarget.checked,
                  })
                }
              ></s-checkbox>

              <TabActionEditor
                value={tab.action}
                pages={pages}
                onChange={(action) => updateTab(index, { action })}
              />
            </s-stack>
          </s-box>
        ))}

        <s-button
          variant="secondary"
          disabled={tabs.length >= 8}
          onClick={() => onTabsChange([...tabs, createEmptyBottomTab()])}
        >
          Add Tab
        </s-button>
      </s-stack>
    </s-section>
  );
}
