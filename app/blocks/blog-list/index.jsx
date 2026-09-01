// @ts-nocheck
import { registerBlockType } from "gutenberg-block-kit/wp/blocks";
import {
  useBlockProps,
  InspectorControls,
  PanelColorSettings,
} from "gutenberg-block-kit/wp/block-editor";
import { PanelBody, TextControl } from "gutenberg-block-kit/wp/components";
import { ActionBuilder } from "gutenberg-block-kit/actions";
import { BLOG_LIST_BLOCK, APPBUILDER_CATEGORY } from "../constants";

const DEFAULT_TITLE = "Blogs & Insights";
const DEFAULT_BUTTON = "VIEW ALL";
const DEFAULT_BG = "#ffffff";
const DEFAULT_TEXT = "#ffffff";
const DEFAULT_TITLE_SIZE = 12;
const DEFAULT_BUTTON_SIZE = 10;
const DEFAULT_RADIUS = 10;
const DEFAULT_BORDER_WIDTH = 2;
const DEFAULT_BORDER = "#ffffff";

function toNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function registerBlogList() {
  registerBlockType(BLOG_LIST_BLOCK, {
    apiVersion: 3,
    title: "Blogs List",
    category: APPBUILDER_CATEGORY,
    icon: "list-view",
    supports: { html: false, align: ["wide", "full"] },
    attributes: {
      backgroundColor: { type: "string", default: DEFAULT_BG },
      title: { type: "string", default: DEFAULT_TITLE },
      buttonText: { type: "string", default: DEFAULT_BUTTON },
      buttonTextColor: { type: "string", default: DEFAULT_TEXT },
      buttonFontSize: { type: "number", default: DEFAULT_BUTTON_SIZE },
      titleTextColor: { type: "string", default: DEFAULT_TEXT },
      titleFontSize: { type: "number", default: DEFAULT_TITLE_SIZE },
      buttonBorderRadius: { type: "number", default: DEFAULT_RADIUS },
      buttonBorderColor: { type: "string", default: DEFAULT_BORDER },
      buttonBorderWidth: { type: "number", default: DEFAULT_BORDER_WIDTH },
      action: { type: "object", default: {} },
    },
    edit: ({ attributes, setAttributes }) => {
      const {
        backgroundColor,
        title,
        buttonText,
        buttonTextColor,
        buttonFontSize,
        titleTextColor,
        titleFontSize,
        buttonBorderRadius,
        buttonBorderColor,
        buttonBorderWidth,
        action,
      } = attributes;
      const titleSize = toNumber(titleFontSize, DEFAULT_TITLE_SIZE);
      const btnSize = toNumber(buttonFontSize, DEFAULT_BUTTON_SIZE);
      const radius = toNumber(buttonBorderRadius, DEFAULT_RADIUS);
      const borderW = toNumber(buttonBorderWidth, DEFAULT_BORDER_WIDTH);
      const blockProps = useBlockProps({
        className: "appbuilder-blog-list-editor",
        style: { minHeight: "8px" },
      });

      return (
        <>
          <InspectorControls>
            <PanelBody title="Blogs List" initialOpen>
              <TextControl
                label="Title"
                value={title}
                onChange={(value) => setAttributes({ title: value })}
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
          <div {...blockProps} />
        </>
      );
    },
    save: ({ attributes }) => {
      const {
        backgroundColor,
        title,
        buttonText,
        buttonTextColor,
        buttonFontSize,
        titleTextColor,
        titleFontSize,
        buttonBorderRadius,
        buttonBorderColor,
        buttonBorderWidth,
        action,
      } = attributes;
      const blockProps = useBlockProps.save({
        className: "appbuilder-blog-list",
        "data-background-color": backgroundColor || DEFAULT_BG,
        "data-title": title ?? "",
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
        "data-action": JSON.stringify(action ?? {}),
      });
      return <div {...blockProps} />;
    },
  });
}
