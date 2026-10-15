import { useCallback, useState } from "react";

import { directUploadMedia } from "../../lib/upload-client";
import {
  createEmptyTopMarqueeItem,
  type HomePageSettings,
  type TopMarqueeItem,
  type TopMarqueeSettings,
} from "../../lib/home-page-settings";
import { ColorField, IconPickerField } from "./BottomTabsEditor";
import { TabActionEditor } from "./TabActionEditor";

const twoCol = "1fr 1fr";

export function HomePageSettingsEditor({
  value,
  pages,
  onChange,
  onError,
}: {
  value: HomePageSettings;
  pages: Array<{ id: string; title: string; slug?: string }>;
  onChange: (next: HomePageSettings) => void;
  onError: (message: string) => void;
}) {
  const [uploadingIndex, setUploadingIndex] = useState<number | null>(null);
  const topMarquee = value.topMarquee;

  const setTopMarquee = useCallback(
    (patch: Partial<TopMarqueeSettings>) => {
      onChange({
        ...value,
        topMarquee: { ...topMarquee, ...patch },
      });
    },
    [onChange, topMarquee, value],
  );

  const updateItem = useCallback(
    (index: number, patch: Partial<TopMarqueeItem>) => {
      setTopMarquee({
        items: topMarquee.items.map((item, i) =>
          i === index ? { ...item, ...patch } : item,
        ),
      });
    },
    [setTopMarquee, topMarquee.items],
  );

  const uploadIcon = useCallback(
    async (index: number, file: File) => {
      setUploadingIndex(index);
      try {
        const uploaded = await directUploadMedia(file);
        updateItem(index, { iconUrl: uploaded.url });
      } catch (error) {
        onError(error instanceof Error ? error.message : "Failed to upload icon.");
      } finally {
        setUploadingIndex(null);
      }
    },
    [onError, updateItem],
  );

  return (
    <s-section heading="Home Page">
      <s-stack direction="block" gap="base">
        <s-paragraph>
          Homepage options for the native app. Saved on GET /cms/settings.
          More homepage sections can be added here later.
        </s-paragraph>

        <s-box padding="base" border="base" borderRadius="base">
          <s-stack direction="block" gap="base">
            <s-heading>Top Marquee</s-heading>

            <s-checkbox
              label="Enable Auto Slide"
              checked={topMarquee.enableAutoSlide}
              onChange={(event) =>
                setTopMarquee({ enableAutoSlide: event.currentTarget.checked })
              }
            ></s-checkbox>

            <s-grid gridTemplateColumns={twoCol} gap="base">
              <s-text-field
                label="Auto Slide Delay"
                value={String(topMarquee.autoSlideDelay)}
                onChange={(event) =>
                  setTopMarquee({
                    autoSlideDelay: Number(event.currentTarget.value) || 0,
                  })
                }
              ></s-text-field>
              <s-text-field
                label="Block Height"
                value={String(topMarquee.blockHeight)}
                onChange={(event) =>
                  setTopMarquee({
                    blockHeight: Number(event.currentTarget.value) || 0,
                  })
                }
              ></s-text-field>
            </s-grid>

            <s-checkbox
              label="Show Divider"
              checked={topMarquee.showDivider}
              onChange={(event) =>
                setTopMarquee({ showDivider: event.currentTarget.checked })
              }
            ></s-checkbox>

            <s-grid gridTemplateColumns={twoCol} gap="base">
              <s-text-field
                label="Divider Height"
                value={String(topMarquee.dividerHeight)}
                onChange={(event) =>
                  setTopMarquee({
                    dividerHeight: Number(event.currentTarget.value) || 0,
                  })
                }
              ></s-text-field>
              <ColorField
                label="Divider Color"
                value={topMarquee.dividerColor}
                onChange={(color) => setTopMarquee({ dividerColor: color })}
              />
            </s-grid>

            <ColorField
              label="Background Color"
              value={topMarquee.backgroundColor}
              onChange={(color) => setTopMarquee({ backgroundColor: color })}
            />

            <TabActionEditor
              value={topMarquee.action}
              pages={pages}
              onChange={(action) => setTopMarquee({ action })}
            />

            <s-heading>Add Marquee</s-heading>

            {topMarquee.items.map((item, index) => (
              <s-box
                key={`marquee-${index}`}
                padding="base"
                border="base"
                borderRadius="base"
              >
                <s-stack direction="block" gap="base">
                  <s-stack
                    direction="inline"
                    gap="small"
                    alignItems="center"
                    justifyContent="space-between"
                  >
                    <s-heading>Marquee {index + 1}</s-heading>
                    <s-stack direction="inline" gap="small">
                      <s-button
                        variant="tertiary"
                        disabled={index === 0}
                        onClick={() => {
                          const next = [...topMarquee.items];
                          [next[index - 1], next[index]] = [
                            next[index],
                            next[index - 1],
                          ];
                          setTopMarquee({ items: next });
                        }}
                      >
                        Move up
                      </s-button>
                      <s-button
                        variant="tertiary"
                        disabled={index === topMarquee.items.length - 1}
                        onClick={() => {
                          const next = [...topMarquee.items];
                          [next[index + 1], next[index]] = [
                            next[index],
                            next[index + 1],
                          ];
                          setTopMarquee({ items: next });
                        }}
                      >
                        Move down
                      </s-button>
                      <s-button
                        tone="critical"
                        variant="tertiary"
                        onClick={() =>
                          setTopMarquee({
                            items: topMarquee.items.filter((_, i) => i !== index),
                          })
                        }
                      >
                        Remove
                      </s-button>
                    </s-stack>
                  </s-stack>

                  <IconPickerField
                    label="Icon"
                    url={item.iconUrl}
                    uploading={uploadingIndex === index}
                    onUpload={(file) => void uploadIcon(index, file)}
                    onClear={() => updateItem(index, { iconUrl: "" })}
                  />

                  <s-grid gridTemplateColumns={twoCol} gap="base">
                    <s-text-field
                      label="Icon Height"
                      value={String(item.iconHeight)}
                      onChange={(event) =>
                        updateItem(index, {
                          iconHeight: Number(event.currentTarget.value) || 0,
                        })
                      }
                    ></s-text-field>
                    <s-text-field
                      label="Icon Width"
                      value={String(item.iconWidth)}
                      onChange={(event) =>
                        updateItem(index, {
                          iconWidth: Number(event.currentTarget.value) || 0,
                        })
                      }
                    ></s-text-field>
                  </s-grid>

                  <s-text-field
                    label="Text"
                    value={item.text}
                    onChange={(event) =>
                      updateItem(index, { text: event.currentTarget.value })
                    }
                  ></s-text-field>

                  <s-grid gridTemplateColumns={twoCol} gap="base">
                    <ColorField
                      label="Text Color"
                      value={item.textColor}
                      onChange={(color) => updateItem(index, { textColor: color })}
                    />
                    <s-text-field
                      label="Text Font Size"
                      value={String(item.textFontSize)}
                      onChange={(event) =>
                        updateItem(index, {
                          textFontSize: Number(event.currentTarget.value) || 0,
                        })
                      }
                    ></s-text-field>
                  </s-grid>

                  <TabActionEditor
                    value={item.action}
                    pages={pages}
                    onChange={(action) => updateItem(index, { action })}
                  />
                </s-stack>
              </s-box>
            ))}

            <s-button
              variant="secondary"
              disabled={topMarquee.items.length >= 20}
              onClick={() =>
                setTopMarquee({
                  items: [...topMarquee.items, createEmptyTopMarqueeItem()],
                })
              }
            >
              Add Marquee
            </s-button>
          </s-stack>
        </s-box>
      </s-stack>
    </s-section>
  );
}
