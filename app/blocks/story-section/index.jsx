// @ts-nocheck
import { registerBlockType } from "gutenberg-block-kit/wp/blocks";
import {
  useBlockProps,
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
import { STORY_SECTION_BLOCK, APPBUILDER_CATEGORY } from "../constants";

const DEFAULT_TITLE = "Blogs & Insights";
const DEFAULT_HIGHLIGHT = "Company";
const DEFAULT_DESCRIPTION =
  "For over 20 years we've helped Australians achieve their fitness goals with premium supplements.";
const DEFAULT_BUTTON = "VIEW ALL";
const DEFAULT_BG = "#ffffff";
const DEFAULT_TEXT = "#ffffff";
const DEFAULT_TITLE_SIZE = 12;
const DEFAULT_DESC_SIZE = 12;
const DEFAULT_BUTTON_SIZE = 10;
const DEFAULT_HIGHLIGHT_SIZE = 10;
const DEFAULT_RADIUS = 10;

function toNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function registerStorySection() {
  registerBlockType(STORY_SECTION_BLOCK, {
    apiVersion: 3,
    title: "Story Section",
    category: APPBUILDER_CATEGORY,
    icon: "align-pull-left",
    supports: { html: false, align: ["wide", "full"] },
    attributes: {
      imageUrl: { type: "string", default: "" },
      imageWidth: { type: "number", default: 0 },
      imageHeight: { type: "number", default: 0 },
      imageBorderRadius: { type: "number", default: DEFAULT_RADIUS },
      backgroundColor: { type: "string", default: DEFAULT_BG },
      title: { type: "string", default: DEFAULT_TITLE },
      highlightedTitle: { type: "string", default: DEFAULT_HIGHLIGHT },
      highlightedTitleFontSize: {
        type: "number",
        default: DEFAULT_HIGHLIGHT_SIZE,
      },
      highlightedTitleTextColor: { type: "string", default: DEFAULT_TEXT },
      description: { type: "string", default: DEFAULT_DESCRIPTION },
      buttonText: { type: "string", default: DEFAULT_BUTTON },
      buttonTextColor: { type: "string", default: DEFAULT_TEXT },
      buttonFontSize: { type: "number", default: DEFAULT_BUTTON_SIZE },
      titleTextColor: { type: "string", default: DEFAULT_TEXT },
      titleFontSize: { type: "number", default: DEFAULT_TITLE_SIZE },
      descriptionTextColor: { type: "string", default: DEFAULT_TEXT },
      descriptionFontSize: { type: "number", default: DEFAULT_DESC_SIZE },
      buttonBorderRadius: { type: "number", default: DEFAULT_RADIUS },
      buttonBackgroundColor: { type: "string", default: DEFAULT_TEXT },
      action: { type: "object", default: {} },
    },
    edit: ({ attributes, setAttributes }) => {
      const {
        imageUrl,
        imageBorderRadius,
        backgroundColor,
        title,
        highlightedTitle,
        highlightedTitleFontSize,
        highlightedTitleTextColor,
        description,
        buttonText,
        buttonTextColor,
        buttonFontSize,
        titleTextColor,
        titleFontSize,
        descriptionTextColor,
        descriptionFontSize,
        buttonBorderRadius,
        buttonBackgroundColor,
        action,
      } = attributes;
      const titleSize = toNumber(titleFontSize, DEFAULT_TITLE_SIZE);
      const highlightSize = toNumber(
        highlightedTitleFontSize,
        DEFAULT_HIGHLIGHT_SIZE,
      );
      const descSize = toNumber(descriptionFontSize, DEFAULT_DESC_SIZE);
      const btnSize = toNumber(buttonFontSize, DEFAULT_BUTTON_SIZE);
      const imgRadius = toNumber(imageBorderRadius, DEFAULT_RADIUS);
      const btnRadius = toNumber(buttonBorderRadius, DEFAULT_RADIUS);
      const blockProps = useBlockProps({
        className: "appbuilder-story-section-editor",
        style: {
          background: backgroundColor || DEFAULT_BG,
          padding: "16px",
          display: "flex",
          gap: "16px",
          alignItems: "center",
        },
      });

      return (
        <>
          <InspectorControls>
            <PanelBody title="Story Section" initialOpen>
              <ImagePicker
                imageUrl={imageUrl}
                onSelect={(media) =>
                  setAttributes(imageAttributesFromMedia(media))
                }
                onClear={() => setAttributes(clearImageAttributes())}
              />
              <TextControl
                label="Image Border Radius"
                type="number"
                value={imgRadius}
                onChange={(value) =>
                  setAttributes({
                    imageBorderRadius: toNumber(value, DEFAULT_RADIUS),
                  })
                }
              />
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
              <TextareaControl
                label="Description"
                value={description}
                rows={4}
                onChange={(value) => setAttributes({ description: value })}
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
                label="Description Font Size"
                type="number"
                value={descSize}
                onChange={(value) =>
                  setAttributes({
                    descriptionFontSize: toNumber(value, DEFAULT_DESC_SIZE),
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
                value={btnRadius}
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
                  label: "Description Text Color",
                  value: descriptionTextColor || DEFAULT_TEXT,
                  onChange: (value) =>
                    setAttributes({
                      descriptionTextColor: value || DEFAULT_TEXT,
                    }),
                },
                {
                  label: "Button Text Color",
                  value: buttonTextColor || DEFAULT_TEXT,
                  onChange: (value) =>
                    setAttributes({ buttonTextColor: value || DEFAULT_TEXT }),
                },
                {
                  label: "Button Background Color",
                  value: buttonBackgroundColor || DEFAULT_TEXT,
                  onChange: (value) =>
                    setAttributes({
                      buttonBackgroundColor: value || DEFAULT_TEXT,
                    }),
                },
              ]}
            />
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
                        width: 120,
                        height: 120,
                        objectFit: "cover",
                        borderRadius: `${imgRadius}px`,
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
            <div>
              <h3 style={{ margin: 0 }}>
                <span
                  style={{
                    fontSize: `${titleSize}px`,
                    color: titleTextColor || DEFAULT_TEXT,
                  }}
                >
                  {title}{" "}
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
              {description ? (
                <p
                  style={{
                    fontSize: `${descSize}px`,
                    color: descriptionTextColor || DEFAULT_TEXT,
                  }}
                >
                  {description}
                </p>
              ) : null}
              {buttonText ? (
                <span
                  style={{
                    display: "inline-block",
                    fontSize: `${btnSize}px`,
                    color: buttonTextColor || DEFAULT_TEXT,
                    background: buttonBackgroundColor || DEFAULT_TEXT,
                    borderRadius: `${btnRadius}px`,
                    padding: "6px 12px",
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
        imageWidth,
        imageHeight,
        imageBorderRadius,
        backgroundColor,
        title,
        highlightedTitle,
        highlightedTitleFontSize,
        highlightedTitleTextColor,
        description,
        buttonText,
        buttonTextColor,
        buttonFontSize,
        titleTextColor,
        titleFontSize,
        descriptionTextColor,
        descriptionFontSize,
        buttonBorderRadius,
        buttonBackgroundColor,
        action,
      } = attributes;
      const blockProps = useBlockProps.save({
        className: "appbuilder-story-section",
        "data-image-url": imageUrl ?? "",
        "data-image-width": String(imageWidth ?? 0),
        "data-image-height": String(imageHeight ?? 0),
        "data-image-border-radius": String(
          toNumber(imageBorderRadius, DEFAULT_RADIUS),
        ),
        "data-background-color": backgroundColor || DEFAULT_BG,
        "data-title": title ?? "",
        "data-highlighted-title": highlightedTitle ?? "",
        "data-highlighted-title-font-size": String(
          toNumber(highlightedTitleFontSize, DEFAULT_HIGHLIGHT_SIZE),
        ),
        "data-highlighted-title-text-color":
          highlightedTitleTextColor || DEFAULT_TEXT,
        "data-description": description ?? "",
        "data-button-text": buttonText ?? "",
        "data-button-text-color": buttonTextColor || DEFAULT_TEXT,
        "data-button-font-size": String(
          toNumber(buttonFontSize, DEFAULT_BUTTON_SIZE),
        ),
        "data-title-text-color": titleTextColor || DEFAULT_TEXT,
        "data-title-font-size": String(
          toNumber(titleFontSize, DEFAULT_TITLE_SIZE),
        ),
        "data-description-text-color": descriptionTextColor || DEFAULT_TEXT,
        "data-description-font-size": String(
          toNumber(descriptionFontSize, DEFAULT_DESC_SIZE),
        ),
        "data-button-border-radius": String(
          toNumber(buttonBorderRadius, DEFAULT_RADIUS),
        ),
        "data-button-background-color": buttonBackgroundColor || DEFAULT_TEXT,
        "data-action": JSON.stringify(action ?? {}),
        style: { background: backgroundColor || DEFAULT_BG },
      });
      return (
        <div {...blockProps}>
          {imageUrl ? (
            <img
              src={imageUrl}
              alt=""
              className="appbuilder-story-section__image"
            />
          ) : null}
          {title ? (
            <h3 className="appbuilder-story-section__title">{title}</h3>
          ) : null}
          {highlightedTitle ? (
            <span className="appbuilder-story-section__highlighted">
              {highlightedTitle}
            </span>
          ) : null}
          {description ? (
            <p className="appbuilder-story-section__description">{description}</p>
          ) : null}
          {buttonText ? (
            <span className="appbuilder-story-section__button">{buttonText}</span>
          ) : null}
        </div>
      );
    },
  });
}
