// @ts-nocheck
import { registerBlockType } from "gutenberg-block-kit/wp/blocks";
import {
  useBlockProps,
  InnerBlocks,
  InspectorControls,
  PanelColorSettings,
} from "gutenberg-block-kit/wp/block-editor";
import { PanelBody, TextControl } from "gutenberg-block-kit/wp/components";
import { ActionBuilder } from "../../lib/gutenberg-actions";
import {
  ImagePicker,
  imageAttributesFromMedia,
  clearImageAttributes,
  EditorSectionLabel,
} from "../inspector-shared";
import {
  MAIN_BRANDS_BLOCK,
  MAIN_BRANDS_ITEM_BLOCK,
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

function registerMainBrandsItem() {
  registerBlockType(MAIN_BRANDS_ITEM_BLOCK, {
    apiVersion: 3,
    title: "Main Brands Item",
    category: APPBUILDER_CATEGORY,
    parent: [MAIN_BRANDS_BLOCK],
    icon: "format-image",
    supports: { html: false, reusable: false },
    __experimentalLabel: () => "Main Brands Item",
    attributes: {
      imageUrl: { type: "string", default: "" },
      imageHeight: { type: "number", default: 0 },
      imageWidth: { type: "number", default: 0 },
      action: { type: "object", default: {} },
    },
    edit: ({ attributes, setAttributes }) => {
      const { imageUrl, imageHeight, imageWidth, action } = attributes;
      const width = toNumber(imageWidth, 0);
      const height = toNumber(imageHeight, 0);
      const blockProps = useBlockProps({
        className: "appbuilder-main-brands-item-editor",
        style: { minHeight: "8px" },
      });

      return (
        <>
          <InspectorControls>
            <PanelBody title="Brand" initialOpen>
              <ImagePicker
                imageUrl={imageUrl}
                onSelect={(media) =>
                  setAttributes(imageAttributesFromMedia(media))
                }
                onClear={() => setAttributes(clearImageAttributes())}
              />
              <TextControl
                label="Image Width"
                type="number"
                min={0}
                value={width}
                onChange={(value) =>
                  setAttributes({ imageWidth: toNumber(value, 0) })
                }
              />
              <TextControl
                label="Image Height"
                type="number"
                min={0}
                value={height}
                onChange={(value) =>
                  setAttributes({ imageHeight: toNumber(value, 0) })
                }
              />
              <ActionBuilder
                label="Action"
                value={action ?? {}}
                onChange={(next) => setAttributes({ action: next })}
              />
            </PanelBody>
          </InspectorControls>
          <div {...blockProps}>
            {imageUrl ? (
              <img
                src={imageUrl}
                alt=""
                style={{
                  display: "block",
                  maxWidth: width > 0 ? `${width}px` : "120px",
                  height: height > 0 ? `${height}px` : "auto",
                  objectFit: "contain",
                }}
              />
            ) : (
              <EditorSectionLabel name="Main Brands Item" />
            )}
          </div>
        </>
      );
    },
    save: ({ attributes }) => {
      const { imageUrl, imageHeight, imageWidth, action } = attributes;
      const blockProps = useBlockProps.save({
        className: "appbuilder-main-brands__item",
        "data-image-url": imageUrl ?? "",
        "data-image-height": String(imageHeight ?? 0),
        "data-image-width": String(imageWidth ?? 0),
        "data-action": JSON.stringify(action ?? {}),
      });
      return <div {...blockProps} />;
    },
  });
}

function registerMainBrandsParent() {
  registerBlockType(MAIN_BRANDS_BLOCK, {
    apiVersion: 3,
    title: "Main Brands",
    category: APPBUILDER_CATEGORY,
    icon: "slides",
    supports: { html: false, align: ["wide", "full"] },
    __experimentalLabel: (attributes) => attributes?.title || "Main Brands",
    attributes: {
      title: { type: "string", default: DEFAULT_TITLE },
      titleFontSize: { type: "number", default: DEFAULT_TITLE_SIZE },
      titleTextColor: { type: "string", default: DEFAULT_TEXT },
      backgroundColor: { type: "string", default: DEFAULT_BG },
    },
    edit: ({ attributes, setAttributes }) => {
      const { title, titleFontSize, titleTextColor, backgroundColor } =
        attributes;
      const titleSize = toNumber(titleFontSize, DEFAULT_TITLE_SIZE);
      const blockProps = useBlockProps({
        className: "appbuilder-main-brands-editor",
        style: { minHeight: "8px" },
      });

      return (
        <>
          <InspectorControls>
            <PanelBody title="Main Brands" initialOpen>
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
            <EditorSectionLabel name="Main Brands" detail={title} />
            <InnerBlocks
              allowedBlocks={[MAIN_BRANDS_ITEM_BLOCK]}
              template={[
                [MAIN_BRANDS_ITEM_BLOCK, {}],
                [MAIN_BRANDS_ITEM_BLOCK, {}],
              ]}
              templateLock={false}
              renderAppender={InnerBlocks.ButtonBlockAppender}
            />
          </div>
        </>
      );
    },
    save: ({ attributes }) => {
      const { title, titleFontSize, titleTextColor, backgroundColor } =
        attributes;
      const blockProps = useBlockProps.save({
        className: "appbuilder-main-brands",
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

export function registerMainBrands() {
  registerMainBrandsItem();
  registerMainBrandsParent();
}
