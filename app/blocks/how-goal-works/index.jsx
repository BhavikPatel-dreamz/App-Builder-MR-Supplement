// @ts-nocheck
import { registerBlockType } from "gutenberg-block-kit/wp/blocks";
import {
  useBlockProps,
  InnerBlocks,
  InspectorControls,
  PanelColorSettings,
} from "gutenberg-block-kit/wp/block-editor";
import { PanelBody, TextControl, TextareaControl } from "gutenberg-block-kit/wp/components";
import {
  HOW_GOAL_WORKS_BLOCK,
  HOW_GOAL_ITEM_WORKS_BLOCK,
  APPBUILDER_CATEGORY,
} from "../constants";

const DEFAULT_BG = "#F5F5F5";
const DEFAULT_TITLE = "Workout Goals";
const DEFAULT_DESCRIPTION =
  "Let us help you on your fitness journey. It's as easy as choosing your goal, then follow the prompts. It's so easy.";
const DEFAULT_SECTION_TITLE = "HOW IT WORKS";
const DEFAULT_SECTION_DESCRIPTION =
  "Three steps between you and a stack built around your goal.";
const DEFAULT_TITLE_COLOR = "#171717";
const DEFAULT_DESC_COLOR = "#333333";
const DEFAULT_SECTION_TITLE_COLOR = "#171717";
const DEFAULT_SECTION_DESC_COLOR = "#171717";
const DEFAULT_INNER_TITLE_COLOR = "#fff";
const DEFAULT_INNER_DESC_COLOR = "#fff";
const DEFAULT_ITEM_BG = "#ffffff";
const DEFAULT_ACCENT = "#1E9BE9";

function toNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function previewOnLight(value, fallback) {
  const raw = String(value || "").trim().toLowerCase();
  if (!raw || raw === "#fff" || raw === "#ffffff") return fallback;
  return value;
}

function registerHowGoalItemWorks() {
  registerBlockType(HOW_GOAL_ITEM_WORKS_BLOCK, {
    apiVersion: 3,
    title: "How Goal Item",
    category: APPBUILDER_CATEGORY,
    parent: [HOW_GOAL_WORKS_BLOCK],
    icon: "editor-ol",
    supports: { html: false, reusable: false },
    usesContext: [
      "innerTItleFontSize",
      "innerTitleTextColor",
      "innerDescFontSize",
      "innerDescTextColor",
    ],
    attributes: {
      title: { type: "string", default: "Choose your goal" },
      description: {
        type: "string",
        default: "Pick the goal above that matches what you want to achieve.",
      },
      backgroundColor: { type: "string", default: DEFAULT_ITEM_BG },
      accentColor: { type: "string", default: DEFAULT_ACCENT },
    },
    edit: ({ attributes, setAttributes, context }) => {
      const { title, description, backgroundColor, accentColor } = attributes;
      const blockProps = useBlockProps({
        className: "appbuilder-how-goal-works-item-editor",
      });
      const innerTitleSize = toNumber(context?.innerTItleFontSize, 16);
      const innerDescSize = toNumber(context?.innerDescFontSize, 14);
      const innerTitleColor = previewOnLight(
        context?.innerTitleTextColor,
        "#171717",
      );
      const innerDescColor = previewOnLight(
        context?.innerDescTextColor,
        "#333333",
      );

      return (
        <>
          <InspectorControls>
            <PanelBody title="Step" initialOpen>
              <TextControl
                label="Title"
                value={title}
                onChange={(value) => setAttributes({ title: value })}
              />
              <TextareaControl
                label="Description"
                rows={3}
                value={description}
                onChange={(value) => setAttributes({ description: value })}
              />
            </PanelBody>
            <PanelColorSettings
              title="Colors"
              colorSettings={[
                {
                  label: "Background color",
                  value: backgroundColor,
                  onChange: (value) =>
                    setAttributes({ backgroundColor: value || DEFAULT_ITEM_BG }),
                },
                {
                  label: "Accent color",
                  value: accentColor,
                  onChange: (value) =>
                    setAttributes({ accentColor: value || DEFAULT_ACCENT }),
                },
              ]}
            />
          </InspectorControls>
          <div
            {...blockProps}
            style={{
              background: backgroundColor || DEFAULT_ITEM_BG,
              borderRadius: 12,
              overflow: "hidden",
              border: "1px solid #eee",
              display: "flex",
              gap: 0,
            }}
          >
            <div
              style={{
                width: 6,
                background: accentColor || DEFAULT_ACCENT,
                flexShrink: 0,
              }}
            />
            <div style={{ padding: "14px 16px 16px", flex: 1 }}>
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 28,
                  height: 28,
                  borderRadius: "50%",
                  background: accentColor || DEFAULT_ACCENT,
                  color: "#fff",
                  fontWeight: 700,
                  fontSize: 13,
                  marginBottom: 8,
                }}
              >
                ·
              </div>
              {title ? (
                <h3
                  style={{
                    margin: "0 0 6px",
                    fontSize: innerTitleSize,
                    color: innerTitleColor,
                  }}
                >
                  {title}
                </h3>
              ) : null}
              {description ? (
                <p
                  style={{
                    margin: 0,
                    fontSize: innerDescSize,
                    color: innerDescColor,
                    lineHeight: 1.45,
                  }}
                >
                  {description}
                </p>
              ) : null}
            </div>
          </div>
        </>
      );
    },
    save: ({ attributes }) => {
      const { title, description, backgroundColor, accentColor } = attributes;
      const blockProps = useBlockProps.save({
        className: "appbuilder-how-goal-works__item",
        "data-background-color": backgroundColor,
        "data-accent-color": accentColor,
        style: {
          background: backgroundColor || DEFAULT_ITEM_BG,
          borderLeft: `6px solid ${accentColor || DEFAULT_ACCENT}`,
        },
      });
      return (
        <div {...blockProps}>
          {title ? (
            <h3 className="appbuilder-how-goal-works__item-title">{title}</h3>
          ) : null}
          {description ? (
            <p className="appbuilder-how-goal-works__item-description">{description}</p>
          ) : null}
        </div>
      );
    },
  });
}

function registerHowGoalWorksParent() {
  registerBlockType(HOW_GOAL_WORKS_BLOCK, {
    apiVersion: 3,
    title: "How Goals works",
    category: APPBUILDER_CATEGORY,
    icon: "list-view",
    supports: { html: false, align: ["wide", "full"] },
    providesContext: {
      innerTItleFontSize: "innerTItleFontSize",
      innerTitleTextColor: "innerTitleTextColor",
      innerDescFontSize: "innerDescFontSize",
      innerDescTextColor: "innerDescTextColor",
    },
    attributes: {
      backgroundColor: { type: "string", default: DEFAULT_BG },
      title: { type: "string", default: DEFAULT_TITLE },
      description: { type: "string", default: DEFAULT_DESCRIPTION },
      sectionTitle: { type: "string", default: DEFAULT_SECTION_TITLE },
      sectionDescription: { type: "string", default: DEFAULT_SECTION_DESCRIPTION },
      titleTextColor: { type: "string", default: DEFAULT_TITLE_COLOR },
      descriptionTextColor: { type: "string", default: DEFAULT_DESC_COLOR },
      sectionTitleTextColor: { type: "string", default: DEFAULT_SECTION_TITLE_COLOR },
      sectionDescriptionTextColor: {
        type: "string",
        default: DEFAULT_SECTION_DESC_COLOR,
      },
      titleFontSize: { type: "number", default: 48 },
      descriptionFontSize: { type: "number", default: 24 },
      sectionTitleFontSize: { type: "number", default: 48 },
      sectionDescriptionFontSize: { type: "number", default: 28 },
      innerTItleFontSize: { type: "number", default: 10 },
      innerTitleTextColor: { type: "string", default: DEFAULT_INNER_TITLE_COLOR },
      innerDescFontSize: { type: "number", default: 10 },
      innerDescTextColor: { type: "string", default: DEFAULT_INNER_DESC_COLOR },
    },
    edit: ({ attributes, setAttributes }) => {
      const {
        backgroundColor,
        title,
        description,
        sectionTitle,
        sectionDescription,
        titleTextColor,
        descriptionTextColor,
        sectionTitleTextColor,
        sectionDescriptionTextColor,
        titleFontSize,
        descriptionFontSize,
        sectionTitleFontSize,
        sectionDescriptionFontSize,
        innerTItleFontSize,
        innerTitleTextColor,
        innerDescFontSize,
        innerDescTextColor,
      } = attributes;
      const blockProps = useBlockProps({
        className: "appbuilder-how-goal-works-editor",
        style: {
          background: backgroundColor || DEFAULT_BG,
          padding: 20,
          borderRadius: 8,
        },
      });
      const titleSize = toNumber(titleFontSize, 48);
      const descSize = toNumber(descriptionFontSize, 24);
      const sectionTitleSize = toNumber(sectionTitleFontSize, 48);
      const sectionDescSize = toNumber(sectionDescriptionFontSize, 28);

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
                label="Title Font Size"
                type="number"
                min={0}
                value={titleSize}
                onChange={(value) =>
                  setAttributes({ titleFontSize: toNumber(value, 48) })
                }
              />
              <TextareaControl
                label="Description"
                rows={3}
                value={description}
                onChange={(value) => setAttributes({ description: value })}
              />
              <TextControl
                label="Description Font Size"
                type="number"
                min={0}
                value={descSize}
                onChange={(value) =>
                  setAttributes({ descriptionFontSize: toNumber(value, 24) })
                }
              />
              <TextControl
                label="Section Title"
                value={sectionTitle}
                onChange={(value) => setAttributes({ sectionTitle: value })}
              />
              <TextControl
                label="Section Title Font Size"
                type="number"
                min={0}
                value={sectionTitleSize}
                onChange={(value) =>
                  setAttributes({ sectionTitleFontSize: toNumber(value, 48) })
                }
              />
              <TextareaControl
                label="Section Description"
                rows={2}
                value={sectionDescription}
                onChange={(value) => setAttributes({ sectionDescription: value })}
              />
              <TextControl
                label="Section Description Font Size"
                type="number"
                min={0}
                value={sectionDescSize}
                onChange={(value) =>
                  setAttributes({
                    sectionDescriptionFontSize: toNumber(value, 28),
                  })
                }
              />
              <TextControl
                label="Inner Title Font Size"
                type="number"
                min={0}
                value={toNumber(innerTItleFontSize, 10)}
                onChange={(value) =>
                  setAttributes({ innerTItleFontSize: toNumber(value, 10) })
                }
              />
              <TextControl
                label="Inner Description Font Size"
                type="number"
                min={0}
                value={toNumber(innerDescFontSize, 10)}
                onChange={(value) =>
                  setAttributes({ innerDescFontSize: toNumber(value, 10) })
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
                    setAttributes({
                      titleTextColor: value || DEFAULT_TITLE_COLOR,
                    }),
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
                  label: "Section title text color",
                  value: sectionTitleTextColor,
                  onChange: (value) =>
                    setAttributes({
                      sectionTitleTextColor: value || DEFAULT_SECTION_TITLE_COLOR,
                    }),
                },
                {
                  label: "Section description text color",
                  value: sectionDescriptionTextColor,
                  onChange: (value) =>
                    setAttributes({
                      sectionDescriptionTextColor:
                        value || DEFAULT_SECTION_DESC_COLOR,
                    }),
                },
                {
                  label: "Inner title text color",
                  value: innerTitleTextColor,
                  onChange: (value) =>
                    setAttributes({
                      innerTitleTextColor: value || DEFAULT_INNER_TITLE_COLOR,
                    }),
                },
                {
                  label: "Inner description text color",
                  value: innerDescTextColor,
                  onChange: (value) =>
                    setAttributes({
                      innerDescTextColor: value || DEFAULT_INNER_DESC_COLOR,
                    }),
                },
              ]}
            />
          </InspectorControls>
          <div {...blockProps}>
            {title ? (
              <h2
                style={{
                  margin: "0 0 8px",
                  fontSize: titleSize,
                  color: titleTextColor || DEFAULT_TITLE_COLOR,
                  lineHeight: 1.15,
                }}
              >
                {title}
              </h2>
            ) : null}
            {description ? (
              <p
                style={{
                  margin: "0 0 20px",
                  fontSize: descSize,
                  color: descriptionTextColor || DEFAULT_DESC_COLOR,
                  lineHeight: 1.4,
                }}
              >
                {description}
              </p>
            ) : null}
            {sectionTitle ? (
              <h2
                style={{
                  margin: "0 0 8px",
                  fontSize: sectionTitleSize,
                  color: sectionTitleTextColor || DEFAULT_SECTION_TITLE_COLOR,
                  textAlign: "center",
                  letterSpacing: "-0.02em",
                }}
              >
                {sectionTitle}
              </h2>
            ) : null}
            {sectionDescription ? (
              <p
                style={{
                  margin: "0 0 16px",
                  fontSize: sectionDescSize,
                  color: sectionDescriptionTextColor || DEFAULT_SECTION_DESC_COLOR,
                  textAlign: "center",
                }}
              >
                {sectionDescription}
              </p>
            ) : null}
            <InnerBlocks
              allowedBlocks={[HOW_GOAL_ITEM_WORKS_BLOCK]}
              template={[
                [
                  HOW_GOAL_ITEM_WORKS_BLOCK,
                  {
                    title: "Choose your goal",
                    description:
                      "Pick the goal above that matches what you want to achieve.",
                    backgroundColor: DEFAULT_ITEM_BG,
                    accentColor: "#1E9BE9",
                  },
                ],
                [
                  HOW_GOAL_ITEM_WORKS_BLOCK,
                  {
                    title: "Follow the prompts",
                    description:
                      "Work down the page from ESSENTIAL to RECOMMENDED and ADVANCED.",
                    backgroundColor: DEFAULT_ITEM_BG,
                    accentColor: "#FFF000",
                  },
                ],
                [
                  HOW_GOAL_ITEM_WORKS_BLOCK,
                  {
                    title: "Build your stack",
                    description:
                      "Add the supplements our experts hand picked for your goal and get training.",
                    backgroundColor: DEFAULT_ITEM_BG,
                    accentColor: "#F5222D",
                  },
                ],
              ]}
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
        description,
        sectionTitle,
        sectionDescription,
        titleTextColor,
        descriptionTextColor,
        sectionTitleTextColor,
        sectionDescriptionTextColor,
        titleFontSize,
        descriptionFontSize,
        sectionTitleFontSize,
        sectionDescriptionFontSize,
        innerTItleFontSize,
        innerTitleTextColor,
        innerDescFontSize,
        innerDescTextColor,
      } = attributes;
      const blockProps = useBlockProps.save({
        className: "appbuilder-how-goal-works",
        "data-background-color": backgroundColor,
        "data-title-text-color": titleTextColor,
        "data-description-text-color": descriptionTextColor,
        "data-section-title-text-color": sectionTitleTextColor,
        "data-section-description-text-color": sectionDescriptionTextColor,
        "data-title-font-size": String(titleFontSize ?? 48),
        "data-description-font-size": String(descriptionFontSize ?? 24),
        "data-section-title-font-size": String(sectionTitleFontSize ?? 48),
        "data-section-description-font-size": String(sectionDescriptionFontSize ?? 28),
        "data-inner-title-font-size": String(innerTItleFontSize ?? 10),
        "data-inner-title-text-color": innerTitleTextColor,
        "data-inner-desc-font-size": String(innerDescFontSize ?? 10),
        "data-inner-desc-text-color": innerDescTextColor,
        style: { background: backgroundColor || DEFAULT_BG },
      });
      return (
        <div {...blockProps}>
          {title ? (
            <h2 className="appbuilder-how-goal-works__title">{title}</h2>
          ) : null}
          {description ? (
            <p className="appbuilder-how-goal-works__description">{description}</p>
          ) : null}
          {sectionTitle ? (
            <h2 className="appbuilder-how-goal-works__section-title">{sectionTitle}</h2>
          ) : null}
          {sectionDescription ? (
            <p className="appbuilder-how-goal-works__section-description">
              {sectionDescription}
            </p>
          ) : null}
          <div className="appbuilder-how-goal-works__items">
            <InnerBlocks.Content />
          </div>
        </div>
      );
    },
  });
}

export function registerHowGoalWorks() {
  registerHowGoalItemWorks();
  registerHowGoalWorksParent();
}
