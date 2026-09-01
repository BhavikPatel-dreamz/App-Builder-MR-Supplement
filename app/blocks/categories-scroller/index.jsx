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
  CATEGORIES_SCROLLER_BLOCK,
  CATEGORIES_SCROLLER_ITEM_BLOCK,
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
const DEFAULT_ITEM_TITLE = "Set";

function toNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

async function pickCollection() {
  const picker =
    typeof window !== "undefined" ? window.shopify?.resourcePicker : null;
  if (!picker) return null;
  try {
    const selection = await picker({ type: "collection", multiple: false });
    const collection = selection?.[0];
    if (!collection) return null;
    return {
      collectionId: collection.id,
      handle: collection.handle,
      title: collection.title,
    };
  } catch (err) {
    console.error("ResourcePicker collection error:", err);
    return null;
  }
}

function CollectionPicker({ collection, onChange }) {
  const hasCollection = Boolean(collection?.collectionId);
  return (
    <div style={{ marginBottom: "12px" }}>
      {hasCollection ? (
        <p style={{ fontSize: "13px", margin: "0 0 8px" }}>
          {collection.title || collection.handle || collection.collectionId}
        </p>
      ) : (
        <p style={{ fontSize: "13px", color: "#6d7175", margin: "0 0 8px" }}>
          No collection selected
        </p>
      )}
      <Button
        variant="secondary"
        onClick={async () => {
          const next = await pickCollection();
          if (next) onChange(next);
        }}
      >
        {hasCollection ? "Change collection" : "Select collection"}
      </Button>
      {hasCollection ? (
        <Button
          variant="link"
          isDestructive
          onClick={() => onChange({})}
          style={{ marginLeft: "8px" }}
        >
          Clear
        </Button>
      ) : null}
    </div>
  );
}

function CategoriesScrollerIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24">
      <path
        fill="currentColor"
        d="M4 4h7v7H4V4zm9 0h7v7h-7V4zM4 13h7v7H4v-7zm9 0h7v7h-7v-7z"
      />
    </svg>
  );
}

function registerCategoryScrollerItem() {
  registerBlockType(CATEGORIES_SCROLLER_ITEM_BLOCK, {
    apiVersion: 3,
    title: "Category Scroller Item",
    category: APPBUILDER_CATEGORY,
    parent: [CATEGORIES_SCROLLER_BLOCK],
    icon: "category",
    supports: { html: false, reusable: false },
    attributes: {
      imageUrl: { type: "string", default: "" },
      imageWidth: { type: "number", default: 0 },
      imageHeight: { type: "number", default: 0 },
      showTitle: { type: "boolean", default: true },
      title: { type: "string", default: DEFAULT_ITEM_TITLE },
      subTitle: { type: "string", default: DEFAULT_SUBTITLE },
      showSubTitle: { type: "boolean", default: true },
      showImageSubtitle: { type: "boolean", default: true },
      showButton: { type: "boolean", default: true },
      buttonText: { type: "string", default: DEFAULT_BUTTON },
      buttonTextColor: { type: "string", default: DEFAULT_TEXT },
      buttonFontSize: { type: "number", default: DEFAULT_BUTTON_SIZE },
      titleTextColor: { type: "string", default: DEFAULT_TEXT },
      titleFontSize: { type: "number", default: DEFAULT_TITLE_SIZE },
      subTitleTextColor: { type: "string", default: DEFAULT_TEXT },
      subTitleFontSize: { type: "number", default: DEFAULT_SUBTITLE_SIZE },
      showArrow: { type: "boolean", default: true },
      collection: { type: "object", default: {} },
      action: { type: "object", default: {} },
    },
    edit: ({ attributes, setAttributes }) => {
      const {
        imageUrl,
        showTitle,
        title,
        subTitle,
        showSubTitle,
        showImageSubtitle,
        showButton,
        buttonText,
        buttonTextColor,
        buttonFontSize,
        titleTextColor,
        titleFontSize,
        subTitleTextColor,
        subTitleFontSize,
        showArrow,
        collection,
        action,
      } = attributes;
      const titleSize = toNumber(titleFontSize, DEFAULT_TITLE_SIZE);
      const subSize = toNumber(subTitleFontSize, DEFAULT_SUBTITLE_SIZE);
      const btnSize = toNumber(buttonFontSize, DEFAULT_BUTTON_SIZE);
      const showItemSubtitle = showImageSubtitle ?? showSubTitle;
      const blockProps = useBlockProps({
        className: "appbuilder-categories-scroller-item-editor",
        style: { minWidth: "140px" },
      });

      return (
        <>
          <InspectorControls>
            <PanelBody title="Category Item" initialOpen>
              <ImagePicker
                imageUrl={imageUrl}
                onSelect={(media) =>
                  setAttributes(imageAttributesFromMedia(media))
                }
                onClear={() => setAttributes(clearImageAttributes())}
              />
              <CollectionPicker
                collection={collection}
                onChange={(next) => setAttributes({ collection: next })}
              />
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
                label="Show Image Subtitle"
                checked={!!showItemSubtitle}
                onChange={(value) =>
                  setAttributes({
                    showImageSubtitle: value,
                    showSubTitle: value,
                  })
                }
              />
              {showItemSubtitle ? (
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
                </>
              ) : null}
              <ToggleControl
                label="Show Arrow"
                checked={!!showArrow}
                onChange={(value) => setAttributes({ showArrow: value })}
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
                      className="appbuilder-categories-scroller-item-editor__image"
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
                    <button
                      type="button"
                      className="appbuilder-categories-scroller-item-editor__image-btn"
                      onClick={open}
                    >
                      Add image
                    </button>
                  )}
                />
              </MediaUploadCheck>
            )}
            {showTitle ? (
              <div
                style={{
                  fontSize: `${titleSize}px`,
                  color: titleTextColor || DEFAULT_TEXT,
                }}
              >
                {title || DEFAULT_ITEM_TITLE}
                {showArrow ? " ›" : ""}
              </div>
            ) : null}
            {showItemSubtitle ? (
              <div
                style={{
                  fontSize: `${subSize}px`,
                  color: subTitleTextColor || DEFAULT_TEXT,
                }}
              >
                {subTitle}
              </div>
            ) : null}
          </div>
        </>
      );
    },
    save: ({ attributes }) => {
      const {
        imageUrl,
        imageWidth,
        imageHeight,
        showTitle,
        title,
        subTitle,
        showSubTitle,
        showImageSubtitle,
        showButton,
        buttonText,
        buttonTextColor,
        buttonFontSize,
        titleTextColor,
        titleFontSize,
        subTitleTextColor,
        subTitleFontSize,
        showArrow,
        collection,
        action,
      } = attributes;
      const blockProps = useBlockProps.save({
        className: "appbuilder-categories-scroller__item",
        "data-image-url": imageUrl ?? "",
        "data-image-width": String(imageWidth ?? 0),
        "data-image-height": String(imageHeight ?? 0),
        "data-show-title": String(!!showTitle),
        "data-title": title ?? "",
        "data-subtitle": subTitle ?? "",
        "data-show-subtitle": String(!!(showImageSubtitle ?? showSubTitle)),
        "data-show-image-subtitle": String(
          !!(showImageSubtitle ?? showSubTitle),
        ),
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
        "data-show-arrow": String(!!showArrow),
        "data-collection": JSON.stringify(collection ?? {}),
        "data-action": JSON.stringify(action ?? {}),
      });
      return (
        <div {...blockProps}>
          {imageUrl ? (
            <img
              src={imageUrl}
              alt=""
              className="appbuilder-categories-scroller__image"
            />
          ) : null}
          {showTitle && title ? (
            <span className="appbuilder-categories-scroller__label">{title}</span>
          ) : null}
        </div>
      );
    },
  });
}

function registerCategoryScrollerParent() {
  registerBlockType(CATEGORIES_SCROLLER_BLOCK, {
    apiVersion: 3,
    title: "Categories Scroller",
    category: APPBUILDER_CATEGORY,
    icon: CategoriesScrollerIcon,
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
      backgroundColor: { type: "string", default: DEFAULT_BG },
      ImageBorderRadius: { type: "number", default: DEFAULT_RADIUS },
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
        backgroundColor,
        ImageBorderRadius,
        action,
      } = attributes;
      const titleSize = toNumber(titleFontSize, DEFAULT_TITLE_SIZE);
      const subSize = toNumber(subTitleFontSize, DEFAULT_SUBTITLE_SIZE);
      const btnSize = toNumber(buttonFontSize, DEFAULT_BUTTON_SIZE);
      const radius = toNumber(ImageBorderRadius, DEFAULT_RADIUS);
      const blockProps = useBlockProps({
        className: "appbuilder-categories-scroller-editor",
        style: {
          background: backgroundColor || DEFAULT_BG,
          "--appbuilder-category-image-radius": `${radius}px`,
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
            </div>
            <div
              className="appbuilder-categories-scroller__track"
              style={{ borderRadius: `${radius}px` }}
            >
              <InnerBlocks
                allowedBlocks={[CATEGORIES_SCROLLER_ITEM_BLOCK]}
                template={[
                  [CATEGORIES_SCROLLER_ITEM_BLOCK, { title: "Set" }],
                  [CATEGORIES_SCROLLER_ITEM_BLOCK, { title: "Set" }],
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
        backgroundColor,
        ImageBorderRadius,
        action,
      } = attributes;
      const radius = toNumber(ImageBorderRadius, DEFAULT_RADIUS);
      const blockProps = useBlockProps.save({
        className: "appbuilder-categories-scroller",
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
        "data-background-color": backgroundColor || DEFAULT_BG,
        "data-image-border-radius": String(radius),
        "data-action": JSON.stringify(action ?? {}),
        style: {
          background: backgroundColor || DEFAULT_BG,
          "--appbuilder-category-image-radius": `${radius}px`,
        },
      });
      return (
        <div {...blockProps}>
          {showTitle && title ? (
            <h3 className="appbuilder-categories-scroller__title">{title}</h3>
          ) : null}
          {showSubTitle && subTitle ? (
            <p className="appbuilder-categories-scroller__subtitle">{subTitle}</p>
          ) : null}
          {showButton && buttonText ? (
            <span className="appbuilder-categories-scroller__button">
              {buttonText}
            </span>
          ) : null}
          <div className="appbuilder-categories-scroller__track">
            <InnerBlocks.Content />
          </div>
        </div>
      );
    },
  });
}

export function registerCategoriesScroller() {
  registerCategoryScrollerItem();
  registerCategoryScrollerParent();
}
