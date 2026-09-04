// @ts-nocheck
import { registerBlockType } from "gutenberg-block-kit/wp/blocks";
import {
  useBlockProps,
  InspectorControls,
} from "gutenberg-block-kit/wp/block-editor";
import {
  PanelBody,
  TextControl,
  Button,
} from "gutenberg-block-kit/wp/components";
import { ActionBuilder } from "gutenberg-block-kit/actions";
import { contentTabStyle, ColorSettingsPanel } from "../inspector-shared";
import { PRODUCT_SCROLLER_BLOCK, APPBUILDER_CATEGORY } from "../constants";

const DEFAULT_TITLE = "Most Loved By Our Customers";
const DEFAULT_SUBTITLE = "Best Sellers";
const DEFAULT_BUTTON = "VIEW ALL BEST SELLERS";
const DEFAULT_BG = "#f5f5f5";
const DEFAULT_TEXT = "#ffffff";
const PREVIEW_TITLE_COLOR = "#111111";
const PREVIEW_SUBTITLE_COLOR = "#6b6b6b";
const PREVIEW_BUTTON_COLOR = "#7cb342";
const DEFAULT_TITLE_SIZE = 12;
const DEFAULT_SUBTITLE_SIZE = 12;
const DEFAULT_BUTTON_SIZE = 10;
const DEFAULT_PRODUCTS = 10;

const PREVIEW_PRODUCTS = [
  {
    brand: "PRANA ON",
    name: "POWER PLANT",
    desc: "Pea, Inchi & Rice Protein.",
    price: "$24.95",
  },
  {
    brand: "RULE 1",
    name: "RULE 1 WHEY PROTEIN",
    desc: "Premium Whey Blend",
    price: "$24.95",
  },
];

function previewColor(value, fallback) {
  const raw = String(value || "").trim();
  if (!raw || raw.toLowerCase() === "#ffffff" || raw.toLowerCase() === "#fff") {
    return fallback;
  }
  return raw;
}

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

export function registerProductScroller() {
  registerBlockType(PRODUCT_SCROLLER_BLOCK, {
    apiVersion: 3,
    title: "Product Scroller",
    category: APPBUILDER_CATEGORY,
    icon: "products",
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
      numberOfProduct: { type: "number", default: DEFAULT_PRODUCTS },
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
        numberOfProduct,
      } = attributes;
      const titleSize = Math.max(toNumber(titleFontSize, DEFAULT_TITLE_SIZE), 0);
      const subSize = Math.max(toNumber(subTitleFontSize, DEFAULT_SUBTITLE_SIZE),0);
      const btnSize = Math.max(toNumber(buttonFontSize, DEFAULT_BUTTON_SIZE), 0);
      const productCount = Math.max(toNumber(numberOfProduct, DEFAULT_PRODUCTS), 0);
      const blockProps = useBlockProps({
        className: "appbuilder-product-scroller-editor appbuilder-ps-preview",
        style: {
          background: backgroundColor || DEFAULT_BG,
        },
      });

      return (
        <>
          <InspectorControls group="content">
            <div style={contentTabStyle}>
            <PanelBody title="Product Scroller" initialOpen>
              <TextControl
                label="Number Of Product"
                type="number"
                min={0}
                value={productCount}
                onChange={(value) =>
                  setAttributes({
                    numberOfProduct: Math.max(
                      toNumber(value, DEFAULT_PRODUCTS),
                      0,
                    ),
                  })
                }
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
            <ColorSettingsPanel
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
            </div>
          </InspectorControls>
          <InspectorControls>
            <PanelBody title="Product Scroller" initialOpen>
              <TextControl
                label="Number Of Product"
                type="number"
                min={0}
                value={productCount}
                onChange={(value) =>
                  setAttributes({
                    numberOfProduct: Math.max(
                      toNumber(value, DEFAULT_PRODUCTS),
                      0,
                    ),
                  })
                }
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
              <TextControl
                label="Button Text"
                value={buttonText}
                onChange={(value) => setAttributes({ buttonText: value })}
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
            <ColorSettingsPanel
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
            <div className="appbuilder-ps-preview__header">
              <div>
                <input
                  className="appbuilder-ps-preview__title"
                  type="text"
                  value={title}
                  placeholder={DEFAULT_TITLE}
                  onChange={(event) =>
                    setAttributes({ title: event.target.value })
                  }
                  onClick={(event) => event.stopPropagation()}
                  style={{
                    fontSize: `${titleSize}px`,
                    color: previewColor(titleTextColor, PREVIEW_TITLE_COLOR),
                  }}
                />
                <input
                  className="appbuilder-ps-preview__subtitle"
                  type="text"
                  value={subTitle}
                  placeholder={DEFAULT_SUBTITLE}
                  onChange={(event) =>
                    setAttributes({ subTitle: event.target.value })
                  }
                  onClick={(event) => event.stopPropagation()}
                  style={{
                    fontSize: `${subSize}px`,
                    color: previewColor(
                      subTitleTextColor,
                      PREVIEW_SUBTITLE_COLOR,
                    ),
                  }}
                />
              </div>
              <input
                className="appbuilder-ps-preview__view-all"
                type="text"
                value={buttonText}
                placeholder={DEFAULT_BUTTON}
                onChange={(event) =>
                  setAttributes({ buttonText: event.target.value })
                }
                onClick={(event) => event.stopPropagation()}
                style={{
                  fontSize: `${btnSize}px`,
                  color: previewColor(buttonTextColor, PREVIEW_BUTTON_COLOR),
                }}
              />
            </div>
            <div className="appbuilder-ps-preview__track">
              {PREVIEW_PRODUCTS.map((product) => (
                <div key={product.name} className="appbuilder-ps-preview__card">
                  <span className="appbuilder-ps-preview__badge">NEW</span>
                  <div className="appbuilder-ps-preview__image" />
                  <p className="appbuilder-ps-preview__brand">{product.brand}</p>
                  <p className="appbuilder-ps-preview__name">{product.name}</p>
                  <p className="appbuilder-ps-preview__desc">{product.desc}</p>
                  <div className="appbuilder-ps-preview__meta">
                    <span className="appbuilder-ps-preview__dot">✓</span>
                    In Stock
                    <span className="appbuilder-ps-preview__meta-sep" />
                    <span className="appbuilder-ps-preview__star">★</span>
                    200 Reviews
                  </div>
                  <div className="appbuilder-ps-preview__footer">
                    <div>
                      <span className="appbuilder-ps-preview__from">FROM</span>
                      <span className="appbuilder-ps-preview__price">
                        {product.price}
                      </span>
                    </div>
                    <span className="appbuilder-ps-preview__add">ADD</span>
                  </div>
                </div>
              ))}
            </div>
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
        numberOfProduct,
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
        "data-number-of-product": String(
          Math.max(toNumber(numberOfProduct, DEFAULT_PRODUCTS), 0),
        ),
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
