// @ts-nocheck
// Categories Scroller — parent (core/categories-scroller) + child item
// (core/categories-scroller-item) using InnerBlocks.
import { useState } from 'gutenberg-block-kit/wp/element';
import { registerBlockType, createBlock } from 'gutenberg-block-kit/wp/blocks';
import {
  useBlockProps,
  InnerBlocks,
  InspectorControls,
  PanelColorSettings,
  MediaUpload,
  MediaUploadCheck,
} from 'gutenberg-block-kit/wp/block-editor';
import { PanelBody, TextControl, Button } from 'gutenberg-block-kit/wp/components';
import { ActionBuilder } from 'gutenberg-block-kit/actions';
import {
  contentTabStyle,
  ImagePicker,
  imageAttributesFromMedia,
  clearImageAttributes,
  useChildBlocks,
  useSliderPagination,
  SliderPaginationDots,
} from '../inspector-shared';
import {
  CATEGORIES_SCROLLER_BLOCK,
  CATEGORIES_SCROLLER_ITEM_BLOCK,
  RIYASAT_CATEGORY,
} from '../constants';

const DEFAULT_BACKGROUND = '#f5f5f5';

function CategoriesScrollerIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width="24"
      height="24"
      aria-hidden="true"
      focusable="false"
    >
      <path
        fill="currentColor"
        d="M4 4h7v7H4V4zm9 0h7v7h-7V4zM4 13h7v7H4v-7zm9 0h7v7h-7v-7z"
      />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Child: core/categories-scroller-item
// ---------------------------------------------------------------------------
function registerCategoriesScrollerItem() {
  registerBlockType(CATEGORIES_SCROLLER_ITEM_BLOCK, {
    apiVersion: 3,
    title: 'Category Item',
    description: 'A category tile with image, label and optional tap action.',
    category: RIYASAT_CATEGORY,
    parent: [CATEGORIES_SCROLLER_BLOCK],
    icon: 'category',
    supports: { html: false, reusable: false },
    attributes: {
      imageUrl: { type: 'string', default: '' },
      imageWidth: { type: 'number', default: 0 },
      imageHeight: { type: 'number', default: 0 },
      label: { type: 'string', default: '' },
      action: { type: 'object', default: {} },
    },

    edit: ({ attributes, setAttributes }) => {
      const { imageUrl, label, action: rawAction } = attributes;
      const action = rawAction ?? {};
      const blockProps = useBlockProps({
        className: 'riyasat-categories-scroller-item-editor',
      });

      return (
        <>
          <InspectorControls group="content">
            <div style={contentTabStyle}>
              <PanelBody title="Category" initialOpen={true}>
                <ImagePicker
                  imageUrl={imageUrl}
                  onSelect={(media) => setAttributes(imageAttributesFromMedia(media))}
                  onClear={() => setAttributes(clearImageAttributes())}
                />
                <TextControl
                  label="Label"
                  value={label}
                  onChange={(value) => setAttributes({ label: value })}
                />
                <ActionBuilder
                  label="Tap action"
                  value={action}
                  onChange={(next) => setAttributes({ action: next })}
                />
              </PanelBody>
            </div>
          </InspectorControls>

          <div {...blockProps}>
            {imageUrl ? (
              <MediaUploadCheck>
                <MediaUpload
                  onSelect={(media) => setAttributes(imageAttributesFromMedia(media))}
                  allowedTypes={['image']}
                  render={({ open }) => (
                    <img
                      src={imageUrl}
                      alt=""
                      className="riyasat-categories-scroller-item-editor__image"
                      onClick={open}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') open();
                      }}
                      role="button"
                      tabIndex={0}
                    />
                  )}
                />
              </MediaUploadCheck>
            ) : (
              <MediaUploadCheck>
                <MediaUpload
                  onSelect={(media) => setAttributes(imageAttributesFromMedia(media))}
                  allowedTypes={['image']}
                  render={({ open }) => (
                    <button
                      type="button"
                      className="riyasat-categories-scroller-item-editor__image-btn"
                      onClick={open}
                    >
                      Add image
                    </button>
                  )}
                />
              </MediaUploadCheck>
            )}
            <input
              type="text"
              className="riyasat-categories-scroller-item-editor__label"
              value={label}
              placeholder="Label…"
              onChange={(event) => setAttributes({ label: event.target.value })}
            />
          </div>
        </>
      );
    },

    save: ({ attributes }) => {
      const { imageUrl, label, action } = attributes;
      const blockProps = useBlockProps.save({
        className: 'riyasat-categories-scroller__item',
        'data-action': JSON.stringify(action ?? {}),
      });
      return (
        <div {...blockProps}>
          {imageUrl ? (
            <img
              src={imageUrl}
              alt=""
              className="riyasat-categories-scroller__image"
            />
          ) : null}
          {label ? (
            <span className="riyasat-categories-scroller__label">{label}</span>
          ) : null}
        </div>
      );
    },
  });
}

// ---------------------------------------------------------------------------
// Parent: core/categories-scroller
// ---------------------------------------------------------------------------
function registerCategoriesScrollerParent() {
  registerBlockType(CATEGORIES_SCROLLER_BLOCK, {
    apiVersion: 3,
    title: 'Categories Scroller',
    description: 'Horizontally scrolling category tiles with image and label.',
    category: RIYASAT_CATEGORY,
    icon: CategoriesScrollerIcon,
    keywords: ['categories', 'scroller', 'shop', 'collection'],
    supports: { html: false, align: ['wide', 'full'] },
    attributes: {
      backgroundColor: { type: 'string', default: DEFAULT_BACKGROUND },
      action: { type: 'object', default: {} },
    },

    edit: ({ attributes, setAttributes, clientId }) => {
      const { backgroundColor, action } = attributes;
      const blockProps = useBlockProps({ className: 'riyasat-categories-scroller-editor' });
      const [activeIndex, setActiveIndex] = useState(0);
      const { childBlocks, childCount, insertBlock, removeBlock, updateBlockAttributes } =
        useChildBlocks(clientId);
      const { trackRef, slideCount, goToSlide } = useSliderPagination(
        clientId,
        activeIndex,
        setActiveIndex,
      );

      return (
        <>
          <InspectorControls group="content">
            <div style={contentTabStyle}>
              {childBlocks.map((block, index) => {
                const { imageUrl, label, action: itemAction } = block.attributes;
                return (
                  <PanelBody
                    key={block.clientId}
                    title={`Category ${index + 1}${label ? `: ${label}` : ''}`}
                    initialOpen={false}
                  >
                    <ImagePicker
                      imageUrl={imageUrl}
                      onSelect={(media) =>
                        updateBlockAttributes(
                          block.clientId,
                          imageAttributesFromMedia(media),
                        )
                      }
                      onClear={() =>
                        updateBlockAttributes(block.clientId, clearImageAttributes())
                      }
                    />
                    <TextControl
                      label="Label"
                      value={label}
                      onChange={(value) =>
                        updateBlockAttributes(block.clientId, { label: value })
                      }
                    />
                    <ActionBuilder
                      label="Tap action"
                      value={itemAction ?? {}}
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
                        Remove category
                      </Button>
                    ) : null}
                  </PanelBody>
                );
              })}
              <Button
                variant="primary"
                onClick={() =>
                  insertBlock(
                    createBlock(CATEGORIES_SCROLLER_ITEM_BLOCK, {}),
                    childCount,
                    clientId,
                  )
                }
                style={{ width: '100%', justifyContent: 'center' }}
              >
                Add category
              </Button>
            </div>
          </InspectorControls>

          <InspectorControls>
            <PanelBody title="Settings" initialOpen={true}>
              <PanelColorSettings
                title="Colors"
                colorSettings={[
                  {
                    label: 'Background color',
                    value: backgroundColor,
                    onChange: (value) =>
                      setAttributes({ backgroundColor: value || DEFAULT_BACKGROUND }),
                  },
                ]}
              />
              <ActionBuilder
                label="Section action"
                value={action ?? {}}
                onChange={(next) => setAttributes({ action: next })}
              />
            </PanelBody>
          </InspectorControls>

          <div {...blockProps}>
            <div
              className="riyasat-categories-scroller"
              style={{ background: backgroundColor }}
            >
              <div className="riyasat-categories-scroller__track" ref={trackRef}>
                <InnerBlocks
                  allowedBlocks={[CATEGORIES_SCROLLER_ITEM_BLOCK]}
                  template={[
                    [CATEGORIES_SCROLLER_ITEM_BLOCK, {}],
                    [CATEGORIES_SCROLLER_ITEM_BLOCK, {}],
                  ]}
                  templateLock={false}
                  renderAppender={false}
                  orientation="horizontal"
                />
              </div>

              <SliderPaginationDots
                count={slideCount}
                activeIndex={activeIndex}
                onSelect={goToSlide}
                className="riyasat-categories-scroller__pagination"
                dotClassName="riyasat-categories-scroller__dot"
                ariaLabelPrefix="Go to category"
              />
            </div>
          </div>
        </>
      );
    },

    save: ({ attributes }) => {
      const { backgroundColor, action } = attributes;
      const blockProps = useBlockProps.save({
        className: 'riyasat-categories-scroller',
        'data-background-color': backgroundColor,
        'data-action': JSON.stringify(action ?? {}),
        style: { background: backgroundColor },
      });
      return (
        <div {...blockProps}>
          <div className="riyasat-categories-scroller__track">
            <InnerBlocks.Content />
          </div>
        </div>
      );
    },
  });
}

export function registerCategoriesScroller() {
  registerCategoriesScrollerItem();
  registerCategoriesScrollerParent();
}
