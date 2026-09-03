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
  TextareaControl,
  Button,
} from "gutenberg-block-kit/wp/components";
import { ActionBuilder } from "gutenberg-block-kit/actions";
import {
  ImagePicker,
  imageAttributesFromMedia,
  clearImageAttributes,
} from "../inspector-shared";
import {
  SOCIAL_FEED_BLOCK,
  SOCIAL_FEED_ITEM_BLOCK,
  APPBUILDER_CATEGORY,
} from "../constants";

const DEFAULT_TITLE = "FOLLOW @MRSUPPLEMENT";
const DEFAULT_SUBTITLE = "Real customers, athletes and the latest products.";
const DEFAULT_BUTTON = "FOLLOW ON INSTAGRAM";
const DEFAULT_BG = "#ffffff";
const DEFAULT_TEXT = "#ffffff";
const PREVIEW_TITLE_COLOR = "#111111";
const PREVIEW_SUBTITLE_COLOR = "#8a8a8a";
const PREVIEW_BUTTON_COLOR = "#8bc53f";
const DEFAULT_TITLE_SIZE = 12;
const DEFAULT_SUBTITLE_SIZE = 12;
const DEFAULT_BUTTON_SIZE = 10;
const DEFAULT_RADIUS = 10;
const DEFAULT_BORDER_WIDTH = 2;
const DEFAULT_BORDER = "#ffffff";
const DEFAULT_CAPTION =
  "Pre-workout pump is unmatched Who's training today? 💪";
const DEFAULT_CAPTION_TWO = "Rule 1 Whey Protein - V Cream is back in stock!";

function toNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function previewColor(value, fallback) {
  const raw = String(value || "").trim();
  if (!raw || raw.toLowerCase() === "#ffffff" || raw.toLowerCase() === "#fff") {
    return fallback;
  }
  return raw;
}

function TitleWithHandle({ title, className, handleClassName, style }) {
  const text = title || DEFAULT_TITLE;
  const at = text.indexOf("@");
  if (at === -1) {
    return (
      <h3 className={className} style={style}>
        {text}
      </h3>
    );
  }
  return (
    <h3 className={className} style={style}>
      {text.slice(0, at)}
      <span className={handleClassName}>{text.slice(at)}</span>
    </h3>
  );
}

function InstagramMark() {
  return (
    <svg
      className="appbuilder-social-feed-item-editor__ig"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
    >
      <rect x="3" y="3" width="18" height="18" rx="5" stroke="currentColor" strokeWidth="2" />
      <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="2" />
      <circle cx="17.5" cy="6.5" r="1" fill="currentColor" />
    </svg>
  );
}

function registerSocialFeedItem() {
  registerBlockType(SOCIAL_FEED_ITEM_BLOCK, {
    apiVersion: 3,
    title: "Social Feed Item",
    category: APPBUILDER_CATEGORY,
    parent: [SOCIAL_FEED_BLOCK],
    icon: "format-image",
    supports: { html: false, reusable: false },
    attributes: {
      imageUrl: { type: "string", default: "" },
      imageWidth: { type: "number", default: 0 },
      imageHeight: { type: "number", default: 0 },
      userName: { type: "string", default: "" },
      caption: { type: "string", default: "" },
      postedTime: { type: "string", default: "" },
      action: { type: "object", default: {} },
    },
    edit: ({ attributes, setAttributes }) => {
      const { imageUrl, userName, caption, postedTime, action } = attributes;
      const blockProps = useBlockProps({
        className: "appbuilder-social-feed-item-editor",
      });

      return (
        <>
          <InspectorControls>
            <PanelBody title="Post" initialOpen>
              <ImagePicker
                imageUrl={imageUrl}
                onSelect={(media) =>
                  setAttributes(imageAttributesFromMedia(media))
                }
                onClear={() => setAttributes(clearImageAttributes())}
              />
              <TextControl
                label="Username"
                value={userName}
                onChange={(value) => setAttributes({ userName: value })}
              />
              <TextareaControl
                label="Caption"
                value={caption}
                rows={3}
                onChange={(value) => setAttributes({ caption: value })}
              />
              <TextControl
                label="Posted Time"
                value={postedTime}
                onChange={(value) => setAttributes({ postedTime: value })}
              />
              <ActionBuilder
                label="Action"
                value={action ?? {}}
                onChange={(next) => setAttributes({ action: next })}
              />
            </PanelBody>
          </InspectorControls>
          <div {...blockProps}>
            <div className="appbuilder-social-feed-item-editor__media">
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
                        className="appbuilder-social-feed-item-editor__image"
                        onClick={open}
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
                      <Button
                        variant="secondary"
                        onClick={open}
                        style={{ width: "100%", height: "100%" }}
                      >
                        Add image
                      </Button>
                    )}
                  />
                </MediaUploadCheck>
              )}
              <InstagramMark />
            </div>
            <div className="appbuilder-social-feed-item-editor__body">
              <div className="appbuilder-social-feed-item-editor__user">
                <span className="appbuilder-social-feed-item-editor__avatar" />
                <span className="appbuilder-social-feed-item-editor__username">
                  {userName || "mrsupplement"}
                </span>
              </div>
              <p className="appbuilder-social-feed-item-editor__caption">
                {caption || DEFAULT_CAPTION}
              </p>
              <div className="appbuilder-social-feed-item-editor__time">
                {postedTime || "2d"}
              </div>
            </div>
          </div>
        </>
      );
    },
    save: ({ attributes }) => {
      const {
        imageUrl,
        imageWidth,
        imageHeight,
        userName,
        caption,
        postedTime,
        action,
      } = attributes;
      const blockProps = useBlockProps.save({
        className: "appbuilder-social-feed-item",
        "data-image-url": imageUrl ?? "",
        "data-image-width": String(imageWidth ?? 0),
        "data-image-height": String(imageHeight ?? 0),
        "data-username": userName ?? "",
        "data-caption": caption ?? "",
        "data-posted-time": postedTime ?? "",
        "data-action": JSON.stringify(action ?? {}),
      });
      return (
        <div {...blockProps}>
          {imageUrl ? (
            <img
              src={imageUrl}
              alt=""
              className="appbuilder-social-feed-item__image"
            />
          ) : null}
          {userName ? (
            <span className="appbuilder-social-feed-item__username">
              {userName}
            </span>
          ) : null}
          {postedTime ? (
            <span className="appbuilder-social-feed-item__time">{postedTime}</span>
          ) : null}
          {caption ? (
            <p className="appbuilder-social-feed-item__caption">{caption}</p>
          ) : null}
        </div>
      );
    },
  });
}

function registerSocialFeedParent() {
  registerBlockType(SOCIAL_FEED_BLOCK, {
    apiVersion: 3,
    title: "Social Feed",
    category: APPBUILDER_CATEGORY,
    icon: "share",
    supports: { html: false, align: ["wide", "full"] },
    attributes: {
      backgroundColor: { type: "string", default: DEFAULT_BG },
      title: { type: "string", default: DEFAULT_TITLE },
      subTitle: { type: "string", default: DEFAULT_SUBTITLE },
      buttonText: { type: "string", default: DEFAULT_BUTTON },
      buttonTextColor: { type: "string", default: DEFAULT_TEXT },
      buttonFontSize: { type: "number", default: DEFAULT_BUTTON_SIZE },
      titleTextColor: { type: "string", default: DEFAULT_TEXT },
      titleFontSize: { type: "number", default: DEFAULT_TITLE_SIZE },
      buttonBorderRadius: { type: "number", default: DEFAULT_RADIUS },
      buttonBorderColor: { type: "string", default: DEFAULT_BORDER },
      buttonBorderWidth: { type: "number", default: DEFAULT_BORDER_WIDTH },
      subTitleTextColor: { type: "string", default: DEFAULT_TEXT },
      subTitleFontSize: { type: "number", default: DEFAULT_SUBTITLE_SIZE },
      action: { type: "object", default: {} },
    },
    edit: ({ attributes, setAttributes }) => {
      const {
        backgroundColor,
        title,
        subTitle,
        buttonText,
        buttonTextColor,
        buttonFontSize,
        titleTextColor,
        titleFontSize,
        buttonBorderRadius,
        buttonBorderColor,
        buttonBorderWidth,
        subTitleTextColor,
        subTitleFontSize,
        action,
      } = attributes;
      const titleSize = Math.max(toNumber(titleFontSize, DEFAULT_TITLE_SIZE), 0);
      const subSize = Math.max(
        toNumber(subTitleFontSize, DEFAULT_SUBTITLE_SIZE),
        0,
      );
      const btnSize = Math.max(
        toNumber(buttonFontSize, DEFAULT_BUTTON_SIZE),
        0,
      );
      const radius = toNumber(buttonBorderRadius, DEFAULT_RADIUS);
      const borderW = Math.max(
        toNumber(buttonBorderWidth, DEFAULT_BORDER_WIDTH),
        0,
      );
      const blockProps = useBlockProps({
        className: "appbuilder-social-feed-editor",
        style: {
          background: backgroundColor || DEFAULT_BG,
        },
      });

      return (
        <>
          <InspectorControls>
            <PanelBody title="Header" initialOpen>
              <TextControl
                label="Title"
                value={title}
                onChange={(value) => setAttributes({ title: value })}
              />
              <TextControl
                label="SubTitle"
                value={subTitle}
                onChange={(value) => setAttributes({ subTitle: value })}
              />
              <TextControl
                label="Button Text"
                value={buttonText}
                onChange={(value) => setAttributes({ buttonText: value })}
              />
              <TextControl
                label="Title Font Size"
                type="number"
                min={0}
                value={titleSize}
                onChange={(value) =>
                  setAttributes({
                    titleFontSize: toNumber(value, DEFAULT_TITLE_SIZE),
                  })
                }
              />
              <TextControl
                label="SubTitle Font Size"
                type="number"
                min={0}
                value={subSize}
                onChange={(value) =>
                  setAttributes({
                    subTitleFontSize: toNumber(value, DEFAULT_SUBTITLE_SIZE),
                  })
                }
              />
              <TextControl
                label="Button Font Size"
                type="number"
                min={0}
                value={btnSize}
                onChange={(value) =>
                  setAttributes({
                    buttonFontSize: toNumber(value, DEFAULT_BUTTON_SIZE),
                  })
                }
              />
              <TextControl
                label="Button Border Radius"
                type="number"
                min={0}
                value={radius}
                onChange={(value) =>
                  setAttributes({
                    buttonBorderRadius: toNumber(value, DEFAULT_RADIUS),
                  })
                }
              />
              <TextControl
                label="Button Border Width"
                type="number"
                min={0}
                value={borderW}
                onChange={(value) =>
                  setAttributes({
                    buttonBorderWidth: toNumber(value, DEFAULT_BORDER_WIDTH),
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
                {
                  label: "Button Border Color",
                  value: buttonBorderColor || DEFAULT_BORDER,
                  onChange: (value) =>
                    setAttributes({
                      buttonBorderColor: value || DEFAULT_BORDER,
                    }),
                },
              ]}
            />
          </InspectorControls>
          <div {...blockProps}>
            <div className="appbuilder-sf-preview__header">
              <TitleWithHandle
                title={title}
                className="appbuilder-sf-preview__title"
                handleClassName="appbuilder-sf-preview__handle"
                style={{
                  fontSize: `${titleSize}px`,
                  color: previewColor(titleTextColor, PREVIEW_TITLE_COLOR),
                }}
              />
              {subTitle ? (
                <p
                  className="appbuilder-sf-preview__subtitle"
                  style={{
                    fontSize: `${subSize}px`,
                    color: previewColor(
                      subTitleTextColor,
                      PREVIEW_SUBTITLE_COLOR,
                    ),
                  }}
                >
                  {subTitle}
                </p>
              ) : null}
            </div>
            <div className="appbuilder-sf-preview__track">
              <InnerBlocks
                allowedBlocks={[SOCIAL_FEED_ITEM_BLOCK]}
                template={[
                  [
                    SOCIAL_FEED_ITEM_BLOCK,
                    {
                      userName: "mrsupplement",
                      caption: DEFAULT_CAPTION,
                      postedTime: "2d",
                    },
                  ],
                  [
                    SOCIAL_FEED_ITEM_BLOCK,
                    {
                      userName: "mrsupplement",
                      caption: DEFAULT_CAPTION_TWO,
                      postedTime: "2d",
                    },
                  ],
                ]}
                orientation="horizontal"
                templateLock={false}
                renderAppender={InnerBlocks.ButtonBlockAppender}
              />
            </div>
            {buttonText ? (
              <div className="appbuilder-sf-preview__footer">
                <span
                  className="appbuilder-sf-preview__button"
                  style={{
                    fontSize: `${btnSize}px`,
                    color: previewColor(buttonTextColor, PREVIEW_BUTTON_COLOR),
                    border: `${borderW}px solid ${previewColor(
                      buttonBorderColor,
                      PREVIEW_BUTTON_COLOR,
                    )}`,
                    borderRadius: `${Math.max(radius, 8)}px`,
                  }}
                >
                  {buttonText}
                  <span aria-hidden>→</span>
                </span>
              </div>
            ) : null}
          </div>
        </>
      );
    },
    save: ({ attributes }) => {
      const {
        backgroundColor,
        title,
        subTitle,
        buttonText,
        buttonTextColor,
        buttonFontSize,
        titleTextColor,
        titleFontSize,
        buttonBorderRadius,
        buttonBorderColor,
        buttonBorderWidth,
        subTitleTextColor,
        subTitleFontSize,
        action,
      } = attributes;
      const blockProps = useBlockProps.save({
        className: "appbuilder-social-feed",
        "data-background-color": backgroundColor || DEFAULT_BG,
        "data-title": title ?? "",
        "data-subtitle": subTitle ?? "",
        "data-button-text": buttonText ?? "",
        "data-button-text-color": buttonTextColor || DEFAULT_TEXT,
        "data-button-font-size": String(
          toNumber(buttonFontSize, DEFAULT_BUTTON_SIZE),
        ),
        "data-title-text-color": titleTextColor || DEFAULT_TEXT,
        "data-title-font-size": String(
          toNumber(titleFontSize, DEFAULT_TITLE_SIZE),
        ),
        "data-button-border-radius": String(
          toNumber(buttonBorderRadius, DEFAULT_RADIUS),
        ),
        "data-button-border-color": buttonBorderColor || DEFAULT_BORDER,
        "data-button-border-width": String(
          toNumber(buttonBorderWidth, DEFAULT_BORDER_WIDTH),
        ),
        "data-subtitle-text-color": subTitleTextColor || DEFAULT_TEXT,
        "data-subtitle-font-size": String(
          toNumber(subTitleFontSize, DEFAULT_SUBTITLE_SIZE),
        ),
        "data-action": JSON.stringify(action ?? {}),
        style: { background: backgroundColor || DEFAULT_BG },
      });
      return (
        <div {...blockProps}>
          {title ? (
            <h3 className="appbuilder-social-feed__title">{title}</h3>
          ) : null}
          {subTitle ? (
            <p className="appbuilder-social-feed__subtitle">{subTitle}</p>
          ) : null}
          {buttonText ? (
            <span className="appbuilder-social-feed__button">{buttonText}</span>
          ) : null}
          <InnerBlocks.Content />
        </div>
      );
    },
  });
}

export function registerSocialFeed() {
  registerSocialFeedItem();
  registerSocialFeedParent();
}
