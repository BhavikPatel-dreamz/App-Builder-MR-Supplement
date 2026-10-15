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
import { PanelBody, TextControl } from "gutenberg-block-kit/wp/components";
import { ActionBuilder } from "../../lib/gutenberg-actions";
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

const DEFAULT_TITLE = "MR SUPPLEMENT";
const DEFAULT_HIGHLIGHT = "REWARDS";
const DEFAULT_SUBTITLE =
  "Earn points every time you shop and unlock exclusive rewards.";
const DEFAULT_BUTTON = "EXPLORE REWARDS";
const DEFAULT_BG = "#ffffff";
const DEFAULT_TEXT = "#ffffff";
const PREVIEW_BG = "#f3f3f3";
const PREVIEW_TITLE_COLOR = "#111111";
const PREVIEW_HIGHLIGHT_COLOR = "#8bc53f";
const PREVIEW_SUBTITLE_COLOR = "#6b6b6b";
const PREVIEW_BUTTON_COLOR = "#8bc53f";
const PREVIEW_STEP_BG = "#8bc53f";
const PREVIEW_STEP_TEXT = "#ffffff";
const PREVIEW_CONNECTOR = "#8bc53f";
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

function previewColor(value, fallback) {
  const raw = String(value || "").trim();
  if (!raw || raw.toLowerCase() === "#ffffff" || raw.toLowerCase() === "#fff") {
    return fallback;
  }
  return raw;
}

function StepPlaceholderIcon({ stepNumber }) {
  const n = String(stepNumber || "1");
  if (n === "2") {
    return (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
        <circle cx="12" cy="12" r="9" stroke="#111" strokeWidth="2" />
        <path
          d="M12 7v10M9.5 9.5c.4-1 1.4-1.6 2.5-1.6 1.4 0 2.5.8 2.5 2s-1 2-2.5 2H11c-1.5 0-2.5.8-2.5 2s1.2 2 2.6 2c1.2 0 2.2-.6 2.6-1.6"
          stroke="#111"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
    );
  }
  if (n === "3") {
    return (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
        <rect
          x="4"
          y="6"
          width="16"
          height="12"
          rx="2"
          stroke="#111"
          strokeWidth="2"
        />
        <path
          d="M12 9v6M9.5 13.5 12 16l2.5-2.5"
          stroke="#111"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M5 6h2l1.5 9h9l2-6H8"
        stroke="#111"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="10" cy="18.5" r="1.5" fill="#111" />
      <circle cx="17" cy="18.5" r="1.5" fill="#111" />
    </svg>
  );
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
            <div className="appbuilder-rewards-steps-item-editor__icon-wrap">
              <MediaUploadCheck>
                <MediaUpload
                  onSelect={(media) =>
                    setAttributes(imageAttributesFromMedia(media))
                  }
                  allowedTypes={["image"]}
                  render={({ open }) =>
                    imageUrl ? (
                      <img
                        src={imageUrl}
                        alt=""
                        onClick={open}
                        className="appbuilder-rewards-steps-item-editor__icon"
                      />
                    ) : (
                      <button
                        type="button"
                        onClick={open}
                        className="appbuilder-rewards-steps-item-editor__icon"
                        style={{
                          border: 0,
                          background: "transparent",
                          padding: 0,
                          cursor: "pointer",
                        }}
                      >
                        <StepPlaceholderIcon stepNumber={stepNumber} />
                      </button>
                    )
                  }
                />
              </MediaUploadCheck>
            </div>
            <div className="appbuilder-rewards-steps-item-editor__number">
              {stepNumber || "1"}
            </div>
            <div className="appbuilder-rewards-steps-item-editor__title">
              {title || "SHOP"}
            </div>
            <div className="appbuilder-rewards-steps-item-editor__subtitle">
              {subTitle || "Shop and earn points."}
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
      const previewBg = previewColor(backgroundColor, PREVIEW_BG);
      const previewTitle = previewColor(titleTextColor, PREVIEW_TITLE_COLOR);
      const previewHighlight = previewColor(
        highlightedTitleTextColor,
        PREVIEW_HIGHLIGHT_COLOR,
      );
      const previewSub = previewColor(subTitleTextColor, PREVIEW_SUBTITLE_COLOR);
      const previewBtn = previewColor(buttonTextColor, PREVIEW_BUTTON_COLOR);
      const previewBtnBorder = previewColor(
        buttonBorderColor,
        PREVIEW_BUTTON_COLOR,
      );
      const previewStepBg = previewColor(
        stepNumberBackgroundColor,
        PREVIEW_STEP_BG,
      );
      const previewStepText = previewColor(
        stepNumberTextColor,
        PREVIEW_STEP_TEXT,
      );
      const previewConnector = previewColor(connectorColor, PREVIEW_CONNECTOR);
      const blockProps = useBlockProps({
        className: "appbuilder-rewards-steps-editor",
        style: {
          background: previewBg,
          "--rs-connector": previewConnector,
          "--rs-step-bg": previewStepBg,
          "--rs-step-text": previewStepText,
          "--rs-green": previewHighlight,
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
                min={0}
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
                min={0}
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
            <div className="appbuilder-rs-preview__header">
              <h3 className="appbuilder-rs-preview__title">
                <span style={{ color: previewTitle }}>
                  {title || DEFAULT_TITLE}{" "}
                </span>
                <span
                  className="appbuilder-rs-preview__highlight"
                  style={{ color: previewHighlight }}
                >
                  {highlightedTitle || DEFAULT_HIGHLIGHT}
                </span>
              </h3>
              <p
                className="appbuilder-rs-preview__subtitle"
                style={{ color: previewSub }}
              >
                {subTitle || DEFAULT_SUBTITLE}
              </p>
              {buttonText ? (
                <span
                  className="appbuilder-rs-preview__button"
                  style={{
                    color: previewBtn,
                    border: `1.5px solid ${previewBtnBorder}`,
                    borderRadius: `${radius}px`,
                  }}
                >
                  {buttonText}
                </span>
              ) : null}
            </div>
            <div className="appbuilder-rs-preview__track">
              <InnerBlocks
                allowedBlocks={[REWARDS_STEPS_ITEM_BLOCK]}
                template={[
                  [
                    REWARDS_STEPS_ITEM_BLOCK,
                    {
                      title: "SHOP",
                      stepNumber: "1",
                      subTitle: "Shop and earn points.",
                    },
                  ],
                  [
                    REWARDS_STEPS_ITEM_BLOCK,
                    {
                      title: "EARN",
                      stepNumber: "2",
                      subTitle: "Earn points with every purchase.",
                    },
                  ],
                  [
                    REWARDS_STEPS_ITEM_BLOCK,
                    {
                      title: "REDEEM",
                      stepNumber: "3",
                      subTitle: "Redeem points for discounts!",
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
