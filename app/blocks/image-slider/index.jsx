// @ts-nocheck
// Image slider — parent (core/image-slider) + child slide
// (core/image-slider-item) using InnerBlocks. Authored against the kit's shared
// @wordpress runtime. Registered from ../index.ts inside registerBlocks().
import { useState } from 'gutenberg-block-kit/wp/element';
import { registerBlockType, createBlock } from 'gutenberg-block-kit/wp/blocks';
import {
  useBlockProps,
  InnerBlocks,
  InspectorControls,
  MediaUpload,
  MediaUploadCheck,
  PanelColorSettings,
} from 'gutenberg-block-kit/wp/block-editor';
import {
  PanelBody,
  TextControl,
  ToggleControl,
  Button,
} from 'gutenberg-block-kit/wp/components';
import { ActionBuilder } from 'gutenberg-block-kit/actions';
import { contentTabStyle, ImagePicker, imageAttributesFromMedia, clearImageAttributes, useChildBlocks, useSliderPagination, SliderPaginationDots } from '../inspector-shared';
import {
  IMAGE_SLIDER_BLOCK,
  IMAGE_SLIDER_ITEM_BLOCK,
  RIYASAT_CATEGORY,
} from '../constants';

function ImageSliderIcon() {
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
        d="M3 6h4v12H3V6zm5 1h8v10H8V7zm9-1h4v12h-4V6z"
      />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Child: core/image-slider-item — one slide (image + label + tap action)
// ---------------------------------------------------------------------------
function registerImageSliderItem() {
  registerBlockType(IMAGE_SLIDER_ITEM_BLOCK, {
    apiVersion: 3,
    title: 'Slider Item',
    description: 'A single slide: image, label and optional tap action.',
    category: RIYASAT_CATEGORY,
    parent: [IMAGE_SLIDER_BLOCK],
    icon: 'format-image',
    supports: { html: false, reusable: false },
    attributes: {
      imageUrl: { type: 'string', default: '' },
      imageWidth: { type: 'number', default: 0 },
      imageHeight: { type: 'number', default: 0 },
      label: { type: 'string', default: '' },
      action: { type: 'object', default: {} },
    },

    edit: ({ attributes, setAttributes }) => {
      const { imageUrl, label, action } = attributes;
      const blockProps = useBlockProps({
        className: 'riyasat-image-slider-item-editor',
      });

      return (
        <>
          <InspectorControls group="content">
            <div style={contentTabStyle}>
              <PanelBody title="Slide" initialOpen={true}>
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
                      className="riyasat-image-slider-item-editor__image"
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
                      className="riyasat-image-slider-item-editor__image-btn"
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
              className="riyasat-image-slider-item-editor__label"
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
        className: 'riyasat-image-slider__slide',
        'data-action': JSON.stringify(action ?? {}),
      });
      return (
        <div {...blockProps}>
          {imageUrl ? (
            <img src={imageUrl} alt="" className="riyasat-image-slider__image" />
          ) : null}
          {label ? (
            <span className="riyasat-image-slider__label">{label}</span>
          ) : null}
        </div>
      );
    },
  });
}

// ---------------------------------------------------------------------------
// Parent: core/image-slider — title/subtitle + horizontal slides
// ---------------------------------------------------------------------------
function registerImageSliderParent() {
  registerBlockType(IMAGE_SLIDER_BLOCK, {
    apiVersion: 3,
    title: 'Image Slider',
    description: 'A titled, horizontally scrolling row of image slides.',
    category: RIYASAT_CATEGORY,
    icon: ImageSliderIcon,
    keywords: ['slider', 'scroller', 'images', 'products'],
    supports: { html: false, align: ['wide', 'full'] },
    attributes: {
      title: { type: 'string', default: '' },
      subTitle: { type: 'string', default: '' },
      showPagination: { type: 'boolean', default: true },
      gap: { type: 'number', default: 20 },
      backgroundColor: { type: 'string', default: '#ffffff' },
    },

    edit: ({ attributes, setAttributes, clientId }) => {
      const { title, subTitle, showPagination, gap, backgroundColor } = attributes;
      const blockProps = useBlockProps({ className: 'riyasat-image-slider-editor' });
      const [activeIndex, setActiveIndex] = useState(0);
      const { childBlocks, childCount, insertBlock, removeBlock, updateBlockAttributes } =
        useChildBlocks(clientId);
      const { trackRef, slideCount, goToSlide } = useSliderPagination(clientId, activeIndex, setActiveIndex);
      const sliderGap = Number.isFinite(gap) ? Math.max(0, gap) : 20;

      return (
        <>
          <InspectorControls group="content">
            <div style={contentTabStyle}>
              <PanelBody title="Heading" initialOpen={true}>
                <TextControl
                  label="Main Title"
                  value={title}
                  onChange={(value) => setAttributes({ title: value })}
                />
                <TextControl
                  label="Sub Title"
                  value={subTitle}
                  onChange={(value) => setAttributes({ subTitle: value })}
                />
              </PanelBody>
              {childBlocks.map((block, index) => {
                const { imageUrl, label, action } = block.attributes;
                return (
                  <PanelBody
                    key={block.clientId}
                    title={`Slide ${index + 1}`}
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
                      value={action}
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
                        Remove slide
                      </Button>
                    ) : null}
                  </PanelBody>
                );
              })}
              <Button
                variant="primary"
                onClick={() =>
                  insertBlock(createBlock(IMAGE_SLIDER_ITEM_BLOCK, {}), childCount, clientId)
                }
                style={{ width: '100%', justifyContent: 'center' }}
              >
                Add slide
              </Button>
            </div>
          </InspectorControls>

          <InspectorControls>
            <PanelBody title="Settings" initialOpen={true}>
              <TextControl
                label="Gap (px)"
                help="Enter spacing between slides in pixels."
                value={String(sliderGap)}
                onChange={(value) =>
                  setAttributes({
                    gap: Math.max(0, Number.parseInt(value || `${sliderGap}`, 10) || 0),
                  })}
              />
              <ToggleControl
                label="Show pagination"
                checked={showPagination}
                onChange={(value) => setAttributes({ showPagination: value })}
              />
              <PanelColorSettings
                title="Colors"
                colorSettings={[
                  {
                    label: 'Background color',
                    value: backgroundColor || '#ffffff',
                    onChange: (value) =>
                      setAttributes({ backgroundColor: value || '#ffffff' }),
                  },
                ]}
              />
            </PanelBody>
          </InspectorControls>

          <div {...blockProps}>
            <div
              className="riyasat-image-slider"
              style={{
                '--riyasat-image-slider-gap': `${sliderGap}px`,
                backgroundColor: backgroundColor || '#ffffff',
              }}
            >
              {(title || subTitle) && (
                <div className="riyasat-image-slider__heading">
                  {title ? (
                    <h3 className="riyasat-image-slider__title">{title}</h3>
                  ) : null}
                  {subTitle ? (
                    <p className="riyasat-image-slider__subtitle">{subTitle}</p>
                  ) : null}
                </div>
              )}

              <div className="riyasat-image-slider__track" ref={trackRef}>
                <InnerBlocks
                  allowedBlocks={[IMAGE_SLIDER_ITEM_BLOCK]}
                  template={[
                    [IMAGE_SLIDER_ITEM_BLOCK, {}],
                    [IMAGE_SLIDER_ITEM_BLOCK, {}],
                  ]}
                  templateLock={false}
                  renderAppender={false}
                  orientation="horizontal"
                />
              </div>

              {showPagination ? (
                <SliderPaginationDots
                  count={slideCount}
                  activeIndex={activeIndex}
                  onSelect={goToSlide}
                  className="riyasat-image-slider__pagination"
                  dotClassName="riyasat-image-slider__dot"
                  ariaLabelPrefix="Go to slide"
                />
              ) : null}
            </div>
          </div>
        </>
      );
    },

    save: ({ attributes }) => {
      const { title, subTitle, showPagination, gap, backgroundColor } = attributes;
      const sliderGap = Number.isFinite(gap) ? Math.max(0, gap) : 20;
      const blockProps = useBlockProps.save({
        className: 'riyasat-image-slider',
        'data-show-pagination': showPagination ? 'true' : 'false',
        'data-background-color': backgroundColor || '#ffffff',
        style: {
          '--riyasat-image-slider-gap': `${sliderGap}px`,
          backgroundColor: backgroundColor || '#ffffff',
        },
      });
      return (
        <div {...blockProps}>
          {(title || subTitle) && (
            <div className="riyasat-image-slider__heading">
              {title ? (
                <h3 className="riyasat-image-slider__title">{title}</h3>
              ) : null}
              {subTitle ? (
                <p className="riyasat-image-slider__subtitle">{subTitle}</p>
              ) : null}
            </div>
          )}
          <div className="riyasat-image-slider__track">
            <InnerBlocks.Content />
          </div>
          {showPagination ? (
            <div
              className="riyasat-image-slider__pagination"
              aria-hidden="true"
            />
          ) : null}
        </div>
      );
    },
  });
}

/**
 * Register the image-slider parent + slide child. Child registers first so the
 * parent's InnerBlocks template can reference it.
 */
export function registerImageSlider() {
  registerImageSliderItem();
  registerImageSliderParent();
}
