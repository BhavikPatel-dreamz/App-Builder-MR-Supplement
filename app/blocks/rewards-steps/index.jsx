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
  Button,
} from "gutenberg-block-kit/wp/components";
import { ActionBuilder } from "gutenberg-block-kit/actions";
import {
  ImagePicker,
  imageAttributesFromMedia,
  clearImageAttributes,
} from "../inspector-shared";
import {
  REWARDS_STEPS_BLOCK,
  REWARDS_STEPS_ITEM_BLOCK,
  APPBUILDER_CATEGORY,
} from "../constants";

const DEFAULT_TITLE = "Blogs & Insights";
const DEFAULT_HIGHLIGHT = "Company";
const DEFAULT_SUBTITLE = "Best Sellers";
const DEFAULT_BUTTON = "VIEW ALL";
const DEFAULT_BG = "#ffffff";
const DEFAULT_TEXT = "#ffffff";
const DEFAULT_TITLE_SIZE = 12;
const DEFAULT_SUBTITLE_SIZE = 12;
const DEFAULT_BUTTON_SIZE = 10;
const DEFAULT_HIGHLIGHT_SIZE = 10;
const DEFAULT_RADIUS = 10;
const DEFAULT_BORDER = "#ffffff";

function toNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function registerRewardsStepsItem() {
  registerBlockType(REWARDS_STEPS_ITEM_BLOCK, {
    apiVersion: 3,
    title: "Rewards Step",
    category: APPBUILDER_CATEGORY,
    parent: [REWARDS_STEPS_BLOCK],
    icon: "marker",
    supports: { html: false, reusable: false },
    attributes: {
      imageUrl: { type: "string", default: "" },
      imageWidth: { type: "number", default: 0 },
      imageHeight: { type: "number", default: 0 },
      stepNumber: { type: "string", default: "1" },
      title: { type: "string", default: "" },
      subTitle: { type: "string", default: "" },
      action: { type: "object", default: {} },
    },
    edit: ({ attributes, setAttributes }) => {
      const { imageUrl, stepNumber, title, subTitle, action } = attributes;
      const blockProps = useBlockProps({
        className: "appbuilder-rewards-steps-item-editor",
        style: { minWidth: "120px", textAlign: "center" },
      });

      return (
        <>
          <InspectorControls>
            <PanelBody title="Step" initialOpen>
              <ImagePicker
                imageUrl={imageUrl}
                onSelect={(media) =>
                  setAttributes(imageAttributesFromMedia(media))
                }
                onClear={() => setAttributes(clearImageAttributes())}
              />
              <TextControl
                label="Step Number"
                value={stepNumber}
                onChange={(value) => setAttributes({ stepNumber: value })}
              />
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
                        width: 40,
                        height: 40,
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
                      Add icon
                    </Button>
                  )}
                />
              </MediaUploadCheck>
            )}
            <div style={{ fontWeight: 700 }}>{stepNumber || "1"}</div>
            <div>{title || "Step title"}</div>
            {subTitle ? <div>{subTitle}</div> : null}
          </div>
        </>
      );
    },
    save: ({ attributes }) => {
      const {
        imageUrl,
        imageWidth,
        imageHeight,
        stepNumber,
        title,
        subTitle,
        action,
      } = attributes;
      const blockProps = useBlockProps.save({
        className: "appbuilder-rewards-steps-item",
        "data-image-url": imageUrl ?? "",
        "data-image-width": String(imageWidth ?? 0),
        "data-image-height": String(imageHeight ?? 0),
        "data-step-number": stepNumber ?? "",
        "data-title": title ?? "",
        "data-subtitle": subTitle ?? "",
        "data-action": JSON.stringify(action ?? {}),
      });
      return (
        <div {...blockProps}>
          {imageUrl ? (
            <img
              src={imageUrl}
              alt=""
              className="appbuilder-rewards-steps-item__icon"
            />
          ) : null}
          {stepNumber ? (
            <span className="appbuilder-rewards-steps-item__number">
              {stepNumber}
            </span>
          ) : null}
          {title ? (
            <span className="appbuilder-rewards-steps-item__title">{title}</span>
          ) : null}
          {subTitle ? (
            <span className="appbuilder-rewards-steps-item__subtitle">
              {subTitle}
            </span>
          ) : null}
        </div>
      );
    },
  });
}

function registerRewardsStepsParent() {
  registerBlockType(REWARDS_STEPS_BLOCK, {
    apiVersion: 3,
    title: "Rewards Steps",
    category: APPBUILDER_CATEGORY,
    icon: "awards",
    supports: { html: false, align: ["wide", "full"] },
    attributes: {
      title: { type: "string", default: DEFAULT_TITLE },
      highlightedTitle: { type: "string", default: DEFAULT_HIGHLIGHT },
      subTitle: { type: "string", default: DEFAULT_SUBTITLE },
      buttonText: { type: "string", default: DEFAULT_BUTTON },
      action: { type: "object", default: {} },
      titleFontSize: { type: "number", default: DEFAULT_TITLE_SIZE },
      titleTextColor: { type: "string", default: DEFAULT_TEXT },
      highlightedTitleFontSize: {
        type: "number",
        default: DEFAULT_HIGHLIGHT_SIZE,
      },
      highlightedTitleTextColor: { type: "string", default: DEFAULT_TEXT },
      subTitleFontSize: { type: "number", default: DEFAULT_SUBTITLE_SIZE },
      subTitleTextColor: { type: "string", default: DEFAULT_TEXT },
      buttonFontSize: { type: "number", default: DEFAULT_BUTTON_SIZE },
      buttonTextColor: { type: "string", default: DEFAULT_TEXT },
      buttonBorderColor: { type: "string", default: DEFAULT_BORDER },
      buttonBorderRadius: { type: "number", default: DEFAULT_RADIUS },
      stepNumberBackgroundColor: { type: "string", default: DEFAULT_TEXT },
      stepNumberTextColor: { type: "string", default: DEFAULT_TEXT },
      connectorColor: { type: "string", default: DEFAULT_TEXT },
      backgroundColor: { type: "string", default: DEFAULT_BG },
    },
    edit: ({ attributes, setAttributes }) => {
      const {
        title,
        highlightedTitle,
        subTitle,
        buttonText,
        action,
        titleFontSize,
        titleTextColor,
        highlightedTitleFontSize,
        highlightedTitleTextColor,
        subTitleFontSize,
        subTitleTextColor,
        buttonFontSize,
        buttonTextColor,
        buttonBorderColor,
        buttonBorderRadius,
        stepNumberBackgroundColor,
        stepNumberTextColor,
        connectorColor,
        backgroundColor,
      } = attributes;
      const titleSize = toNumber(titleFontSize, DEFAULT_TITLE_SIZE);
      const highlightSize = toNumber(
        highlightedTitleFontSize,
        DEFAULT_HIGHLIGHT_SIZE,
      );
      const subSize = toNumber(subTitleFontSize, DEFAULT_SUBTITLE_SIZE);
      const btnSize = toNumber(buttonFontSize, DEFAULT_BUTTON_SIZE);
      const radius = toNumber(buttonBorderRadius, DEFAULT_RADIUS);
      const blockProps = useBlockProps({
        className: "appbuilder-rewards-steps-editor",
        style: {
          background: backgroundColor || DEFAULT_BG,
          padding: "16px",
        },
      });

      return (
        <>
          <InspectorControls>
            <PanelBody title="Content" initialOpen>
              <TextControl
                label="Title"
                value={title}
                onChange={(value) => setAttributes({ title: value })}
              />
              <TextControl
                label="Highlighted Title"
                value={highlightedTitle}
                onChange={(value) =>
                  setAttributes({ highlightedTitle: value })
                }
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
                label="Highlighted Title Font Size"
                type="number"
                value={highlightSize}
                onChange={(value) =>
                  setAttributes({
                    highlightedTitleFontSize: toNumber(
                      value,
                      DEFAULT_HIGHLIGHT_SIZE,
                    ),
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
                  label: "Highlighted Title Text Color",
                  value: highlightedTitleTextColor || DEFAULT_TEXT,
                  onChange: (value) =>
                    setAttributes({
                      highlightedTitleTextColor: value || DEFAULT_TEXT,
                    }),
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
                {
                  label: "Step Number Background Color",
                  value: stepNumberBackgroundColor || DEFAULT_TEXT,
                  onChange: (value) =>
                    setAttributes({
                      stepNumberBackgroundColor: value || DEFAULT_TEXT,
                    }),
                },
                {
                  label: "Step Number Text Color",
                  value: stepNumberTextColor || DEFAULT_TEXT,
                  onChange: (value) =>
                    setAttributes({
                      stepNumberTextColor: value || DEFAULT_TEXT,
                    }),
                },
                {
                  label: "Connector Color",
                  value: connectorColor || DEFAULT_TEXT,
                  onChange: (value) =>
                    setAttributes({ connectorColor: value || DEFAULT_TEXT }),
                },
              ]}
            />
          </InspectorControls>
          <div {...blockProps}>
            <div style={{ marginBottom: "12px" }}>
              <h3 style={{ margin: 0 }}>
                <span
                  style={{
                    fontSize: `${titleSize}px`,
                    color: titleTextColor || DEFAULT_TEXT,
                  }}
                >
                  {title || DEFAULT_TITLE}{" "}
                </span>
                <span
                  style={{
                    fontSize: `${highlightSize}px`,
                    color: highlightedTitleTextColor || DEFAULT_TEXT,
                  }}
                >
                  {highlightedTitle}
                </span>
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
              {buttonText ? (
                <span
                  style={{
                    display: "inline-block",
                    marginTop: "8px",
                    fontSize: `${btnSize}px`,
                    color: buttonTextColor || DEFAULT_TEXT,
                    border: `1px solid ${buttonBorderColor || DEFAULT_BORDER}`,
                    borderRadius: `${radius}px`,
                    padding: "4px 10px",
                  }}
                >
                  {buttonText}
                </span>
              ) : null}
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "flex-start",
                borderTop: `2px solid ${connectorColor || DEFAULT_TEXT}`,
                paddingTop: "12px",
              }}
            >
              <InnerBlocks
                allowedBlocks={[REWARDS_STEPS_ITEM_BLOCK]}
                template={[
                  [
                    REWARDS_STEPS_ITEM_BLOCK,
                    {
                      title: "mrsupplement",
                      stepNumber: "1",
                      subTitle: "2d",
                    },
                  ],
                  [
                    REWARDS_STEPS_ITEM_BLOCK,
                    {
                      title: "mrsupplement",
                      stepNumber: "2",
                      subTitle: "2d",
                    },
                  ],
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
        highlightedTitle,
        subTitle,
        buttonText,
        action,
        titleFontSize,
        titleTextColor,
        highlightedTitleFontSize,
        highlightedTitleTextColor,
        subTitleFontSize,
        subTitleTextColor,
        buttonFontSize,
        buttonTextColor,
        buttonBorderColor,
        buttonBorderRadius,
        stepNumberBackgroundColor,
        stepNumberTextColor,
        connectorColor,
        backgroundColor,
      } = attributes;
      const blockProps = useBlockProps.save({
        className: "appbuilder-rewards-steps",
        "data-title": title ?? "",
        "data-highlighted-title": highlightedTitle ?? "",
        "data-subtitle": subTitle ?? "",
        "data-button-text": buttonText ?? "",
        "data-title-font-size": String(
          toNumber(titleFontSize, DEFAULT_TITLE_SIZE),
        ),
        "data-title-text-color": titleTextColor || DEFAULT_TEXT,
        "data-highlighted-title-font-size": String(
          toNumber(highlightedTitleFontSize, DEFAULT_HIGHLIGHT_SIZE),
        ),
        "data-highlighted-title-text-color":
          highlightedTitleTextColor || DEFAULT_TEXT,
        "data-subtitle-font-size": String(
          toNumber(subTitleFontSize, DEFAULT_SUBTITLE_SIZE),
        ),
        "data-subtitle-text-color": subTitleTextColor || DEFAULT_TEXT,
        "data-button-font-size": String(
          toNumber(buttonFontSize, DEFAULT_BUTTON_SIZE),
        ),
        "data-button-text-color": buttonTextColor || DEFAULT_TEXT,
        "data-button-border-color": buttonBorderColor || DEFAULT_BORDER,
        "data-button-border-radius": String(
          toNumber(buttonBorderRadius, DEFAULT_RADIUS),
        ),
        "data-step-number-background-color":
          stepNumberBackgroundColor || DEFAULT_TEXT,
        "data-step-number-text-color": stepNumberTextColor || DEFAULT_TEXT,
        "data-connector-color": connectorColor || DEFAULT_TEXT,
        "data-background-color": backgroundColor || DEFAULT_BG,
        "data-action": JSON.stringify(action ?? {}),
        style: { background: backgroundColor || DEFAULT_BG },
      });
      return (
        <div {...blockProps}>
          {title ? (
            <h3 className="appbuilder-rewards-steps__title">{title}</h3>
          ) : null}
          {highlightedTitle ? (
            <span className="appbuilder-rewards-steps__highlighted">
              {highlightedTitle}
            </span>
          ) : null}
          {subTitle ? (
            <p className="appbuilder-rewards-steps__subtitle">{subTitle}</p>
          ) : null}
          {buttonText ? (
            <span className="appbuilder-rewards-steps__button">{buttonText}</span>
          ) : null}
          <InnerBlocks.Content />
        </div>
      );
    },
  });
}

export function registerRewardsSteps() {
  registerRewardsStepsItem();
  registerRewardsStepsParent();
}
