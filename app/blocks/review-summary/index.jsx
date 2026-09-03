// @ts-nocheck
import { registerBlockType } from "gutenberg-block-kit/wp/blocks";
import {
  useBlockProps,
  InspectorControls,
  PanelColorSettings,
} from "gutenberg-block-kit/wp/block-editor";
import { PanelBody, TextControl } from "gutenberg-block-kit/wp/components";
import { ActionBuilder } from "gutenberg-block-kit/actions";
import { REVIEW_SUMMARY_BLOCK, APPBUILDER_CATEGORY } from "../constants";

const DEFAULT_TITLE = "Blogs & Insights";
const DEFAULT_SUBTITLE =
  "Rated Excellent on Trustpilot with over 18,000 verified reviews.";
const DEFAULT_BG = "#ffffff";
const DEFAULT_TEXT = "#ffffff";
const DEFAULT_TITLE_SIZE = 12;
const DEFAULT_SUBTITLE_SIZE = 12;
const DEFAULT_REVIEWS = 10;

function toNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function registerReviewSummary() {
  registerBlockType(REVIEW_SUMMARY_BLOCK, {
    apiVersion: 3,
    title: "Review Summary",
    category: APPBUILDER_CATEGORY,
    icon: "star-filled",
    supports: { html: false, align: ["wide", "full"] },
    attributes: {
      backgroundColor: { type: "string", default: DEFAULT_BG },
      title: { type: "string", default: DEFAULT_TITLE },
      titleTextColor: { type: "string", default: DEFAULT_TEXT },
      titleFontSize: { type: "number", default: DEFAULT_TITLE_SIZE },
      subTitleText: { type: "string", default: DEFAULT_SUBTITLE },
      subTitleTextColor: { type: "string", default: DEFAULT_TEXT },
      subTitleFontSize: { type: "number", default: DEFAULT_SUBTITLE_SIZE },
      numberOfReviews: { type: "number", default: DEFAULT_REVIEWS },
      action: { type: "object", default: {} },
    },
    edit: ({ attributes, setAttributes }) => {
      const {
        backgroundColor,
        title,
        titleTextColor,
        titleFontSize,
        subTitleText,
        subTitleTextColor,
        subTitleFontSize,
        numberOfReviews,
        action,
      } = attributes;
      const titleSize = toNumber(titleFontSize, DEFAULT_TITLE_SIZE);
      const subSize = toNumber(subTitleFontSize, DEFAULT_SUBTITLE_SIZE);
      const reviews = toNumber(numberOfReviews, DEFAULT_REVIEWS);
      const blockProps = useBlockProps({
        className: "appbuilder-review-summary-editor",
        style: { minHeight: "8px" },
      });

      return (
        <>
          <InspectorControls>
            <PanelBody title="Review Summary" initialOpen>
              <TextControl
                label="Title"
                value={title}
                onChange={(value) => setAttributes({ title: value })}
              />
              <TextControl
                label="Sub Title"
                value={subTitleText}
                onChange={(value) => setAttributes({ subTitleText: value })}
              />
              <TextControl
                label="Number of Reviews to show"
                type="number"
                value={reviews}
                onChange={(value) =>
                  setAttributes({
                    numberOfReviews: toNumber(value, DEFAULT_REVIEWS),
                  })
                }
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
        titleTextColor,
        titleFontSize,
        subTitleText,
        subTitleTextColor,
        subTitleFontSize,
        numberOfReviews,
        action,
      } = attributes;
      const blockProps = useBlockProps.save({
        className: "appbuilder-review-summary",
        "data-background-color": backgroundColor || DEFAULT_BG,
        "data-title": title ?? "",
        "data-title-text-color": titleTextColor || DEFAULT_TEXT,
        "data-title-font-size": String(
          toNumber(titleFontSize, DEFAULT_TITLE_SIZE),
        ),
        "data-subtitle-text": subTitleText ?? "",
        "data-subtitle-text-color": subTitleTextColor || DEFAULT_TEXT,
        "data-subtitle-font-size": String(
          toNumber(subTitleFontSize, DEFAULT_SUBTITLE_SIZE),
        ),
        "data-number-of-reviews": String(
          toNumber(numberOfReviews, DEFAULT_REVIEWS),
        ),
        "data-action": JSON.stringify(action ?? {}),
      });
      return <div {...blockProps} />;
    },
  });
}
