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

const DEFAULT_TITLE = "Blogs & Insights";
const DEFAULT_SUBTITLE = "Best Sellers";
const DEFAULT_BUTTON = "VIEW ALL";
const DEFAULT_BG = "#ffffff";
const DEFAULT_TEXT = "#ffffff";
const DEFAULT_TITLE_SIZE = 12;
const DEFAULT_SUBTITLE_SIZE = 12;
const DEFAULT_BUTTON_SIZE = 10;
const DEFAULT_RADIUS = 10;
const DEFAULT_BORDER_WIDTH = 2;
const DEFAULT_BORDER = "#ffffff";
const DEFAULT_CAPTION =
  "Pre-workout pump is unmatched Who's training today? 💪";

function toNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
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
        style: { minWidth: "160px" },
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
                        height: 120,
                        objectFit: "cover",
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
                      Add image
                    </Button>
                  )}
                />
              </MediaUploadCheck>
            )}
            <div style={{ fontSize: 12, fontWeight: 600 }}>
              {userName || "username"} {postedTime ? `· ${postedTime}` : ""}
            </div>
            {caption ? <div style={{ fontSize: 11 }}>{caption}</div> : null}
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
    icon: "instagram",
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
      const titleSize = toNumber(titleFontSize, DEFAULT_TITLE_SIZE);
      const subSize = toNumber(subTitleFontSize, DEFAULT_SUBTITLE_SIZE);
      const btnSize = toNumber(buttonFontSize, DEFAULT_BUTTON_SIZE);
      const radius = toNumber(buttonBorderRadius, DEFAULT_RADIUS);
      const borderW = toNumber(buttonBorderWidth, DEFAULT_BORDER_WIDTH);
      const blockProps = useBlockProps({
        className: "appbuilder-social-feed-editor",
        style: {
          background: backgroundColor || DEFAULT_BG,
          padding: "16px",
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
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginBottom: "12px",
                gap: "12px",
              }}
            >
              <div>
                <h3
                  style={{
                    margin: 0,
                    fontSize: `${titleSize}px`,
                    color: titleTextColor || DEFAULT_TEXT,
                  }}
                >
                  {title}
                </h3>
                {subTitle ? (
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
              {buttonText ? (
                <span
                  style={{
                    fontSize: `${btnSize}px`,
                    color: buttonTextColor || DEFAULT_TEXT,
                    border: `${borderW}px solid ${buttonBorderColor || DEFAULT_BORDER}`,
                    borderRadius: `${radius}px`,
                    padding: "4px 10px",
                    alignSelf: "flex-start",
                  }}
                >
                  {buttonText}
                </span>
              ) : null}
            </div>
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
                    caption: DEFAULT_CAPTION,
                    postedTime: "2d",
                  },
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
