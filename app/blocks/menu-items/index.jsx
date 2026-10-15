// @ts-nocheck
// Drawer Menu — parent (core/menu-items) + menu row (core/menu-item) +
// nested sub row (core/menu-sub-item).
import { registerBlockType, createBlock } from 'gutenberg-block-kit/wp/blocks';
import {
  useBlockProps,
  InnerBlocks,
  InspectorControls,
  MediaUpload,
  MediaUploadCheck,
} from 'gutenberg-block-kit/wp/block-editor';
import { PanelBody, TextControl, Button } from 'gutenberg-block-kit/wp/components';
import { ActionBuilder } from '../../lib/gutenberg-actions';
import {
  ColorSettingsPanel,
  contentTabStyle,
  ImagePicker,
  getImageUrl,
  useChildBlocks,
} from '../inspector-shared';
import {
  MENU_ITEMS_BLOCK,
  MENU_ITEM_BLOCK,
  MENU_SUB_ITEM_BLOCK,
  APPBUILDER_CATEGORY,
} from '../constants';

const DEFAULT_BACKGROUND_COLOR = '#FFFFFF';

function IconField({ icon, onChange, onClear }) {
  return (
    <ImagePicker
      imageUrl={icon}
      onSelect={(media) => onChange(getImageUrl(media))}
      onClear={onClear}
      addLabel="Add icon"
      changeLabel="Change icon"
    />
  );
}

function MenuRowPreview({ icon, label, onIconOpen, onLabelChange, className, placeholder }) {
  return (
    <div className={className}>
      {icon ? (
        <img
          src={icon}
          alt=""
          className="appbuilder-menu-items__icon"
          onClick={onIconOpen}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') onIconOpen?.();
          }}
          role={onIconOpen ? 'button' : undefined}
          tabIndex={onIconOpen ? 0 : undefined}
        />
      ) : onIconOpen ? (
        <button type="button" className="appbuilder-menu-items__icon-btn" onClick={onIconOpen}>
          Icon
        </button>
      ) : (
        <span className="appbuilder-menu-items__icon-placeholder" aria-hidden="true" />
      )}
      <input
        type="text"
        className="appbuilder-menu-items__label-input"
        value={label}
        placeholder={placeholder}
        onChange={(event) => onLabelChange(event.target.value)}
      />
    </div>
  );
}

function MenuItemInspector({ icon, label, action, setAttributes, title }) {
  return (
    <PanelBody title={title} initialOpen={true}>
      <IconField
        icon={icon}
        onChange={(url) => setAttributes({ icon: url })}
        onClear={() => setAttributes({ icon: '' })}
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
  );
}

// ---------------------------------------------------------------------------
// Child: core/menu-sub-item — nested under a menu item
// ---------------------------------------------------------------------------
function registerMenuSubItem() {
  registerBlockType(MENU_SUB_ITEM_BLOCK, {
    apiVersion: 3,
    title: 'Menu Sub Item',
    description: 'A nested drawer menu row with icon, label and action.',
    category: APPBUILDER_CATEGORY,
    parent: [MENU_ITEM_BLOCK],
    icon: 'minus',
    supports: { html: false, reusable: false },
    attributes: {
      icon: { type: 'string', default: '' },
      label: { type: 'string', default: '' },
      action: { type: 'object', default: {} },
    },

    edit: ({ attributes, setAttributes }) => {
      const { icon, label, action } = attributes;
      const blockProps = useBlockProps({
        className: 'appbuilder-menu-items-sub-item-editor',
      });

      return (
        <>
          <InspectorControls group="content">
            <div style={contentTabStyle}>
              <MenuItemInspector
                icon={icon}
                label={label}
                action={action}
                setAttributes={setAttributes}
                title="Sub Item"
              />
            </div>
          </InspectorControls>

          <div {...blockProps}>
            <MediaUploadCheck>
              <MediaUpload
                onSelect={(media) => setAttributes({ icon: getImageUrl(media) })}
                allowedTypes={['image']}
                render={({ open }) => (
                  <MenuRowPreview
                    icon={icon}
                    label={label}
                    onIconOpen={open}
                    onLabelChange={(value) => setAttributes({ label: value })}
                    className="appbuilder-menu-items__sub-item"
                    placeholder="Sub item label…"
                  />
                )}
              />
            </MediaUploadCheck>
          </div>
        </>
      );
    },

    save: ({ attributes }) => {
      const { icon, label, action } = attributes;
      const blockProps = useBlockProps.save({
        className: 'appbuilder-menu-items__sub-item',
        'data-icon': icon || '',
        'data-action': JSON.stringify(action ?? {}),
      });

      return (
        <div {...blockProps}>
          {icon ? <img src={icon} alt="" className="appbuilder-menu-items__icon" /> : null}
          {label ? <span className="appbuilder-menu-items__label">{label}</span> : null}
        </div>
      );
    },
  });
}

// ---------------------------------------------------------------------------
// Child: core/menu-item — top-level drawer row; may contain sub items
// ---------------------------------------------------------------------------
function registerMenuItem() {
  registerBlockType(MENU_ITEM_BLOCK, {
    apiVersion: 3,
    title: 'Menu Item',
    description: 'A drawer menu row with icon, label, action and optional sub items.',
    category: APPBUILDER_CATEGORY,
    parent: [MENU_ITEMS_BLOCK],
    icon: 'menu',
    supports: { html: false, reusable: false },
    attributes: {
      icon: { type: 'string', default: '' },
      label: { type: 'string', default: '' },
      action: { type: 'object', default: {} },
    },

    edit: ({ attributes, setAttributes }) => {
      const { icon, label, action } = attributes;
      const blockProps = useBlockProps({
        className: 'appbuilder-menu-items-item-editor',
      });

      return (
        <>
          <InspectorControls group="content">
            <div style={contentTabStyle}>
              <MenuItemInspector
                icon={icon}
                label={label}
                action={action}
                setAttributes={setAttributes}
                title="Menu Item"
              />
            </div>
          </InspectorControls>

          <div {...blockProps}>
            <MediaUploadCheck>
              <MediaUpload
                onSelect={(media) => setAttributes({ icon: getImageUrl(media) })}
                allowedTypes={['image']}
                render={({ open }) => (
                  <MenuRowPreview
                    icon={icon}
                    label={label}
                    onIconOpen={open}
                    onLabelChange={(value) => setAttributes({ label: value })}
                    className="appbuilder-menu-items__item"
                    placeholder="Menu label…"
                  />
                )}
              />
            </MediaUploadCheck>

            <div className="appbuilder-menu-items__sub-list">
              <InnerBlocks
                allowedBlocks={[MENU_SUB_ITEM_BLOCK]}
                template={[]}
                templateLock={false}
                renderAppender={InnerBlocks.ButtonBlockAppender}
              />
            </div>
          </div>
        </>
      );
    },

    save: ({ attributes }) => {
      const { icon, label, action } = attributes;
      const blockProps = useBlockProps.save({
        className: 'appbuilder-menu-items__item',
        'data-icon': icon || '',
        'data-action': JSON.stringify(action ?? {}),
      });

      return (
        <div {...blockProps}>
          {icon ? <img src={icon} alt="" className="appbuilder-menu-items__icon" /> : null}
          {label ? <span className="appbuilder-menu-items__label">{label}</span> : null}
          <div className="appbuilder-menu-items__sub-list">
            <InnerBlocks.Content />
          </div>
        </div>
      );
    },
  });
}

// ---------------------------------------------------------------------------
// Parent: core/menu-items — drawer menu container
// ---------------------------------------------------------------------------
function registerMenuItemsParent() {
  registerBlockType(MENU_ITEMS_BLOCK, {
    apiVersion: 3,
    title: 'Drawer Menu',
    description: 'Mobile drawer navigation with icons, labels and nested sub items.',
    category: APPBUILDER_CATEGORY,
    icon: 'menu',
    keywords: ['menu', 'drawer', 'navigation', 'nav'],
    supports: { html: false, align: ['wide', 'full'] },
    attributes: {
      backgroundColor: { type: 'string', default: DEFAULT_BACKGROUND_COLOR },
    },

    edit: ({ attributes, setAttributes, clientId }) => {
      const { backgroundColor } = attributes;
      const blockProps = useBlockProps({
        className: 'appbuilder-menu-items-editor',
        style: { backgroundColor: backgroundColor || DEFAULT_BACKGROUND_COLOR },
      });
      const { childBlocks, childCount, insertBlock, removeBlock, updateBlockAttributes } =
        useChildBlocks(clientId);

      return (
        <>
          <InspectorControls group="content">
            <div style={contentTabStyle}>
              {childBlocks.map((block, index) => {
                const { icon, label, action } = block.attributes;
                return (
                  <PanelBody
                    key={block.clientId}
                    title={label ? `Item: ${label}` : `Menu item ${index + 1}`}
                    initialOpen={false}
                  >
                    <IconField
                      icon={icon}
                      onChange={(url) => updateBlockAttributes(block.clientId, { icon: url })}
                      onClear={() => updateBlockAttributes(block.clientId, { icon: '' })}
                    />
                    <TextControl
                      label="Label"
                      value={label}
                      onChange={(value) =>
                        updateBlockAttributes(block.clientId, { label: value })
                      }
                    />
                    <ActionBuilder
                      label="Action"
                      value={action ?? {}}
                      onChange={(next) =>
                        updateBlockAttributes(block.clientId, { action: next })
                      }
                    />
                    {childCount > 1 ? (
                      <Button
                        onClick={() => removeBlock(block.clientId)}
                        variant="link"
                        isDestructive
                        style={{ marginTop: '8px' }}
                      >
                        Remove item
                      </Button>
                    ) : null}
                  </PanelBody>
                );
              })}
              <Button
                variant="primary"
                onClick={() =>
                  insertBlock(createBlock(MENU_ITEM_BLOCK, {}), childCount, clientId)
                }
                style={{ width: '100%', justifyContent: 'center', marginTop: '8px' }}
              >
                Add menu item
              </Button>
            </div>
          </InspectorControls>

          <InspectorControls>
            <ColorSettingsPanel
              title="Colors"
              colorSettings={[
                {
                  label: 'Background color',
                  value: backgroundColor || DEFAULT_BACKGROUND_COLOR,
                  onChange: (value) => {
                    if (value === undefined || value === null || value === '') {
                      return;
                    }
                    setAttributes({
                      backgroundColor: value,
                    });
                  },
                },
              ]}
            />
          </InspectorControls>

          <div {...blockProps}>
            <div className="appbuilder-menu-items">
              <InnerBlocks
                allowedBlocks={[MENU_ITEM_BLOCK]}
                template={[
                  [MENU_ITEM_BLOCK, {}],
                  [MENU_ITEM_BLOCK, {}],
                  [MENU_ITEM_BLOCK, {}],
                ]}
                templateLock={false}
                renderAppender={InnerBlocks.ButtonBlockAppender}
              />
            </div>
          </div>
        </>
      );
    },

    save: ({ attributes }) => {
      const { backgroundColor } = attributes;
      const blockProps = useBlockProps.save({
        className: 'appbuilder-menu-items',
        'data-background-color': backgroundColor || DEFAULT_BACKGROUND_COLOR,
        style: { backgroundColor: backgroundColor || DEFAULT_BACKGROUND_COLOR },
      });

      return (
        <div {...blockProps}>
          <InnerBlocks.Content />
        </div>
      );
    },
  });
}

export function registerMenuItems() {
  registerMenuSubItem();
  registerMenuItem();
  registerMenuItemsParent();
}
