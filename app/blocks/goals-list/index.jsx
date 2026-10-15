// @ts-nocheck
import { registerBlockType } from "gutenberg-block-kit/wp/blocks";
import {
  useBlockProps,
  InnerBlocks,
  InspectorControls,
  PanelColorSettings,
} from "gutenberg-block-kit/wp/block-editor";
import { PanelBody, TextControl, TextareaControl } from "gutenberg-block-kit/wp/components";
import { ActionBuilder } from "../../lib/gutenberg-actions";
import {
  ImagePicker,
  imageAttributesFromMedia,
  clearImageAttributes,
} from "../inspector-shared";
import {
  GOALS_LIST_BLOCK,
  GOALS_LIST_ITEM_BLOCK,
  APPBUILDER_CATEGORY,
} from "../constants";

const DEFAULT_BG = "#FFFFFF";
const DEFAULT_TITLE_COLOR = "#FFFFFF";
const DEFAULT_DESC_COLOR = "#fff";
const DEFAULT_BUTTON_COLOR = "#fff";
const DEFAULT_PRIMARY = "#00A651";
const DEFAULT_SECONDARY = "#254E3A";

function toNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function previewOnDark(value, fallback) {
  const raw = String(value || "").trim();
  return raw || fallback;
}

const ITEM_TEMPLATE = [
  [
    GOALS_LIST_ITEM_BLOCK,
    {
      imageUrl: "",
      iconUrl: "",
      title: "BUILD LEAN MUSCLE",
      description: "Lean gains without the extra bulk.",
      buttonText: "SHOP NOW",
      primaryColor: DEFAULT_PRIMARY,
      secondaryColor: DEFAULT_SECONDARY,
      action: {},
      imageHeight: 50,
      imageWidth: 50,
    },
  ],
  [
    GOALS_LIST_ITEM_BLOCK,
    {
      imageUrl: "",
      iconUrl: "",
      title: "BUILD MASS",
      description: "Serious size, strength and power.",
      buttonText: "SHOP NOW",
      primaryColor: DEFAULT_PRIMARY,
      secondaryColor: DEFAULT_SECONDARY,
      action: {},
      imageHeight: 50,
      imageWidth: 50,
    },
  ],
  [
    GOALS_LIST_ITEM_BLOCK,
    {
      imageUrl: "",
      iconUrl: "",
      title: "IMPROVE RECOVERY",
      description: "Bounce back session after session.",
      buttonText: "SHOP NOW",
      primaryColor: DEFAULT_PRIMARY,
      secondaryColor: DEFAULT_SECONDARY,
      action: {},
      imageHeight: 50,
      imageWidth: 50,
    },
  ],
];

function registerGoalsListItem() {
  registerBlockType(GOALS_LIST_ITEM_BLOCK, {
    apiVersion: 3,
    title: "Goals List Item",
    category: APPBUILDER_CATEGORY,
    parent: [GOALS_LIST_BLOCK],
    icon: "heart",
    supports: { html: false, reusable: false },
    usesContext: [
      "titleTextColor",
      "titleFontSize",
      "descriptionTextColor",
      "descFontSize",
      "butonTextColor",
      "buttonFontSize",
    ],
    attributes: {
      imageUrl: { type: "string", default: "" },
      iconUrl: { type: "string", default: "" },
      title: { type: "string", default: "BUILD LEAN MUSCLE" },
      description: { type: "string", default: "Lean gains without the extra bulk." },
      buttonText: { type: "string", default: "SHOP NOW" },
      primaryColor: { type: "string", default: DEFAULT_PRIMARY },
      secondaryColor: { type: "string", default: DEFAULT_SECONDARY },
      action: { type: "object", default: {} },
      imageHeight: { type: "number", default: 50 },
      imageWidth: { type: "number", default: 50 },
    },
    edit: ({ attributes, setAttributes, context }) => {
      const {
        imageUrl,
        iconUrl,
        title,
        description,
        buttonText,
        primaryColor,
        secondaryColor,
        action,
      } = attributes;
      const blockProps = useBlockProps({
        className: "appbuilder-goals-list-item-editor",
      });
      const titleSize = toNumber(context?.titleFontSize, 32);
      const descSize = toNumber(context?.descFontSize, 10);
      const buttonSize = toNumber(context?.buttonFontSize, 10);
      const titleColor = previewOnDark(context?.titleTextColor, DEFAULT_TITLE_COLOR);
      const descColor = previewOnDark(context?.descriptionTextColor, DEFAULT_DESC_COLOR);
      const buttonColor = previewOnDark(context?.butonTextColor, DEFAULT_BUTTON_COLOR);
      const primary = primaryColor || DEFAULT_PRIMARY;
      const secondary = secondaryColor || DEFAULT_SECONDARY;

      return (
        <>
          <InspectorControls>
            <PanelBody title="Card" initialOpen>
              <ImagePicker
                addLabel="Add image"
                changeLabel="Change image"
                imageUrl={imageUrl}
                onSelect={(media) => setAttributes(imageAttributesFromMedia(media))}
                onClear={() => setAttributes(clearImageAttributes())}
              />
              <ImagePicker
                addLabel="Add icon"
                changeLabel="Change icon"
                imageUrl={iconUrl}
                onSelect={(media) =>
                  setAttributes({ iconUrl: media?.url || media?.[0]?.url || "" })
                }
                onClear={() => setAttributes({ iconUrl: "" })}
              />
              <TextControl
                label="Title"
                value={title}
                onChange={(value) => setAttributes({ title: value })}
              />
              <TextareaControl
                label="Description"
                rows={2}
                value={description}
                onChange={(value) => setAttributes({ description: value })}
              />
              <TextControl
                label="Button Text"
                value={buttonText}
                onChange={(value) => setAttributes({ buttonText: value })}
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
                  label: "Primary color",
                  value: primaryColor,
                  onChange: (value) =>
                    setAttributes({ primaryColor: value || DEFAULT_PRIMARY }),
                },
                {
                  label: "Secondary color",
                  value: secondaryColor,
                  onChange: (value) =>
                    setAttributes({ secondaryColor: value || DEFAULT_SECONDARY }),
                },
              ]}
            />
          </InspectorControls>
          <div
            {...blockProps}
            style={{
              position: "relative",
              borderRadius: 16,
              overflow: "hidden",
              minHeight: 220,
              background: secondary,
              color: titleColor,
            }}
          >
            {imageUrl ? (
              <img
                src={imageUrl}
                alt=""
                style={{
                  position: "absolute",
                  inset: 0,
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                }}
              />
            ) : null}
            <div
              style={{
                position: "relative",
                minHeight: 220,
                padding: 16,
                background: imageUrl
                  ? `linear-gradient(180deg, transparent 20%, ${secondary}ee 100%)`
                  : undefined,
                display: "flex",
                flexDirection: "column",
                justifyContent: "flex-end",
              }}
            >
              <div
                style={{
                  position: "absolute",
                  top: 14,
                  left: 14,
                  width: 40,
                  height: 40,
                  borderRadius: "50%",
                  background: `${primary}cc`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  overflow: "hidden",
                }}
              >
                {iconUrl ? (
                  <img src={iconUrl} alt="" style={{ width: 22, height: 22, objectFit: "contain" }} />
                ) : (
                  <span style={{ color: "#fff", fontSize: 18 }}>•</span>
                )}
              </div>
              <div style={{ height: 3, width: 36, background: primary, marginBottom: 8 }} />
              {title ? (
                <h3
                  style={{
                    margin: "0 0 6px",
                    fontSize: titleSize,
                    color: titleColor,
                    fontWeight: 800,
                    letterSpacing: "-0.02em",
                    lineHeight: 1.1,
                  }}
                >
                  {title}
                </h3>
              ) : null}
              {description ? (
                <p
                  style={{
                    margin: "0 0 10px",
                    fontSize: descSize,
                    color: descColor,
                    lineHeight: 1.4,
                  }}
                >
                  {description}
                </p>
              ) : null}
              {buttonText ? (
                <span
                  style={{
                    fontSize: buttonSize,
                    color: buttonColor,
                    fontWeight: 700,
                    letterSpacing: "0.04em",
                  }}
                >
                  {buttonText}
                </span>
              ) : null}
            </div>
          </div>
        </>
      );
    },
    save: ({ attributes }) => {
      const {
        imageUrl,
        iconUrl,
        title,
        description,
        buttonText,
        primaryColor,
        secondaryColor,
        action,
        imageHeight,
        imageWidth,
      } = attributes;
      const blockProps = useBlockProps.save({
        className: "appbuilder-goals-list__item",
        "data-action": JSON.stringify(action ?? {}),
        "data-image-url": imageUrl,
        "data-icon-url": iconUrl,
        "data-primary-color": primaryColor,
        "data-secondary-color": secondaryColor,
        "data-image-width": String(imageWidth ?? 50),
        "data-image-height": String(imageHeight ?? 50),
      });
      return (
        <div {...blockProps}>
          {imageUrl ? (
            <img
              className="appbuilder-goals-list__image"
              src={imageUrl}
              alt=""
              width={imageWidth || undefined}
              height={imageHeight || undefined}
            />
          ) : null}
          {iconUrl ? (
            <img className="appbuilder-goals-list__icon" src={iconUrl} alt="" />
          ) : null}
          {title ? <h3 className="appbuilder-goals-list__item-title">{title}</h3> : null}
          {description ? (
            <p className="appbuilder-goals-list__item-description">{description}</p>
          ) : null}
          {buttonText ? (
            <span className="appbuilder-goals-list__button">{buttonText}</span>
          ) : null}
        </div>
      );
    },
  });
}

function registerGoalsListParent() {
  registerBlockType(GOALS_LIST_BLOCK, {
    apiVersion: 3,
    title: "Goals List",
    category: APPBUILDER_CATEGORY,
    icon: "screenoptions",
    supports: { html: false, align: ["wide", "full"] },
    providesContext: {
      titleTextColor: "titleTextColor",
      titleFontSize: "titleFontSize",
      descriptionTextColor: "descriptionTextColor",
      descFontSize: "descFontSize",
      butonTextColor: "butonTextColor",
      buttonFontSize: "buttonFontSize",
    },
    attributes: {
      backgroundColor: { type: "string", default: DEFAULT_BG },
      columnCount: { type: "number", default: 2 },
      titleTextColor: { type: "string", default: DEFAULT_TITLE_COLOR },
      titleFontSize: { type: "number", default: 32 },
      descriptionTextColor: { type: "string", default: DEFAULT_DESC_COLOR },
      descFontSize: { type: "number", default: 10 },
      butonTextColor: { type: "string", default: DEFAULT_BUTTON_COLOR },
      buttonFontSize: { type: "number", default: 10 },
    },
    edit: ({ attributes, setAttributes }) => {
      const {
        backgroundColor,
        columnCount,
        titleTextColor,
        titleFontSize,
        descriptionTextColor,
        descFontSize,
        butonTextColor,
        buttonFontSize,
      } = attributes;
      const cols = Math.max(toNumber(columnCount, 2), 1);
      const blockProps = useBlockProps({
        className: "appbuilder-goals-list-editor",
        style: {
          background: backgroundColor || DEFAULT_BG,
          padding: 12,
          ["--appbuilder-goals-list-columns"]: String(cols),
        },
      });

      return (
        <>
          <InspectorControls>
            <PanelBody title="Layout" initialOpen>
              <TextControl
                label="Column Count"
                type="number"
                min={1}
                value={cols}
                onChange={(value) =>
                  setAttributes({ columnCount: Math.max(toNumber(value, 2), 1) })
                }
              />
              <TextControl
                label="Title Font Size"
                type="number"
                min={0}
                value={toNumber(titleFontSize, 32)}
                onChange={(value) =>
                  setAttributes({ titleFontSize: toNumber(value, 32) })
                }
              />
              <TextControl
                label="Description Font Size"
                type="number"
                min={0}
                value={toNumber(descFontSize, 10)}
                onChange={(value) =>
                  setAttributes({ descFontSize: toNumber(value, 10) })
                }
              />
              <TextControl
                label="Button Font Size"
                type="number"
                min={0}
                value={toNumber(buttonFontSize, 10)}
                onChange={(value) =>
                  setAttributes({ buttonFontSize: toNumber(value, 10) })
                }
              />
            </PanelBody>
            <PanelColorSettings
              title="Colors"
              colorSettings={[
                {
                  label: "Background color",
                  value: backgroundColor,
                  onChange: (value) =>
                    setAttributes({ backgroundColor: value || DEFAULT_BG }),
                },
                {
                  label: "Title text color",
                  value: titleTextColor,
                  onChange: (value) =>
                    setAttributes({ titleTextColor: value || DEFAULT_TITLE_COLOR }),
                },
                {
                  label: "Description text color",
                  value: descriptionTextColor,
                  onChange: (value) =>
                    setAttributes({
                      descriptionTextColor: value || DEFAULT_DESC_COLOR,
                    }),
                },
                {
                  label: "Button text color",
                  value: butonTextColor,
                  onChange: (value) =>
                    setAttributes({ butonTextColor: value || DEFAULT_BUTTON_COLOR }),
                },
              ]}
            />
          </InspectorControls>
          <div {...blockProps}>
            <InnerBlocks
              allowedBlocks={[GOALS_LIST_ITEM_BLOCK]}
              template={ITEM_TEMPLATE}
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
        columnCount,
        titleTextColor,
        titleFontSize,
        descriptionTextColor,
        descFontSize,
        butonTextColor,
        buttonFontSize,
      } = attributes;
      const blockProps = useBlockProps.save({
        className: "appbuilder-goals-list",
        "data-background-color": backgroundColor,
        "data-column-count": String(columnCount ?? 2),
        "data-title-text-color": titleTextColor,
        "data-title-font-size": String(titleFontSize ?? 32),
        "data-description-text-color": descriptionTextColor,
        "data-desc-font-size": String(descFontSize ?? 10),
        "data-buton-text-color": butonTextColor,
        "data-button-font-size": String(buttonFontSize ?? 10),
        style: {
          background: backgroundColor || DEFAULT_BG,
          ["--appbuilder-goals-list-columns"]: String(columnCount ?? 2),
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

export function registerGoalsList() {
  registerGoalsListItem();
  registerGoalsListParent();
}
