// @ts-nocheck
import { registerBlockType, createBlock } from "gutenberg-block-kit/wp/blocks";
import {
  useBlockProps,
  InnerBlocks,
  InspectorControls,
  PanelColorSettings,
} from "gutenberg-block-kit/wp/block-editor";
import { Button, PanelBody, TextControl } from "gutenberg-block-kit/wp/components";
import { useDispatch, useSelect } from "gutenberg-block-kit/wp/data";
import { ActionBuilder } from "../../lib/gutenberg-actions";
import {
  ImagePicker,
  imageAttributesFromMedia,
  clearImageAttributes,
  EditorSectionLabel,
  ParentBlockBackButton,
  useChildBlocks,
  contentTabStyle,
} from "../inspector-shared";
import {
  MAIN_CATEGORIES_BLOCK,
  MAIN_CATEGORIES_ITEM_BLOCK,
  MAIN_SUB_CATEGORIES_ITEM_BLOCK,
  APPBUILDER_CATEGORY,
} from "../constants";

const DEFAULT_TITLE = "Blogs & Insights";
const DEFAULT_BG = "#ffffff";
const DEFAULT_TEXT = "#fff";
const DEFAULT_TITLE_SIZE = 12;

function toNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toCollectionRecord(item) {
  const collectionId = item?.id || item?.collectionId || "";
  if (!collectionId) return null;
  return {
    collectionId: String(collectionId),
    handle: item?.handle ? String(item.handle) : "",
    title: item?.title ? String(item.title) : "",
  };
}

function collectionLabel(collection, fallback) {
  const title = collection?.title || collection?.handle || "";
  return title || fallback;
}

function collectionsLabel(collections, fallback) {
  const titles = (Array.isArray(collections) ? collections : [])
    .map((item) => item?.title || item?.handle)
    .filter(Boolean);
  return titles.length ? titles.join(", ") : fallback;
}

function collectionsFromInnerBlocks(blocks) {
  return (Array.isArray(blocks) ? blocks : [])
    .map((block) => toCollectionRecord(block?.attributes?.collection))
    .filter(Boolean);
}

function mergeCollections(existing, picked) {
  const byId = new Map();
  [...existing, ...picked].forEach((item) => {
    const record = toCollectionRecord(item);
    if (!record) return;
    if (!byId.has(record.collectionId)) byId.set(record.collectionId, record);
  });
  return Array.from(byId.values());
}

function getResourcePicker() {
  return typeof window !== "undefined" ? window.shopify?.resourcePicker : null;
}

async function pickCollection() {
  const picker = getResourcePicker();
  if (!picker) return null;
  try {
    const selection = await picker({
      type: "collection",
      multiple: false,
      action: "select",
    });
    const first = Array.isArray(selection) ? selection[0] : selection;
    return toCollectionRecord(first);
  } catch (err) {
    console.error("ResourcePicker collection error:", err);
    return null;
  }
}

async function pickCollections() {
  const picker = getResourcePicker();
  if (!picker) return null;
  try {
    const selection = await picker({
      type: "collection",
      multiple: true,
      action: "select",
    });
    if (selection == null) return null;
    const items = Array.isArray(selection) ? selection : [selection];
    return items.map(toCollectionRecord).filter(Boolean);
  } catch (err) {
    console.error("ResourcePicker collections error:", err);
    return null;
  }
}

function CollectionPicker({ collection, onChange }) {
  const hasCollection = Boolean(collection?.collectionId);
  return (
    <div style={{ marginBottom: "12px" }}>
      <p style={{ fontSize: "12px", fontWeight: 600, margin: "0 0 6px" }}>
        Main collection
      </p>
      {hasCollection ? (
        <p style={{ fontSize: "13px", margin: "0 0 8px" }}>
          {collection.title || collection.handle || collection.collectionId}
        </p>
      ) : (
        <p style={{ fontSize: "13px", color: "#6d7175", margin: "0 0 8px" }}>
          No main collection selected
        </p>
      )}
      <Button
        variant="secondary"
        onClick={async () => {
          const next = await pickCollection();
          if (next) onChange(next);
        }}
      >
        {hasCollection ? "Change main collection" : "Select main collection"}
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

function CollectionsPicker({ collections, onChange }) {
  const list = Array.isArray(collections) ? collections : [];
  return (
    <div style={{ marginBottom: "12px" }}>
      <p style={{ fontSize: "12px", fontWeight: 600, margin: "0 0 6px" }}>
        Sub collections
      </p>
      {list.length > 0 ? (
        <ul style={{ margin: "0 0 8px", paddingLeft: "18px" }}>
          {list.map((item, index) => (
            <li
              key={item.collectionId || index}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "8px",
                fontSize: "13px",
                marginBottom: "4px",
              }}
            >
              <span>{item.title || item.handle || item.collectionId}</span>
              <Button
                variant="link"
                isDestructive
                onClick={() => onChange(list.filter((_, i) => i !== index))}
              >
                Remove
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <p style={{ fontSize: "13px", color: "#6d7175", margin: "0 0 8px" }}>
          No sub collections selected
        </p>
      )}
      <Button
        variant="secondary"
        onClick={async () => {
          const picked = await pickCollections();
          if (!picked || !picked.length) return;
          onChange(mergeCollections(list, picked));
        }}
      >
        {list.length ? "Add sub collections" : "Select sub collections"}
      </Button>
      {list.length ? (
        <Button
          variant="link"
          isDestructive
          onClick={() => onChange([])}
          style={{ marginLeft: "8px" }}
        >
          Clear all
        </Button>
      ) : null}
    </div>
  );
}

function listRowStyle(isSelected) {
  return {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "8px",
    width: "100%",
    marginBottom: "4px",
    padding: "8px 10px",
    border: isSelected ? "1px solid #3858e9" : "1px solid #e2e8f0",
    borderRadius: "6px",
    background: isSelected ? "#eef2ff" : "#f8fafc",
    textAlign: "left",
    cursor: "pointer",
  };
}

function CategoryTreeList({ clientId }) {
  const { selectBlock } = useDispatch("core/block-editor");
  const { insertBlock, removeBlock } = useChildBlocks(clientId);
  const { items, selectedId } = useSelect(
    (select) => {
      try {
        const editor = select("core/block-editor");
        return {
          items: editor?.getBlocks(clientId) || [],
          selectedId: editor?.getSelectedBlockClientId?.() || null,
        };
      } catch (err) {
        return { items: [], selectedId: null };
      }
    },
    [clientId],
  );

  return (
    <PanelBody title="Categories" initialOpen>
      {items.map((item, index) => {
        const title = collectionLabel(
          item.attributes?.collection,
          `Category ${index + 1}`,
        );
        const subs = Array.isArray(item.attributes?.collections)
          ? mergeCollections([], item.attributes.collections)
          : collectionsFromInnerBlocks(item.innerBlocks);
        const itemSelected = selectedId === item.clientId;
        return (
          <div key={item.clientId} style={{ marginBottom: "10px" }}>
            <div style={listRowStyle(itemSelected)}>
              <button
                type="button"
                onClick={() => selectBlock(item.clientId)}
                style={{
                  flex: 1,
                  border: 0,
                  background: "transparent",
                  padding: 0,
                  textAlign: "left",
                  cursor: "pointer",
                  fontWeight: 600,
                  fontSize: "13px",
                }}
              >
                {title}
              </button>
              <Button
                variant="link"
                isDestructive
                onClick={() => removeBlock(item.clientId)}
              >
                Remove
              </Button>
            </div>
            {subs.length ? (
              <p
                style={{
                  fontSize: "12px",
                  color: "#6d7175",
                  margin: "0 0 8px 12px",
                }}
              >
                {collectionsLabel(subs, "")}
              </p>
            ) : null}
          </div>
        );
      })}
      <Button
        variant="primary"
        onClick={() =>
          insertBlock(
            createBlock(MAIN_CATEGORIES_ITEM_BLOCK, {}),
            items.length,
            clientId,
          )
        }
        style={{ width: "100%", justifyContent: "center" }}
      >
        Add category
      </Button>
    </PanelBody>
  );
}

function registerMainSubCategoriesItem() {
  registerBlockType(MAIN_SUB_CATEGORIES_ITEM_BLOCK, {
    apiVersion: 3,
    title: "Main Sub Categories Item",
    category: APPBUILDER_CATEGORY,
    parent: [MAIN_CATEGORIES_ITEM_BLOCK],
    icon: "tag",
    supports: { html: false, reusable: false },
    __experimentalLabel: (attributes) =>
      collectionLabel(attributes?.collection, "Main Sub Categories Item"),
    attributes: {
      collection: { type: "object", default: {} },
    },
    edit: ({ attributes }) => {
      const { collection } = attributes;
      const blockProps = useBlockProps({
        className: "appbuilder-main-subcategories-item-editor",
      });
      return (
        <div {...blockProps}>
          <EditorSectionLabel
            name="Sub Category"
            detail={collectionLabel(collection, "")}
          />
        </div>
      );
    },
    save: ({ attributes }) => {
      const { collection } = attributes;
      const blockProps = useBlockProps.save({
        className: "appbuilder-main-categories__sub-item",
        "data-collection": JSON.stringify(collection ?? {}),
      });
      return <div {...blockProps} />;
    },
  });
}

function registerMainCategoriesItem() {
  registerBlockType(MAIN_CATEGORIES_ITEM_BLOCK, {
    apiVersion: 3,
    title: "Main Categories Item",
    category: APPBUILDER_CATEGORY,
    parent: [MAIN_CATEGORIES_BLOCK],
    icon: "category",
    supports: { html: false, reusable: false },
    __experimentalLabel: (attributes) =>
      collectionLabel(attributes?.collection, "Main Categories Item"),
    attributes: {
      collection: { type: "object", default: {} },
      collections: { type: "array" },
      imageUrl: { type: "string", default: "" },
      imageHeight: { type: "number", default: 0 },
      imageWidth: { type: "number", default: 0 },
      action: { type: "object", default: {} },
    },
    edit: ({ attributes, setAttributes, clientId }) => {
      const {
        collection,
        collections,
        imageUrl,
        imageHeight,
        imageWidth,
        action,
      } = attributes;
      const width = toNumber(imageWidth, 0);
      const height = toNumber(imageHeight, 0);
      const { childBlocks } = useChildBlocks(clientId);
      const fromInner = collectionsFromInnerBlocks(childBlocks);
      const subCollections = Array.isArray(collections)
        ? mergeCollections([], collections)
        : fromInner;
      const blockProps = useBlockProps({
        className: "appbuilder-main-categories-item-editor",
      });

      return (
        <>
          <InspectorControls group="content">
            <div style={contentTabStyle}>
              <ParentBlockBackButton clientId={clientId} />
              <PanelBody title="Category" initialOpen>
                <CollectionPicker
                  collection={collection ?? {}}
                  onChange={(next) => setAttributes({ collection: next ?? {} })}
                />
                <CollectionsPicker
                  collections={subCollections}
                  onChange={(next) =>
                    setAttributes({ collections: mergeCollections([], next) })
                  }
                />
                <ImagePicker
                  imageUrl={imageUrl}
                  onSelect={(media) =>
                    setAttributes(imageAttributesFromMedia(media))
                  }
                  onClear={() => setAttributes(clearImageAttributes())}
                />
              </PanelBody>
              <PanelBody title="Action" initialOpen={false}>
                <ActionBuilder
                  label="Action"
                  value={action ?? {}}
                  onChange={(next) => setAttributes({ action: next })}
                />
              </PanelBody>
            </div>
          </InspectorControls>
          <div {...blockProps}>
            <EditorSectionLabel
              name="Category"
              detail={collectionLabel(collection, "")}
            />
            {imageUrl ? (
              <img
                src={imageUrl}
                alt=""
                style={{
                  display: "block",
                  maxWidth: width > 0 ? `${width}px` : "80px",
                  height: height > 0 ? `${height}px` : "auto",
                  objectFit: "contain",
                  margin: "0 0 8px 8px",
                }}
              />
            ) : null}
            {subCollections.length ? (
              <p
                style={{
                  fontSize: "12px",
                  color: "#6d7175",
                  margin: "0 0 8px 8px",
                }}
              >
                {collectionsLabel(subCollections, "")}
              </p>
            ) : null}
            <InnerBlocks
              allowedBlocks={[MAIN_SUB_CATEGORIES_ITEM_BLOCK]}
              templateLock={false}
              renderAppender={false}
            />
          </div>
        </>
      );
    },
    save: ({ attributes }) => {
      const { collection, imageUrl, imageHeight, imageWidth, action } =
        attributes;
      const blockProps = useBlockProps.save({
        className: "appbuilder-main-categories__item",
        "data-collection": JSON.stringify(collection ?? {}),
        "data-image-url": imageUrl ?? "",
        "data-image-height": String(imageHeight ?? 0),
        "data-image-width": String(imageWidth ?? 0),
        "data-action": JSON.stringify(action ?? {}),
      });
      return (
        <div {...blockProps}>
          <InnerBlocks.Content />
        </div>
      );
    },
  });
}

function registerMainCategoriesParent() {
  registerBlockType(MAIN_CATEGORIES_BLOCK, {
    apiVersion: 3,
    title: "Main Categories",
    category: APPBUILDER_CATEGORY,
    icon: "category",
    supports: { html: false, align: ["wide", "full"] },
    __experimentalLabel: (attributes) =>
      attributes?.title || "Main Categories",
    attributes: {
      title: { type: "string", default: DEFAULT_TITLE },
      titleFontSize: { type: "number", default: DEFAULT_TITLE_SIZE },
      titleTextColor: { type: "string", default: DEFAULT_TEXT },
      backgroundColor: { type: "string", default: DEFAULT_BG },
    },
    edit: ({ attributes, setAttributes, clientId }) => {
      const { title, titleFontSize, titleTextColor, backgroundColor } =
        attributes;
      const titleSize = toNumber(titleFontSize, DEFAULT_TITLE_SIZE);
      const blockProps = useBlockProps({
        className: "appbuilder-main-categories-editor",
      });

      return (
        <>
          <InspectorControls group="content">
            <div style={contentTabStyle}>
              <CategoryTreeList clientId={clientId} />
              <PanelBody title="Main Categories" initialOpen={false}>
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
                    setAttributes({
                      titleFontSize: toNumber(value, DEFAULT_TITLE_SIZE),
                    })
                  }
                />
              </PanelBody>
            </div>
          </InspectorControls>
          <InspectorControls>
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
                  label: "Background Color",
                  value: backgroundColor || DEFAULT_BG,
                  onChange: (value) =>
                    setAttributes({ backgroundColor: value || DEFAULT_BG }),
                },
              ]}
            />
          </InspectorControls>
          <div {...blockProps}>
            <EditorSectionLabel name="Main Categories" detail={title} />
            <InnerBlocks
              allowedBlocks={[MAIN_CATEGORIES_ITEM_BLOCK]}
              template={[[MAIN_CATEGORIES_ITEM_BLOCK, {}]]}
              templateLock={false}
              renderAppender={false}
            />
          </div>
        </>
      );
    },
    save: ({ attributes }) => {
      const { title, titleFontSize, titleTextColor, backgroundColor } =
        attributes;
      const blockProps = useBlockProps.save({
        className: "appbuilder-main-categories",
        "data-title": title ?? "",
        "data-title-font-size": String(
          toNumber(titleFontSize, DEFAULT_TITLE_SIZE),
        ),
        "data-title-text-color": titleTextColor || DEFAULT_TEXT,
        "data-background-color": backgroundColor || DEFAULT_BG,
      });
      return (
        <div {...blockProps}>
          <InnerBlocks.Content />
        </div>
      );
    },
  });
}

export function registerMainCategories() {
  registerMainSubCategoriesItem();
  registerMainCategoriesItem();
  registerMainCategoriesParent();
}
