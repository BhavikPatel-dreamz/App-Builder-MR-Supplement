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
  Button,
  PanelBody,
  TextControl,
} from "gutenberg-block-kit/wp/components";
import { ActionBuilder } from "../../lib/gutenberg-actions";
import {
  DRAWER_BLOCK,
  DRAWER_ITEM_BLOCK,
  DRAWER_SECTION_BLOCK,
  DRAWER_SUB_SECTION_BLOCK,
  DRAWER_CARD_BLOCK,
  APPBUILDER_CATEGORY,
} from "../constants";

const DEFAULT_BACKGROUND_COLOR = "#0E1318";
const DEFAULT_TEXT_COLOR = "#FFFFFF";
const DEFAULT_DIVIDER_COLOR = "#30353A";
const DEFAULT_ICON_SIZE = 40;
const DEFAULT_FONT_SIZE = 28;

function MediaPicker({ label, value, onChange, allowVideo = false }) {
  return (
    <MediaUploadCheck>
      <MediaUpload
        onSelect={(media) => {
          const item = Array.isArray(media) ? media[0] : media;
          const nextUrl = item?.url || item?.source_url || "";
          onChange(nextUrl);
        }}
        allowedTypes={allowVideo ? ["image", "video"] : ["image"]}
        render={({ open }) => (
          <div style={{ marginBottom: "12px" }}>
            <p style={{ fontSize: "12px", fontWeight: 600, margin: "0 0 8px" }}>
              {label}
            </p>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                marginBottom: "8px",
              }}
            >
              {value ? (
                <img
                  src={value}
                  alt=""
                  style={{ width: "48px", height: "48px", objectFit: "cover", borderRadius: "4px" }}
                />
              ) : (
                <div
                  style={{
                    width: "48px",
                    height: "48px",
                    borderRadius: "4px",
                    background: "#f0f0f1",
                    border: "1px dashed #c3c4c7",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "10px",
                    color: "#50575e",
                  }}
                >
                  Image
                </div>
              )}
              <Button variant="secondary" onClick={open}>
                {value ? "Change" : "Select"}
              </Button>
              {value ? (
                <Button variant="link" isDestructive onClick={() => onChange("")}>
                  Remove
                </Button>
              ) : null}
            </div>
          </div>
        )}
      />
    </MediaUploadCheck>
  );
}

function registerDrawerCard() {
  registerBlockType(DRAWER_CARD_BLOCK, {
    apiVersion: 3,
    title: "Drawer Card",
    category: APPBUILDER_CATEGORY,
    parent: [DRAWER_SECTION_BLOCK, DRAWER_SUB_SECTION_BLOCK],
    icon: "format-image",
    supports: { html: false, reusable: false },
    attributes: {
      title: { type: "string", default: "" },
      imageUrl: { type: "string", default: "" },
      action: { type: "object", default: {} },
      showArrow: { type: "boolean", default: true },
    },
    edit: ({ attributes, setAttributes }) => {
      const { title, imageUrl, action, showArrow } = attributes;
      const blockProps = useBlockProps({
        className: "appbuilder-drawer-card-editor",
      });

      return (
        <>
          <InspectorControls>
            <PanelBody title="Card" initialOpen>
              <TextControl
                label="Title"
                value={title}
                onChange={(value) => setAttributes({ title: value })}
              />
              <MediaPicker
                label="Image"
                value={imageUrl}
                onChange={(value) => setAttributes({ imageUrl: value })}
              />
              <ActionBuilder
                label="Action"
                value={action ?? {}}
                onChange={(next) => setAttributes({ action: next })}
              />
            </PanelBody>
          </InspectorControls>

          <div {...blockProps}>
            {imageUrl ? <img src={imageUrl} alt="" style={{ width: "100%", height: "120px", objectFit: "cover", borderRadius: "8px" }} /> : null}
            <div style={{ fontSize: "14px", fontWeight: 600, marginTop: imageUrl ? "8px" : 0 }}>
              {title || "Drawer card"}
            </div>
            {showArrow ? <div style={{ marginTop: "8px", color: "#2CCF73", fontWeight: 700 }}>›</div> : null}
          </div>
        </>
      );
    },
    save: ({ attributes }) => {
      const { title, imageUrl, action, showArrow } = attributes;
      const blockProps = useBlockProps.save({
        className: "appbuilder-drawer__card",
        "data-title": title || "",
        "data-image-url": imageUrl || "",
        "data-show-arrow": showArrow ? "true" : "false",
        "data-action": JSON.stringify(action ?? {}),
      });

      return (
        <div {...blockProps}>
          {imageUrl ? <img src={imageUrl} alt="" className="appbuilder-drawer__card-image" /> : null}
          {title ? <span className="appbuilder-drawer__card-title">{title}</span> : null}
          {showArrow ? <span className="appbuilder-drawer__card-arrow" aria-hidden="true">›</span> : null}
        </div>
      );
    },
  });
}

function registerDrawerSubSection() {
  registerBlockType(DRAWER_SUB_SECTION_BLOCK, {
    apiVersion: 3,
    title: "Drawer Sub Section",
    category: APPBUILDER_CATEGORY,
    parent: [DRAWER_SECTION_BLOCK],
    icon: "list-view",
    supports: { html: false, reusable: false },
    attributes: {
      title: { type: "string", default: "" },
      iconUrl: { type: "string", default: "" },
      showArrow: { type: "boolean", default: true },
      buttonText: { type: "string", default: "" },
      action: { type: "object", default: {} },
    },
    edit: ({ attributes, setAttributes }) => {
      const { title, iconUrl, showArrow, buttonText, action } = attributes;
      const blockProps = useBlockProps({
        className: "appbuilder-drawer-sub-section-editor",
      });

      return (
        <>
          <InspectorControls>
            <PanelBody title="Sub section" initialOpen>
              <TextControl
                label="Title"
                value={title}
                onChange={(value) => setAttributes({ title: value })}
              />
              <MediaPicker
                label="Icon"
                value={iconUrl}
                onChange={(value) => setAttributes({ iconUrl: value })}
              />
              <TextControl
                label="Button text"
                value={buttonText}
                onChange={(value) => setAttributes({ buttonText: value })}
              />
              <ActionBuilder
                label="Action"
                value={action ?? {}}
                onChange={(next) => setAttributes({ action: next })}
              />
            </PanelBody>
          </InspectorControls>

          <div {...blockProps}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", fontWeight: 600 }}>
              {iconUrl ? <img src={iconUrl} alt="" style={{ width: "24px", height: "24px" }} /> : <span style={{ width: "24px", height: "24px", display: "inline-block", borderRadius: "4px", background: "#f0f0f1" }} />}
              <span>{title || "Sub section"}</span>
              {showArrow ? <span aria-hidden="true">›</span> : null}
            </div>
            {buttonText ? (
              <div className="appbuilder-drawer__sub-section-button-preview">
                {buttonText}
              </div>
            ) : null}
            <div style={{ marginTop: "10px" }}>
              <InnerBlocks
                allowedBlocks={[DRAWER_CARD_BLOCK]}
                template={[[DRAWER_CARD_BLOCK, { title: "New card" }], [DRAWER_CARD_BLOCK, { title: "Add another" }]]}
                templateLock={false}
                renderAppender={InnerBlocks.ButtonBlockAppender}
              />
            </div>
            <div style={{ marginTop: "8px" }}>
              <InnerBlocks.ButtonBlockAppender />
            </div>
          </div>
        </>
      );
    },
    save: ({ attributes }) => {
      const { title, iconUrl, showArrow, buttonText, action } = attributes;
      const blockProps = useBlockProps.save({
        className: "appbuilder-drawer__sub-section",
        "data-title": title || "",
        "data-icon-url": iconUrl || "",
        "data-show-arrow": showArrow ? "true" : "false",
        "data-button-text": buttonText || "",
        "data-action": JSON.stringify(action ?? {}),
      });

      return (
        <div {...blockProps}>
          {iconUrl ? <img src={iconUrl} alt="" className="appbuilder-drawer__icon" /> : null}
          {title ? <span className="appbuilder-drawer__label">{title}</span> : null}
          {showArrow ? <span className="appbuilder-drawer__arrow" aria-hidden="true">›</span> : null}
          {buttonText ? (
            <span className="appbuilder-drawer__sub-section-button">{buttonText}</span>
          ) : null}
          <div className="appbuilder-drawer__sub-section-items">
            <InnerBlocks.Content />
          </div>
        </div>
      );
    },
  });
}

function registerDrawerSection() {
  registerBlockType(DRAWER_SECTION_BLOCK, {
    apiVersion: 3,
    title: "Drawer Section",
    category: APPBUILDER_CATEGORY,
    parent: [DRAWER_BLOCK],
    icon: "grid-view",
    supports: { html: false, reusable: false },
    attributes: {
      title: { type: "string", default: "" },
      iconUrl: { type: "string", default: "" },
      viewAllText: { type: "string", default: "VIEW ALL" },
      action: { type: "object", default: {} },
    },
    edit: ({ attributes, setAttributes }) => {
      const { title, iconUrl, viewAllText, action } = attributes;
      const blockProps = useBlockProps({
        className: "appbuilder-drawer-section-editor",
      });

      return (
        <>
          <InspectorControls>
            <PanelBody title="Section" initialOpen>
              <TextControl
                label="Title"
                value={title}
                onChange={(value) => setAttributes({ title: value })}
              />
              <MediaPicker
                label="Icon"
                value={iconUrl}
                onChange={(value) => setAttributes({ iconUrl: value })}
              />
              <TextControl
                label="View all label"
                value={viewAllText}
                onChange={(value) => setAttributes({ viewAllText: value })}
              />
              <ActionBuilder
                label="Action"
                value={action ?? {}}
                onChange={(next) => setAttributes({ action: next })}
              />
            </PanelBody>
          </InspectorControls>

          <div {...blockProps}>
            <div style={{ display: "flex", alignItems: "center", marginBottom: "10px", fontWeight: 700 }}>
              {iconUrl ? <img src={iconUrl} alt="" style={{ width: "20px", height: "20px", marginRight: "8px" }} /> : null}
              <span>{title || "Section"}</span>
            </div>
            <div style={{ fontSize: "12px", letterSpacing: "0.08em", textTransform: "uppercase", opacity: 0.7 }}>
              {viewAllText || "VIEW ALL"}
            </div>
            <div style={{ marginTop: "12px" }}>
              <InnerBlocks
                allowedBlocks={[DRAWER_SUB_SECTION_BLOCK, DRAWER_CARD_BLOCK]}
                template={[[DRAWER_SUB_SECTION_BLOCK, { title: "Protein", showArrow: true }]]}
                templateLock={false}
                renderAppender={InnerBlocks.ButtonBlockAppender}
              />
            </div>
            <div style={{ marginTop: "8px" }}>
              <InnerBlocks.ButtonBlockAppender />
            </div>
          </div>
        </>
      );
    },
    save: ({ attributes }) => {
      const { title, iconUrl, viewAllText, action } = attributes;
      const blockProps = useBlockProps.save({
        className: "appbuilder-drawer__section",
        "data-title": title || "",
        "data-icon-url": iconUrl || "",
        "data-view-all-text": viewAllText || "",
        "data-action": JSON.stringify(action ?? {}),
      });

      return (
        <div {...blockProps}>
          {iconUrl ? <img src={iconUrl} alt="" className="appbuilder-drawer__icon" /> : null}
          {title ? <span className="appbuilder-drawer__label">{title}</span> : null}
          {viewAllText ? <span className="appbuilder-drawer__view-all">{viewAllText}</span> : null}
          <div className="appbuilder-drawer__section-items">
            <InnerBlocks.Content />
          </div>
        </div>
      );
    },
  });
}

function registerDrawerItem() {
  registerBlockType(DRAWER_ITEM_BLOCK, {
    apiVersion: 3,
    title: "Drawer Item",
    category: APPBUILDER_CATEGORY,
    parent: [DRAWER_BLOCK],
    icon: "menu",
    supports: { html: false, reusable: false },
    attributes: {
      title: { type: "string", default: "" },
      iconUrl: { type: "string", default: "" },
      iconType: { type: "string", default: "image" },
      action: { type: "object", default: {} },
    },
    edit: ({ attributes, setAttributes }) => {
      const { title, iconUrl, iconType, action } = attributes;
      const blockProps = useBlockProps({
        className: "appbuilder-drawer-item-editor",
      });

      return (
        <>
          <InspectorControls>
            <PanelBody title="Item" initialOpen>
              <TextControl label="Title" value={title} onChange={(value) => setAttributes({ title: value })} />
              <MediaPicker label="Icon" value={iconUrl} onChange={(value) => setAttributes({ iconUrl: value })} />
              <TextControl label="Icon type" value={iconType} onChange={(value) => setAttributes({ iconType: value || "image" })} />
              <ActionBuilder
                label="Action"
                value={action ?? {}}
                onChange={(next) => setAttributes({ action: next })}
              />
            </PanelBody>
          </InspectorControls>

          <div {...blockProps}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", fontWeight: 600 }}>
              {iconUrl ? <img src={iconUrl} alt="" style={{ width: "24px", height: "24px" }} /> : <span style={{ width: "24px", height: "24px", display: "inline-block", borderRadius: "4px", background: "#f0f0f1" }} />}
              <span>{title || "Drawer item"}</span>
            </div>
          </div>
        </>
      );
    },
    save: ({ attributes }) => {
      const { title, iconUrl, iconType, action } = attributes;
      const blockProps = useBlockProps.save({
        className: "appbuilder-drawer__item",
        "data-title": title || "",
        "data-icon-url": iconUrl || "",
        "data-icon-type": iconType || "image",
        "data-action": JSON.stringify(action ?? {}),
      });

      return (
        <div {...blockProps}>
          {iconUrl ? <img src={iconUrl} alt="" className="appbuilder-drawer__icon" /> : null}
          {title ? <span className="appbuilder-drawer__label">{title}</span> : null}
        </div>
      );
    },
  });
}

function registerDrawerParent() {
  registerBlockType(DRAWER_BLOCK, {
    apiVersion: 3,
    title: "Drawer Menu",
    description: "Mobile drawer navigation with categories, brands, and goals.",
    category: APPBUILDER_CATEGORY,
    icon: "menu",
    keywords: ["drawer", "menu", "navigation"],
    supports: { html: false, align: ["wide", "full"] },
    attributes: {
      backgroundColor: { type: "string", default: DEFAULT_BACKGROUND_COLOR },
      textColor: { type: "string", default: DEFAULT_TEXT_COLOR },
      dividerColor: { type: "string", default: DEFAULT_DIVIDER_COLOR },
      iconSize: { type: "number", default: DEFAULT_ICON_SIZE },
      fontSize: { type: "number", default: DEFAULT_FONT_SIZE },
    },
    edit: ({ attributes, setAttributes }) => {
      const { backgroundColor, textColor, dividerColor, iconSize, fontSize } = attributes;
      const blockProps = useBlockProps({
        className: "appbuilder-drawer-editor",
        style: {
          backgroundColor: backgroundColor || DEFAULT_BACKGROUND_COLOR,
          color: textColor || DEFAULT_TEXT_COLOR,
        },
      });

      return (
        <>
          <InspectorControls>
            <PanelBody title="Drawer style" initialOpen>
              <TextControl
                label="Icon size"
                type="number"
                value={iconSize}
                onChange={(value) => setAttributes({ iconSize: Number(value) || DEFAULT_ICON_SIZE })}
              />
              <TextControl
                label="Font size"
                type="number"
                value={fontSize}
                onChange={(value) => setAttributes({ fontSize: Number(value) || DEFAULT_FONT_SIZE })}
              />
            </PanelBody>
          </InspectorControls>
          <InspectorControls>
            <PanelColorSettings
              title="Colors"
              colorSettings={[
                {
                  label: "Background color",
                  value: backgroundColor || DEFAULT_BACKGROUND_COLOR,
                  onChange: (value) => setAttributes({ backgroundColor: value || DEFAULT_BACKGROUND_COLOR }),
                },
                {
                  label: "Text color",
                  value: textColor || DEFAULT_TEXT_COLOR,
                  onChange: (value) => setAttributes({ textColor: value || DEFAULT_TEXT_COLOR }),
                },
                {
                  label: "Divider color",
                  value: dividerColor || DEFAULT_DIVIDER_COLOR,
                  onChange: (value) => setAttributes({ dividerColor: value || DEFAULT_DIVIDER_COLOR }),
                },
              ]}
            />
          </InspectorControls>

          <div {...blockProps}>
            <InnerBlocks
              allowedBlocks={[DRAWER_ITEM_BLOCK, DRAWER_SECTION_BLOCK]}
              template={[[DRAWER_ITEM_BLOCK, { title: "BEST SELLERS" }], [DRAWER_SECTION_BLOCK, { title: "CATEGORIES" }]]}
              templateLock={false}
              renderAppender={InnerBlocks.ButtonBlockAppender}
            />
            <div style={{ marginTop: "8px" }}>
              <InnerBlocks.ButtonBlockAppender />
            </div>
          </div>
        </>
      );
    },
    save: ({ attributes }) => {
      const { backgroundColor, textColor, dividerColor, iconSize, fontSize } = attributes;
      const blockProps = useBlockProps.save({
        className: "appbuilder-drawer",
        "data-background-color": backgroundColor || DEFAULT_BACKGROUND_COLOR,
        "data-text-color": textColor || DEFAULT_TEXT_COLOR,
        "data-divider-color": dividerColor || DEFAULT_DIVIDER_COLOR,
        "data-icon-size": String(iconSize || DEFAULT_ICON_SIZE),
        "data-font-size": String(fontSize || DEFAULT_FONT_SIZE),
        style: {
          backgroundColor: backgroundColor || DEFAULT_BACKGROUND_COLOR,
          color: textColor || DEFAULT_TEXT_COLOR,
          "--appbuilder-divider-color": dividerColor || DEFAULT_DIVIDER_COLOR,
          "--appbuilder-icon-size": `${iconSize || DEFAULT_ICON_SIZE}px`,
          "--appbuilder-font-size": `${fontSize || DEFAULT_FONT_SIZE}px`,
        },
      });

      return (
        <div {...blockProps}>
          <InnerBlocks.Content />
        </div>
      );
    },
  });
}

export function registerDrawer() {
  registerDrawerCard();
  registerDrawerSubSection();
  registerDrawerSection();
  registerDrawerItem();
  registerDrawerParent();
}
