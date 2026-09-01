// @ts-nocheck
import { registerBlockType } from "gutenberg-block-kit/wp/blocks";
import {
  useBlockProps,
  InnerBlocks,
  InspectorControls,
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
  PRODUCTS_BY_CATEGORIS_SCROLLER_BLOCK,
  PRODUCT_BY_CATEGORIES_SCROLLER_ITEM_BLOCK,
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
const DEFAULT_PRODUCTS = 10;

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

function registerProductsByCategorisScrollerItem() {
  registerBlockType(PRODUCT_BY_CATEGORIES_SCROLLER_ITEM_BLOCK, {
    apiVersion: 3,
    title: "Category Tab",
    category: APPBUILDER_CATEGORY,
    parent: [PRODUCTS_BY_CATEGORIS_SCROLLER_BLOCK],
    icon: "category",
    supports: { html: false, reusable: false },
    attributes: {
      collection: { type: "object", default: {} },
      label: { type: "string", default: "" },
      action: { type: "object", default: {} },
    },
    edit: ({ attributes, setAttributes }) => {
      const { collection, label, action } = attributes;
      const blockProps = useBlockProps({
        className: "appbuilder-products-by-categoris-scroller-item-editor",
        style: {
          display: "inline-flex",
          padding: "6px 12px",
          borderRadius: "999px",
          border: "1px solid #ddd",
          whiteSpace: "nowrap",
          marginRight: "8px",
        },
      });

      return (
        <>
          <InspectorControls>
            <PanelBody title="Category" initialOpen>
              <CollectionPicker
                collection={collection}
                onChange={(next) => setAttributes({ collection: next })}
              />
              <TextControl
                label="Label"
                value={label}
                onChange={(value) => setAttributes({ label: value })}
              />
              <ActionBuilder
                label="Action"
                value={action ?? {}}
                onChange={(next) => setAttributes({ action: next })}
              />
            </PanelBody>
          </InspectorControls>
          <div {...blockProps}>
            {label || collection?.title || "Category"}
          </div>
        </>
      );
    },
    save: ({ attributes }) => {
      const { collection, label, action } = attributes;
      const blockProps = useBlockProps.save({
        className: "appbuilder-products-by-categoris-scroller-item",
        "data-collection": JSON.stringify(collection ?? {}),
        "data-label": label ?? "",
        "data-action": JSON.stringify(action ?? {}),
      });
      return (
        <div {...blockProps}>
          {label ? (
            <span className="appbuilder-products-by-categoris-scroller-item__label">
              {label}
            </span>
          ) : null}
        </div>
      );
    },
  });
}

function registerProductsByCategorisScrollerParent() {
  registerBlockType(PRODUCTS_BY_CATEGORIS_SCROLLER_BLOCK, {
    apiVersion: 3,
    title: "Products By Categories Scroller",
    category: APPBUILDER_CATEGORY,
    icon: "products",
    supports: { html: false, align: ["wide", "full"] },
    attributes: {
      title: { type: "string", default: DEFAULT_TITLE },
      subTitle: { type: "string", default: DEFAULT_SUBTITLE },
      showTitle: { type: "boolean", default: true },
      showSubTitle: { type: "boolean", default: true },
      showButton: { type: "boolean", default: true },
      buttonText: { type: "string", default: DEFAULT_BUTTON },
      action: { type: "object", default: {} },
      numberOfProduct: { type: "number", default: DEFAULT_PRODUCTS },
      backgroundColor: { type: "string", default: DEFAULT_BG },
      titleFontSize: { type: "number", default: DEFAULT_TITLE_SIZE },
      titleTextColor: { type: "string", default: DEFAULT_TEXT },
      subTitleFontSize: { type: "number", default: DEFAULT_SUBTITLE_SIZE },
      subTitleTextColor: { type: "string", default: DEFAULT_TEXT },
      buttonFontSize: { type: "number", default: DEFAULT_BUTTON_SIZE },
      buttonTextColor: { type: "string", default: DEFAULT_TEXT },
    },
    edit: ({ attributes, setAttributes }) => {
      const {
        title,
        subTitle,
        showTitle,
        showSubTitle,
        showButton,
        buttonText,
        action,
        numberOfProduct,
        backgroundColor,
        titleFontSize,
        titleTextColor,
        subTitleFontSize,
        subTitleTextColor,
        buttonFontSize,
        buttonTextColor,
      } = attributes;

      const titleSize = toNumber(titleFontSize, DEFAULT_TITLE_SIZE);
      const subSize = toNumber(subTitleFontSize, DEFAULT_SUBTITLE_SIZE);
      const btnSize = toNumber(buttonFontSize, DEFAULT_BUTTON_SIZE);
      const productCount = toNumber(numberOfProduct, DEFAULT_PRODUCTS);

      const blockProps = useBlockProps({
        className: "appbuilder-products-by-categoris-scroller-editor",
        style: {
          background: backgroundColor || DEFAULT_BG,
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
                label="Number of Products"
                type="number"
                value={productCount}
                onChange={(value) =>
                  setAttributes({
                    numberOfProduct: toNumber(value, DEFAULT_PRODUCTS),
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
                alignItems: "flex-start",
                marginBottom: "12px",
                gap: "12px",
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
                    {subTitle || DEFAULT_SUBTITLE}
                  </p>
                ) : null}
              </div>
              {showButton ? (
                <span
                  style={{
                    fontSize: `${btnSize}px`,
                    color: buttonTextColor || DEFAULT_TEXT,
                    whiteSpace: "nowrap",
                  }}
                >
                  {buttonText || DEFAULT_BUTTON}
                </span>
              ) : null}
            </div>
            <InnerBlocks
              allowedBlocks={[PRODUCT_BY_CATEGORIES_SCROLLER_ITEM_BLOCK]}
              template={[
                [
                  PRODUCT_BY_CATEGORIES_SCROLLER_ITEM_BLOCK,
                  { label: "Top 50" },
                ],
                [
                  PRODUCT_BY_CATEGORIES_SCROLLER_ITEM_BLOCK,
                  { label: "Protein" },
                ],
              ]}
              orientation="horizontal"
              templateLock={false}
              renderAppender={InnerBlocks.ButtonBlockAppender}
            />
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
        action,
        numberOfProduct,
        backgroundColor,
        titleFontSize,
        titleTextColor,
        subTitleFontSize,
        subTitleTextColor,
        buttonFontSize,
        buttonTextColor,
      } = attributes;
      const blockProps = useBlockProps.save({
        className: "appbuilder-products-by-categoris-scroller",
        "data-title": title ?? "",
        "data-subtitle": subTitle ?? "",
        "data-show-title": String(!!showTitle),
        "data-show-subtitle": String(!!showSubTitle),
        "data-show-button": String(!!showButton),
        "data-button-text": buttonText ?? "",
        "data-number-of-product": String(
          toNumber(numberOfProduct, DEFAULT_PRODUCTS),
        ),
        "data-background-color": backgroundColor || DEFAULT_BG,
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
        "data-action": JSON.stringify(action ?? {}),
        style: { background: backgroundColor || DEFAULT_BG },
      });
      return (
        <div {...blockProps}>
          {showTitle && title ? (
            <h3 className="appbuilder-products-by-categoris-scroller__title">
              {title}
            </h3>
          ) : null}
          {showSubTitle && subTitle ? (
            <p className="appbuilder-products-by-categoris-scroller__subtitle">
              {subTitle}
            </p>
          ) : null}
          {showButton && buttonText ? (
            <span className="appbuilder-products-by-categoris-scroller__button">
              {buttonText}
            </span>
          ) : null}
          <InnerBlocks.Content />
        </div>
      );
    },
  });
}

export function registerProductsByCategorisScroller() {
  registerProductsByCategorisScrollerItem();
  registerProductsByCategorisScrollerParent();
}
