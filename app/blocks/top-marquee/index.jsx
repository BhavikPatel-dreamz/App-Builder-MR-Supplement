// @ts-nocheck
import { registerBlockType } from "gutenberg-block-kit/wp/blocks";
import {
  useBlockProps,
  InnerBlocks,
  InspectorControls,
  PanelColorSettings,
  MediaUpload,
  MediaUploadCheck,
} from "gutenberg-block-kit/wp/block-editor";
import {
  PanelBody,
  TextControl,
  ToggleControl,
  Button,
} from "gutenberg-block-kit/wp/components";
import { ActionBuilder } from "gutenberg-block-kit/actions";
import {
  ImagePicker,
  imageAttributesFromMedia,
  clearImageAttributes,
} from "../inspector-shared";
import {
  TOP_MARQUEE_BLOCK,
  TOP_MARQUEE_ITEM_BLOCK,
  APPBUILDER_CATEGORY,
} from "../constants";

const DEFAULT_DELAY = 2000;
const DEFAULT_HEIGHT = 15;
const DEFAULT_DIVIDER_HEIGHT = 4;
const DEFAULT_DIVIDER_COLOR = "#ffffff";
const DEFAULT_BG = "#1A1C1E";
const DEFAULT_TEXT_COLOR = "#ffffff";
const DEFAULT_FONT_SIZE = 10;

function toNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function registerTopMarqueeItem() {
  registerBlockType(TOP_MARQUEE_ITEM_BLOCK, {
    apiVersion: 3,
    title: "Top Marquee Item",
    category: APPBUILDER_CATEGORY,
    parent: [TOP_MARQUEE_BLOCK],
    icon: "tag",
    supports: { html: false, reusable: false },
    attributes: {
      iconUrl: { type: "string", default: "" },
      imageWidth: { type: "number", default: 0 },
      imageHeight: { type: "number", default: 0 },
      text: { type: "string", default: "" },
      textColor: { type: "string", default: DEFAULT_TEXT_COLOR },
      textFontSize: { type: "number", default: DEFAULT_FONT_SIZE },
      action: { type: "object", default: {} },
    },
    edit: ({ attributes, setAttributes }) => {
      const {
        iconUrl,
        imageWidth,
        imageHeight,
        text,
        textColor,
        textFontSize,
        action,
      } = attributes;
      const fontSize = toNumber(textFontSize, DEFAULT_FONT_SIZE);
      const iconW = toNumber(imageWidth, 0) || 18;
      const iconH = toNumber(imageHeight, 0) || 18;
      const blockProps = useBlockProps({
        className: "appbuilder-top-marquee-item-editor",
      });

      return (
        <>
          <InspectorControls>
            <PanelBody title="Marquee Item" initialOpen>
              <ImagePicker
                imageUrl={iconUrl}
                onSelect={(media) =>
                  setAttributes(imageAttributesFromMedia(media, "iconUrl"))
                }
                onClear={() =>
                  setAttributes(clearImageAttributes("iconUrl"))
                }
              />
              <TextControl
                label="Text"
                value={text}
                onChange={(value) => setAttributes({ text: value })}
              />
              <TextControl
                label="Text Font Size"
                type="number"
                min={0}
                value={fontSize}
                onChange={(value) =>
                  setAttributes({
                    textFontSize: toNumber(value, DEFAULT_FONT_SIZE),
                  })
                }
              />
              <ActionBuilder
                label="Action"
                value={action ?? {}}
                onChange={(next) => setAttributes({ action: next })}
              />
            </PanelBody>
            <PanelColorSettings
              title="Colors"
              colorSettings={[
                {
                  label: "Text Color",
                  value: textColor || DEFAULT_TEXT_COLOR,
                  onChange: (value) =>
                    setAttributes({
                      textColor: value || DEFAULT_TEXT_COLOR,
                    }),
                },
              ]}
            />
          </InspectorControls>
          <div {...blockProps}>
            {iconUrl ? (
              <MediaUploadCheck>
                <MediaUpload
                  onSelect={(media) =>
                    setAttributes(imageAttributesFromMedia(media, "iconUrl"))
                  }
                  allowedTypes={["image"]}
                  render={({ open }) => (
                    <img
                      src={iconUrl}
                      alt=""
                      className="appbuilder-top-marquee-item-editor__icon"
                      onClick={open}
                      style={{
                        width: iconW,
                        height: iconH,
                        cursor: "pointer",
                      }}
                    />
                  )}
                />
              </MediaUploadCheck>
            ) : (
              <MediaUploadCheck>
                <MediaUpload
                  onSelect={(media) =>
                    setAttributes(imageAttributesFromMedia(media, "iconUrl"))
                  }
                  allowedTypes={["image"]}
                  render={({ open }) => (
                    <Button variant="secondary" onClick={open}>
                      Add icon
                    </Button>
                  )}
                />
              </MediaUploadCheck>
            )}
            <span
              className="appbuilder-top-marquee-item-editor__text"
              style={{
                color: textColor || DEFAULT_TEXT_COLOR,
                fontSize: `${Math.max(toNumber(fontSize, 0), 0)}px`,
              }}
            >
              {text || "Marquee text"}
            </span>
          </div>
        </>
      );
    },
    save: ({ attributes }) => {
      const {
        iconUrl,
        imageWidth,
        imageHeight,
        text,
        textColor,
        textFontSize,
        action,
      } = attributes;
      const blockProps = useBlockProps.save({
        className: "appbuilder-top-marquee-item",
        "data-icon-url": iconUrl ?? "",
        "data-image-width": String(imageWidth ?? 0),
        "data-image-height": String(imageHeight ?? 0),
        "data-text": text ?? "",
        "data-text-color": textColor || DEFAULT_TEXT_COLOR,
        "data-text-font-size": String(
          toNumber(textFontSize, DEFAULT_FONT_SIZE),
        ),
        "data-action": JSON.stringify(action ?? {}),
      });
      return (
        <div {...blockProps}>
          {iconUrl ? (
            <img
              src={iconUrl}
              alt=""
              className="appbuilder-top-marquee-item__icon"
            />
          ) : null}
          {text ? (
            <span className="appbuilder-top-marquee-item__text">{text}</span>
          ) : null}
        </div>
      );
    },
  });
}

function registerTopMarqueeParent() {
  registerBlockType(TOP_MARQUEE_BLOCK, {
    apiVersion: 3,
    title: "Top Marquee",
    category: APPBUILDER_CATEGORY,
    icon: "leftright",
    supports: { html: false, align: ["wide", "full"] },
    attributes: {
      enableAutoSlide: { type: "boolean", default: true },
      autoSlideDelay: { type: "number", default: DEFAULT_DELAY },
      blockHeight: { type: "number", default: DEFAULT_HEIGHT },
      showDivider: { type: "boolean", default: true },
      dividerHeight: { type: "number", default: DEFAULT_DIVIDER_HEIGHT },
      dividerColor: { type: "string", default: DEFAULT_DIVIDER_COLOR },
      backgroundColor: { type: "string", default: DEFAULT_BG },
      action: { type: "object", default: {} },
    },
    edit: ({ attributes, setAttributes }) => {
      const {
        enableAutoSlide,
        autoSlideDelay,
        blockHeight,
        showDivider,
        dividerHeight,
        dividerColor,
        backgroundColor,
        action,
      } = attributes;
      const delay = toNumber(autoSlideDelay, DEFAULT_DELAY);
      const height = toNumber(blockHeight, DEFAULT_HEIGHT);
      const dividerH = toNumber(dividerHeight, DEFAULT_DIVIDER_HEIGHT);
      const showingDivider = showDivider ?? true;
      const previewHeight = Math.max(height, 40);
      const blockProps = useBlockProps({
        className: `appbuilder-top-marquee-editor${
          showingDivider ? " is-showing-divider" : ""
        }`,
        style: {
          background: backgroundColor || DEFAULT_BG,
          minHeight: `${previewHeight}px`,
          "--appbuilder-top-marquee-divider-height": `${dividerH}px`,
          "--appbuilder-top-marquee-divider-color":
            dividerColor || DEFAULT_DIVIDER_COLOR,
        },
      });

      return (
        <>
          <InspectorControls>
            <PanelBody title="Marquee" initialOpen>
              <ToggleControl
                label="Enable Auto Slide"
                checked={enableAutoSlide ?? true}
                onChange={(value) => setAttributes({ enableAutoSlide: value })}
              />
              <TextControl
                label="Auto Slide Delay"
                type="number"
                min={0}
                value={delay}
                onChange={(value) =>
                  setAttributes({
                    autoSlideDelay: toNumber(value, DEFAULT_DELAY),
                  })
                }
              />
              <TextControl
                label="Block Height"
                type="number"
                min={0}
                value={height}
                onChange={(value) =>
                  setAttributes({
                    blockHeight: toNumber(value, DEFAULT_HEIGHT),
                  })
                }
              />
              <ToggleControl
                label="Show Divider"
                checked={showDivider ?? true}
                onChange={(value) => setAttributes({ showDivider: value })}
              />
              {(showDivider ?? true) ? (
                <TextControl
                  label="Divider Height"
                  type="number"
                  min={0}
                  value={dividerH}
                  onChange={(value) =>
                    setAttributes({
                      dividerHeight: toNumber(value, DEFAULT_DIVIDER_HEIGHT),
                    })
                  }
                />
              ) : null}
              <ActionBuilder
                label="Action"
                value={action ?? {}}
                onChange={(next) => setAttributes({ action: next })}
              />
            </PanelBody>
            <PanelColorSettings
              title="Colors"
              colorSettings={[
                {
                  label: "Divider Color",
                  value: dividerColor || DEFAULT_DIVIDER_COLOR,
                  onChange: (value) =>
                    setAttributes({
                      dividerColor: value || DEFAULT_DIVIDER_COLOR,
                    }),
                },
                {
                  label: "Background Color",
                  value: backgroundColor || DEFAULT_BG,
                  onChange: (value) =>
                    setAttributes({
                      backgroundColor: value || DEFAULT_BG,
                    }),
                },
              ]}
            />
          </InspectorControls>
          <div {...blockProps}>
            <InnerBlocks
              allowedBlocks={[TOP_MARQUEE_ITEM_BLOCK]}
              template={[
                [
                  TOP_MARQUEE_ITEM_BLOCK,
                  { text: "Trusted since 2004" },
                ],
                [
                  TOP_MARQUEE_ITEM_BLOCK,
                  { text: "Proudly Australian owned" },
                ],
              ]}
              orientation="horizontal"
              templateLock={false}
              renderAppender={InnerBlocks.ButtonBlockAppender}
            />
          </div>
        </>
      );
    },
    save: ({ attributes }) => {
      const {
        enableAutoSlide,
        autoSlideDelay,
        blockHeight,
        showDivider,
        dividerHeight,
        dividerColor,
        backgroundColor,
        action,
      } = attributes;
      const blockProps = useBlockProps.save({
        className: "appbuilder-top-marquee",
        "data-enable-auto-slide": String(enableAutoSlide ?? true),
        "data-auto-slide-delay": String(
          toNumber(autoSlideDelay, DEFAULT_DELAY),
        ),
        "data-block-height": String(toNumber(blockHeight, DEFAULT_HEIGHT)),
        "data-show-divider": String(showDivider ?? true),
        "data-divider-height": String(
          toNumber(dividerHeight, DEFAULT_DIVIDER_HEIGHT),
        ),
        "data-divider-color": dividerColor || DEFAULT_DIVIDER_COLOR,
        "data-background-color": backgroundColor || DEFAULT_BG,
        "data-action": JSON.stringify(action ?? {}),
        style: {
          background: backgroundColor || DEFAULT_BG,
        },
      });
      return (
        <div {...blockProps}>
          <InnerBlocks.Content />
        </div>
      );
    },
  });
}

export function registerTopMarquee() {
  registerTopMarqueeItem();
  registerTopMarqueeParent();
}
