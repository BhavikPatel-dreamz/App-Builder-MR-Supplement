// @ts-nocheck
import { registerBlockType } from "gutenberg-block-kit/wp/blocks";
import {
  useBlockProps,
  InnerBlocks,
  InspectorControls,
  MediaUpload,
  MediaUploadCheck,
  PanelColorSettings,
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
  BRAND_SCROLLER_BLOCK,
  BRAND_SCROLLER_ITEM_BLOCK,
  APPBUILDER_CATEGORY,
} from "../constants";

const DEFAULT_TITLE = "Products";
const DEFAULT_SUBTITLE = "Australia's Most Popular Supplements";
const DEFAULT_BUTTON = "View more";
const DEFAULT_BG = "#ffffff";
const DEFAULT_TEXT = "#ffffff";
const DEFAULT_TITLE_SIZE = 12;
const DEFAULT_SUBTITLE_SIZE = 12;
const DEFAULT_BUTTON_SIZE = 10;
const DEFAULT_RADIUS = 10;

function toNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function registerBrandScrollerItem() {
  registerBlockType(BRAND_SCROLLER_ITEM_BLOCK, {
    apiVersion: 3,
    title: "Brand Scroller Item",
    category: APPBUILDER_CATEGORY,
    parent: [BRAND_SCROLLER_BLOCK],
    icon: "format-image",
    supports: { html: false, reusable: false },
    attributes: {
      imageUrl: { type: "string", default: "" },
      imageWidth: { type: "number", default: 0 },
      imageHeight: { type: "number", default: 0 },
      action: { type: "object", default: {} },
    },
    edit: ({ attributes, setAttributes }) => {
      const { imageUrl, action } = attributes;
      const blockProps = useBlockProps({
        className: "appbuilder-brand-scroller-item-editor",
        style: { minWidth: "96px" },
      });

      return (
        <>
          <InspectorControls>
            <PanelBody title="Brand" initialOpen>
              <ImagePicker
                imageUrl={imageUrl}
                onSelect={(media) =>
                  setAttributes(imageAttributesFromMedia(media))
                }
                onClear={() => setAttributes(clearImageAttributes())}
              />
              <ActionBuilder
                label="Action"
                value={action ?? {}}
                onChange={(next) => setAttributes({ action: next })}
              />
            </PanelBody>
          </InspectorControls>
          <div {...blockProps}>
            {imageUrl ? (
              <MediaUploadCheck>
                <MediaUpload
                  onSelect={(media) =>
                    setAttributes(imageAttributesFromMedia(media))
                  }
                  allowedTypes={["image"]}
                  render={({ open }) => (
                    <img
                      src={imageUrl}
                      alt=""
                      onClick={open}
                      style={{
                        width: "100%",
                        height: "64px",
                        objectFit: "contain",
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
                    setAttributes(imageAttributesFromMedia(media))
                  }
                  allowedTypes={["image"]}
                  render={({ open }) => (
                    <Button variant="secondary" onClick={open}>
                      Add logo
                    </Button>
                  )}
                />
              </MediaUploadCheck>
            )}
          </div>
        </>
      );
    },
    save: ({ attributes }) => {
      const { imageUrl, imageWidth, imageHeight, action } = attributes;
      const blockProps = useBlockProps.save({
        className: "appbuilder-brand-scroller-item",
        "data-image-url": imageUrl ?? "",
        "data-image-width": String(imageWidth ?? 0),
        "data-image-height": String(imageHeight ?? 0),
        "data-action": JSON.stringify(action ?? {}),
      });
      return (
        <div {...blockProps}>
          {imageUrl ? (
            <img
              src={imageUrl}
              alt=""
              className="appbuilder-brand-scroller-item__image"
            />
          ) : null}
        </div>
      );
    },
  });
}

function registerBrandScrollerParent() {
  registerBlockType(BRAND_SCROLLER_BLOCK, {
    apiVersion: 3,
    title: "Brand Scroller",
    category: APPBUILDER_CATEGORY,
    icon: "slides",
    supports: { html: false, align: ["wide", "full"] },
    attributes: {
      title: { type: "string", default: DEFAULT_TITLE },
      subTitle: { type: "string", default: DEFAULT_SUBTITLE },
      showTitle: { type: "boolean", default: true },
      showSubTitle: { type: "boolean", default: true },
      showButton: { type: "boolean", default: true },
      buttonText: { type: "string", default: DEFAULT_BUTTON },
      buttonTextColor: { type: "string", default: DEFAULT_TEXT },
      buttonFontSize: { type: "number", default: DEFAULT_BUTTON_SIZE },
      titleTextColor: { type: "string", default: DEFAULT_TEXT },
      titleFontSize: { type: "number", default: DEFAULT_TITLE_SIZE },
      subTitleTextColor: { type: "string", default: DEFAULT_TEXT },
      subTitleFontSize: { type: "number", default: DEFAULT_SUBTITLE_SIZE },
      ImageBorderRadius: { type: "number", default: DEFAULT_RADIUS },
      backgroundColor: { type: "string", default: DEFAULT_BG },
      showArrow: { type: "boolean", default: true },
      action: { type: "object", default: {} },
    },
    edit: ({ attributes, setAttributes }) => {
      const {
        title,
        subTitle,
        showTitle,
        showSubTitle,
        showButton,
        buttonText,
        buttonTextColor,
        buttonFontSize,
        titleTextColor,
        titleFontSize,
        subTitleTextColor,
        subTitleFontSize,
        ImageBorderRadius,
        backgroundColor,
        showArrow,
        action,
      } = attributes;
      const titleSize = toNumber(titleFontSize, DEFAULT_TITLE_SIZE);
      const subSize = toNumber(subTitleFontSize, DEFAULT_SUBTITLE_SIZE);
      const btnSize = toNumber(buttonFontSize, DEFAULT_BUTTON_SIZE);
      const radius = toNumber(ImageBorderRadius, DEFAULT_RADIUS);
      const blockProps = useBlockProps({
        className: "appbuilder-brand-scroller-editor",
        style: {
          background: backgroundColor || DEFAULT_BG,
          padding: "16px",
        },
      });

      return (
        <>
          <InspectorControls>
            <PanelBody title="Header" initialOpen>
              <ToggleControl
                label="Show Title"
                checked={!!showTitle}
                onChange={(value) => setAttributes({ showTitle: value })}
              />
              {showTitle ? (
                <>
                  <TextControl
                    label="Title"
                    value={title}
                    onChange={(value) => setAttributes({ title: value })}
                  />
                  <TextControl
                    label="Title Font Size"
                    type="number"
                    value={titleSize}
                    onChange={(value) =>
                      setAttributes({
                        titleFontSize: toNumber(value, DEFAULT_TITLE_SIZE),
                      })
                    }
                  />
                </>
              ) : null}
              <ToggleControl
                label="Show SubTitle"
                checked={!!showSubTitle}
                onChange={(value) => setAttributes({ showSubTitle: value })}
              />
              {showSubTitle ? (
                <>
                  <TextControl
                    label="SubTitle"
                    value={subTitle}
                    onChange={(value) => setAttributes({ subTitle: value })}
                  />
                  <TextControl
                    label="SubTitle Font Size"
                    type="number"
                    value={subSize}
                    onChange={(value) =>
                      setAttributes({
                        subTitleFontSize: toNumber(
                          value,
                          DEFAULT_SUBTITLE_SIZE,
                        ),
                      })
                    }
                  />
                </>
              ) : null}
              <ToggleControl
                label="Show Button"
                checked={!!showButton}
                onChange={(value) => setAttributes({ showButton: value })}
              />
              {showButton ? (
                <>
                  <TextControl
                    label="Button Text"
                    value={buttonText}
                    onChange={(value) => setAttributes({ buttonText: value })}
                  />
                  <TextControl
                    label="Button Font Size"
                    type="number"
                    value={btnSize}
                    onChange={(value) =>
                      setAttributes({
                        buttonFontSize: toNumber(value, DEFAULT_BUTTON_SIZE),
                      })
                    }
                  />
                  <ActionBuilder
                    label="Action"
                    value={action ?? {}}
                    onChange={(next) => setAttributes({ action: next })}
                  />
                </>
              ) : null}
              <TextControl
                label="Image Border Radius"
                type="number"
                value={radius}
                onChange={(value) =>
                  setAttributes({
                    ImageBorderRadius: toNumber(value, DEFAULT_RADIUS),
                  })
                }
              />
              <ToggleControl
                label="Show Arrow"
                checked={!!showArrow}
                onChange={(value) => setAttributes({ showArrow: value })}
              />
            </PanelBody>
            <PanelColorSettings
              title="Colors"
              colorSettings={[
                {
                  label: "Background Color",
                  value: backgroundColor || DEFAULT_BG,
                  onChange: (value) =>
                    setAttributes({ backgroundColor: value || DEFAULT_BG }),
                },
                {
                  label: "Title Text Color",
                  value: titleTextColor || DEFAULT_TEXT,
                  onChange: (value) =>
                    setAttributes({ titleTextColor: value || DEFAULT_TEXT }),
                },
                {
                  label: "SubTitle Text Color",
                  value: subTitleTextColor || DEFAULT_TEXT,
                  onChange: (value) =>
                    setAttributes({
                      subTitleTextColor: value || DEFAULT_TEXT,
                    }),
                },
                {
                  label: "Button Text Color",
                  value: buttonTextColor || DEFAULT_TEXT,
                  onChange: (value) =>
                    setAttributes({ buttonTextColor: value || DEFAULT_TEXT }),
                },
              ]}
            />
          </InspectorControls>
          <div {...blockProps}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: "12px",
                marginBottom: "12px",
              }}
            >
              <div>
                {showTitle ? (
                  <h3
                    style={{
                      margin: 0,
                      fontSize: `${titleSize}px`,
                      color: titleTextColor || DEFAULT_TEXT,
                    }}
                  >
                    {title || DEFAULT_TITLE}
                  </h3>
                ) : null}
                {showSubTitle ? (
                  <p
                    style={{
                      margin: "4px 0 0",
                      fontSize: `${subSize}px`,
                      color: subTitleTextColor || DEFAULT_TEXT,
                    }}
                  >
                    {subTitle}
                  </p>
                ) : null}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                {showButton ? (
                  <span
                    style={{
                      fontSize: `${btnSize}px`,
                      color: buttonTextColor || DEFAULT_TEXT,
                    }}
                  >
                    {buttonText || DEFAULT_BUTTON}
                  </span>
                ) : null}
                {showArrow ? <span aria-hidden="true">›</span> : null}
              </div>
            </div>
            <div style={{ borderRadius: `${radius}px`, overflow: "hidden" }}>
              <InnerBlocks
                allowedBlocks={[BRAND_SCROLLER_ITEM_BLOCK]}
                template={[
                  [BRAND_SCROLLER_ITEM_BLOCK, {}],
                  [BRAND_SCROLLER_ITEM_BLOCK, {}],
                ]}
                orientation="horizontal"
                templateLock={false}
                renderAppender={InnerBlocks.ButtonBlockAppender}
              />
            </div>
          </div>
        </>
      );
    },
    save: ({ attributes }) => {
      const {
        title,
        subTitle,
        showTitle,
        showSubTitle,
        showButton,
        buttonText,
        buttonTextColor,
        buttonFontSize,
        titleTextColor,
        titleFontSize,
        subTitleTextColor,
        subTitleFontSize,
        ImageBorderRadius,
        backgroundColor,
        showArrow,
        action,
      } = attributes;
      const radius = toNumber(ImageBorderRadius, DEFAULT_RADIUS);
      const blockProps = useBlockProps.save({
        className: "appbuilder-brand-scroller",
        "data-title": title ?? "",
        "data-subtitle": subTitle ?? "",
        "data-show-title": String(!!showTitle),
        "data-show-subtitle": String(!!showSubTitle),
        "data-show-button": String(!!showButton),
        "data-button-text": buttonText ?? "",
        "data-button-text-color": buttonTextColor || DEFAULT_TEXT,
        "data-button-font-size": String(
          toNumber(buttonFontSize, DEFAULT_BUTTON_SIZE),
        ),
        "data-title-text-color": titleTextColor || DEFAULT_TEXT,
        "data-title-font-size": String(
          toNumber(titleFontSize, DEFAULT_TITLE_SIZE),
        ),
        "data-subtitle-text-color": subTitleTextColor || DEFAULT_TEXT,
        "data-subtitle-font-size": String(
          toNumber(subTitleFontSize, DEFAULT_SUBTITLE_SIZE),
        ),
        "data-image-border-radius": String(radius),
        "data-background-color": backgroundColor || DEFAULT_BG,
        "data-show-arrow": String(!!showArrow),
        "data-action": JSON.stringify(action ?? {}),
        style: { background: backgroundColor || DEFAULT_BG },
      });
      return (
        <div {...blockProps}>
          {showTitle && title ? (
            <h3 className="appbuilder-brand-scroller__title">{title}</h3>
          ) : null}
          {showSubTitle && subTitle ? (
            <p className="appbuilder-brand-scroller__subtitle">{subTitle}</p>
          ) : null}
          {showButton && buttonText ? (
            <span className="appbuilder-brand-scroller__button">{buttonText}</span>
          ) : null}
          <InnerBlocks.Content />
        </div>
      );
    },
  });
}

export function registerBrandScroller() {
  registerBrandScrollerItem();
  registerBrandScrollerParent();
}
