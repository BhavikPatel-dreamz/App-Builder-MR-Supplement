// @ts-nocheck
import { registerBlockType } from "gutenberg-block-kit/wp/blocks";
import {
  useBlockProps,
  InspectorControls,
  PanelColorSettings,
} from "gutenberg-block-kit/wp/block-editor";
import {
  PanelBody,
  TextControl,
  Button,
} from "gutenberg-block-kit/wp/components";
import { ActionBuilder } from "gutenberg-block-kit/actions";
import { PRODUCT_SCROLLER_BLOCK, APPBUILDER_CATEGORY } from "../constants";

const DEFAULT_TITLE = "Most Loved By Our Customers";
const DEFAULT_SUBTITLE = "Best Sellers";
const DEFAULT_BUTTON = "VIEW ALL BEST SELLERS";
const DEFAULT_BG = "#f5f5f5";
const DEFAULT_TEXT = "#ffffff";
const DEFAULT_TITLE_SIZE = 12;
const DEFAULT_SUBTITLE_SIZE = 12;
const DEFAULT_BUTTON_SIZE = 10;

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

function ProductScrollerIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24">
      <path
        fill="currentColor"
        d="M3 5h5v14H3V5zm6 0h6v14H9V5zm7 0h5v14h-5V5z"
      />
    </svg>
  );
}

export function registerProductScroller() {
  registerBlockType(PRODUCT_SCROLLER_BLOCK, {
    apiVersion: 3,
    title: "Product Scroller",
    category: APPBUILDER_CATEGORY,
    icon: ProductScrollerIcon,
    supports: { html: false, align: ["wide", "full"] },
    attributes: {
      title: { type: "string", default: DEFAULT_TITLE },
      subTitle: { type: "string", default: DEFAULT_SUBTITLE },
      backgroundColor: { type: "string", default: DEFAULT_BG },
      buttonText: { type: "string", default: DEFAULT_BUTTON },
      titleFontSize: { type: "number", default: DEFAULT_TITLE_SIZE },
      titleTextColor: { type: "string", default: DEFAULT_TEXT },
      subTitleFontSize: { type: "number", default: DEFAULT_SUBTITLE_SIZE },
      subTitleTextColor: { type: "string", default: DEFAULT_TEXT },
      buttonFontSize: { type: "number", default: DEFAULT_BUTTON_SIZE },
      buttonTextColor: { type: "string", default: DEFAULT_TEXT },
      collection: { type: "object", default: {} },
      action: { type: "object", default: {} },
    },
    edit: ({ attributes, setAttributes }) => {
      const {
        title,
        subTitle,
        backgroundColor,
        buttonText,
        titleFontSize,
        titleTextColor,
        subTitleFontSize,
        subTitleTextColor,
        buttonFontSize,
        buttonTextColor,
        collection,
        action,
      } = attributes;
      const titleSize = toNumber(titleFontSize, DEFAULT_TITLE_SIZE);
      const subSize = toNumber(subTitleFontSize, DEFAULT_SUBTITLE_SIZE);
      const btnSize = toNumber(buttonFontSize, DEFAULT_BUTTON_SIZE);
      const blockProps = useBlockProps({
        className: "appbuilder-product-scroller-editor",
        style: {
          background: backgroundColor || DEFAULT_BG,
          padding: "16px",
        },
      });

      return (
        <>
          <InspectorControls>
            <PanelBody title="Product Scroller" initialOpen>
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
              <CollectionPicker
                collection={collection}
                onChange={(next) => setAttributes({ collection: next })}
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
              ]}
            />
          </InspectorControls>
          <div {...blockProps}>
            <h3
              style={{
                margin: 0,
                fontSize: `${titleSize}px`,
                color: titleTextColor || DEFAULT_TEXT,
              }}
            >
              {title || DEFAULT_TITLE}
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
                }}
              >
                {buttonText}
              </span>
            ) : null}
            {collection?.title ? (
              <p style={{ margin: "8px 0 0", fontSize: "12px" }}>
                Collection: {collection.title}
              </p>
            ) : null}
          </div>
        </>
      );
    },
    save: ({ attributes }) => {
      const {
        title,
        subTitle,
        backgroundColor,
        buttonText,
        titleFontSize,
        titleTextColor,
        subTitleFontSize,
        subTitleTextColor,
        buttonFontSize,
        buttonTextColor,
        collection,
        action,
      } = attributes;
      const blockProps = useBlockProps.save({
        className: "appbuilder-product-scroller",
        "data-title": title ?? "",
        "data-subtitle": subTitle ?? "",
        "data-background-color": backgroundColor || DEFAULT_BG,
        "data-button-text": buttonText ?? "",
        "data-title-font-size": String(
          toNumber(titleFontSize, DEFAULT_TITLE_SIZE),
        ),
        "data-title-text-color": titleTextColor || DEFAULT_TEXT,
        "data-subtitle-font-size": String(
          toNumber(subTitleFontSize, DEFAULT_SUBTITLE_SIZE),
        ),
        "data-subtitle-text-color": subTitleTextColor || DEFAULT_TEXT,
        "data-button-font-size": String(
          toNumber(buttonFontSize, DEFAULT_BUTTON_SIZE),
        ),
        "data-button-text-color": buttonTextColor || DEFAULT_TEXT,
        "data-collection": JSON.stringify(collection ?? {}),
        "data-action": JSON.stringify(action ?? {}),
        style: { background: backgroundColor || DEFAULT_BG },
      });
      return (
        <div {...blockProps}>
          {title ? (
            <h3 className="appbuilder-product-scroller__title">{title}</h3>
          ) : null}
          {subTitle ? (
            <p className="appbuilder-product-scroller__subtitle">{subTitle}</p>
          ) : null}
          {buttonText ? (
            <span className="appbuilder-product-scroller__button">{buttonText}</span>
          ) : null}
        </div>
      );
    },
  });
}
