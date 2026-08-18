// @ts-nocheck
// Hero/Image carousel — parent (core/image-carousel) + child slide
// (core/image-carousel-item) using InnerBlocks. Authored against the kit's
// shared @wordpress runtime so registerBlockType() hits the editor's registry.
// Called from ../index.ts inside registerBlocks().
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
import { PanelBody, ToggleControl, Button } from 'gutenberg-block-kit/wp/components';
import { ActionBuilder } from 'gutenberg-block-kit/actions';
import {
  contentTabStyle,
  useChildBlocks,
  useCarouselPagination,
  SliderPaginationDots,
} from '../inspector-shared';
import { isVideoLikeMedia } from '../../lib/media-utils';
import {
  IMAGE_CAROUSEL_BLOCK,
  IMAGE_CAROUSEL_ITEM_BLOCK,
  RIYASAT_CATEGORY,
} from '../constants';

const DEFAULT_ACTIVE_DOT_COLOR = '#FFFFFF';
const DEFAULT_INACTIVE_DOT_COLOR = '#000000';
const DEFAULT_BACKGROUND_COLOR = '#FFFFFF';

function getCarouselDotColors(activeDotColor, inActiveDotColor) {
  return {
    '--riyasat-pagination-active': activeDotColor || DEFAULT_ACTIVE_DOT_COLOR,
    '--riyasat-pagination-inactive': inActiveDotColor || DEFAULT_INACTIVE_DOT_COLOR,
  };
}

function mediaFromSelection(selected) {
  return {
    media: {
      url: selected?.url ?? '',
      type: selected?.mime ?? selected?.type ?? '',
    },
  };
}

function clearMedia() {
  return {
    media: {
      url: '',
      type: '',
    },
  };
}

function getMediaUrl(media) {
  return media?.url || '';
}

function isSlideVideo(media) {
  return isVideoLikeMedia({
    type: media?.type,
    mime: media?.type,
  });
}

function CarouselIcon() {
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
        d="M4 5h16a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2zm0 2v9h16V7H4z"
      />
      <circle cx="9" cy="19.5" r="1.1" fill="currentColor" />
      <circle cx="12" cy="19.5" r="1.1" fill="currentColor" />
      <circle cx="15" cy="19.5" r="1.1" fill="currentColor" />
    </svg>
  );
}

function SlideMediaPicker({
  media,
  onSelect,
  onClear,
  addLabel = 'Add image or video',
  changeLabel = 'Change media',
  previewHeight = '80px',
}) {
  const mediaUrl = getMediaUrl(media);
  const isVideo = isSlideVideo(media);

  return (
    <MediaUploadCheck>
      <MediaUpload
        onSelect={(selected) => onSelect(mediaFromSelection(selected))}
        allowedTypes={['image', 'video']}
        render={({ open }) => (
          <div>
            {mediaUrl ? (
              <div
                onClick={open}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') open();
                }}
                role="button"
                tabIndex={0}
                style={{
                  marginBottom: '8px',
                  borderRadius: '6px',
                  overflow: 'hidden',
                  cursor: 'pointer',
                  border: '1px solid #ddd',
                }}
              >
                {isVideo ? (
                  <video
                    src={mediaUrl}
                    className="riyasat-image-carousel-item-editor__video"
                    muted
                    playsInline
                    style={{
                      width: '100%',
                      height: previewHeight,
                      objectFit: 'cover',
                      display: 'block',
                    }}
                  />
                ) : (
                  <img
                    src={mediaUrl}
                    alt=""
                    style={{
                      width: '100%',
                      height: previewHeight,
                      objectFit: 'cover',
                      display: 'block',
                    }}
                  />
                )}
              </div>
            ) : null}
            <Button onClick={open} variant="secondary" style={{ width: '100%' }}>
              {mediaUrl ? changeLabel : addLabel}
            </Button>
            {mediaUrl && onClear ? (
              <Button onClick={onClear} variant="link" isDestructive style={{ marginTop: '4px' }}>
                Remove media
              </Button>
            ) : null}
          </div>
        )}
      />
    </MediaUploadCheck>
  );
}

function CarouselSlideMedia({ media, onOpen, className }) {
  const mediaUrl = getMediaUrl(media);

  if (!mediaUrl) {
    return (
      <button type="button" className="riyasat-image-carousel-item-editor__placeholder" onClick={onOpen}>
        Click to add image or video
      </button>
    );
  }

  if (isSlideVideo(media)) {
    return (
      <video
        src={mediaUrl}
        className={className || 'riyasat-image-carousel-item-editor__video'}
        muted
        playsInline
        autoPlay
        loop
        onClick={onOpen}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') onOpen();
        }}
        role="button"
        tabIndex={0}
      />
    );
  }

  return (
    <img
      src={mediaUrl}
      alt=""
      className={className || 'riyasat-image-carousel-item-editor__image'}
      onClick={onOpen}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') onOpen();
      }}
      role="button"
      tabIndex={0}
    />
  );
}

// ---------------------------------------------------------------------------
// Child: core/image-carousel-item — one slide (image/video + tap action)
// ---------------------------------------------------------------------------
function registerCarouselItem() {
  registerBlockType(IMAGE_CAROUSEL_ITEM_BLOCK, {
    apiVersion: 3,
    title: 'Carousel Slide',
    description: 'A single slide with image or video and optional tap action.',
    category: RIYASAT_CATEGORY,
    parent: [IMAGE_CAROUSEL_BLOCK],
    icon: 'format-image',
    supports: { html: false, reusable: false },
    attributes: {
      media: { type: 'object', default: {} },
      action: { type: 'object', default: {} },
    },

    edit: ({ attributes, setAttributes }) => {
      const { media, action: rawAction } = attributes;
      const action = rawAction ?? {};
      const blockProps = useBlockProps({
        className: 'riyasat-image-carousel-item-editor',
      });

      return (
        <>
          <InspectorControls group="content">
            <div style={contentTabStyle}>
              <PanelBody title="Slide" initialOpen={true}>
                <SlideMediaPicker
                  media={media}
                  onSelect={(next) => setAttributes(next)}
                  onClear={() => setAttributes(clearMedia())}
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
            <MediaUploadCheck>
              <MediaUpload
                onSelect={(selected) => setAttributes(mediaFromSelection(selected))}
                allowedTypes={['image', 'video']}
                render={({ open }) => (
                  <CarouselSlideMedia media={media} onOpen={open} />
                )}
              />
            </MediaUploadCheck>
          </div>
        </>
      );
    },

    save: ({ attributes }) => {
      const { media, action } = attributes;
      const mediaUrl = getMediaUrl(media);
      const blockProps = useBlockProps.save({
        className: 'riyasat-image-carousel__slide',
        'data-media': JSON.stringify(media ?? {}),
        'data-action': JSON.stringify(action ?? {}),
      });

      if (!mediaUrl) return <div {...blockProps} />;

      if (isSlideVideo(media)) {
        return (
          <div {...blockProps}>
            <video
              src={mediaUrl}
              className="riyasat-image-carousel__video"
              muted
              playsInline
              autoPlay
              loop
            />
          </div>
        );
      }

      return (
        <div {...blockProps}>
          <img src={mediaUrl} alt="" className="riyasat-image-carousel__image" />
        </div>
      );
    },
  });
}

// ---------------------------------------------------------------------------
// Parent: core/image-carousel — holds slides + pagination toggle
// ---------------------------------------------------------------------------
function registerCarouselParent() {
  registerBlockType(IMAGE_CAROUSEL_BLOCK, {
    apiVersion: 3,
    title: 'Hero Carousel',
    description: 'Full-width image or video carousel with pagination dots.',
    category: RIYASAT_CATEGORY,
    icon: CarouselIcon,
    keywords: ['carousel', 'hero', 'slider', 'images', 'video'],
    supports: { html: false, align: ['wide', 'full'] },
    attributes: {
      showPagination: { type: 'boolean', default: true },
      backgroundColor: { type: 'string', default: DEFAULT_BACKGROUND_COLOR },
      activeDotColor: { type: 'string', default: DEFAULT_ACTIVE_DOT_COLOR },
      inActiveDotColor: { type: 'string', default: DEFAULT_INACTIVE_DOT_COLOR },
    },

    edit: ({ attributes, setAttributes, clientId }) => {
      const { showPagination, backgroundColor, activeDotColor, inActiveDotColor } =
        attributes;
      const dotColors = getCarouselDotColors(activeDotColor, inActiveDotColor);
      const blockProps = useBlockProps({ className: 'riyasat-image-carousel-editor' });
      const [activeIndex, setActiveIndex] = useState(0);
      const { childBlocks, childCount, insertBlock, removeBlock, updateBlockAttributes } =
        useChildBlocks(clientId);
      const { slideCount, goToSlide } = useCarouselPagination(
        clientId,
        activeIndex,
        setActiveIndex,
      );

      return (
        <>
          <InspectorControls group="content">
            <div style={{ padding: '0 16px 16px' }}>
              {childBlocks.map((block, index) => {
                const { media, action } = block.attributes;
                return (
                  <PanelBody
                    key={block.clientId}
                    title={`Slide ${index + 1}`}
                    initialOpen={false}
                  >
                    <SlideMediaPicker
                      media={media}
                      onSelect={(next) => updateBlockAttributes(block.clientId, next)}
                      onClear={() => updateBlockAttributes(block.clientId, clearMedia())}
                    />
                    <div style={{ marginTop: '12px' }}>
                      <ActionBuilder
                        label="Tap action"
                        value={action}
                        onChange={(next) =>
                          updateBlockAttributes(block.clientId, { action: next })
                        }
                      />
                    </div>
                    {slideCount > 1 ? (
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
                  insertBlock(
                    createBlock(IMAGE_CAROUSEL_ITEM_BLOCK, {}),
                    slideCount,
                    clientId,
                  )
                }
                style={{ width: '100%', justifyContent: 'center' }}
              >
                Add slide
              </Button>
            </div>
          </InspectorControls>

          <InspectorControls>
            <PanelBody title="Settings" initialOpen={true}>
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
                    value: backgroundColor || DEFAULT_BACKGROUND_COLOR,
                    onChange: (value) =>
                      setAttributes({
                        backgroundColor: value || DEFAULT_BACKGROUND_COLOR,
                      }),
                  },
                  {
                    label: 'Active dot color',
                    value: activeDotColor || DEFAULT_ACTIVE_DOT_COLOR,
                    onChange: (value) =>
                      setAttributes({
                        activeDotColor: value || DEFAULT_ACTIVE_DOT_COLOR,
                      }),
                  },
                  {
                    label: 'Inactive dot color',
                    value: inActiveDotColor || DEFAULT_INACTIVE_DOT_COLOR,
                    onChange: (value) =>
                      setAttributes({
                        inActiveDotColor: value || DEFAULT_INACTIVE_DOT_COLOR,
                      }),
                  },
                ]}
              />
            </PanelBody>
          </InspectorControls>

          <div {...blockProps}>
            <div
              className="riyasat-image-carousel"
              style={{
                position: 'relative',
                backgroundColor: backgroundColor || DEFAULT_BACKGROUND_COLOR,
                ...dotColors,
              }}
            >
              <div
                className="riyasat-image-carousel__track"
                data-active-index={activeIndex}
              >
                <InnerBlocks
                  allowedBlocks={[IMAGE_CAROUSEL_ITEM_BLOCK]}
                  template={[
                    [IMAGE_CAROUSEL_ITEM_BLOCK, {}],
                    [IMAGE_CAROUSEL_ITEM_BLOCK, {}],
                  ]}
                  templateLock={false}
                  renderAppender={false}
                />
              </div>

              {showPagination ? (
                <SliderPaginationDots
                  count={slideCount}
                  activeIndex={activeIndex}
                  onSelect={goToSlide}
                  className="riyasat-image-carousel__pagination riyasat-image-carousel__pagination--preview"
                  dotClassName="riyasat-image-carousel__dot"
                  ariaLabelPrefix="Go to slide"
                />
              ) : null}
            </div>
          </div>
        </>
      );
    },

    save: ({ attributes }) => {
      const { showPagination, backgroundColor, activeDotColor, inActiveDotColor } =
        attributes;
      const dotColors = getCarouselDotColors(activeDotColor, inActiveDotColor);
      const blockProps = useBlockProps.save({
        className: 'riyasat-image-carousel',
        'data-show-pagination': showPagination ? 'true' : 'false',
        'data-background-color': backgroundColor || DEFAULT_BACKGROUND_COLOR,
        'data-active-dot-color': activeDotColor || DEFAULT_ACTIVE_DOT_COLOR,
        'data-in-active-dot-color': inActiveDotColor || DEFAULT_INACTIVE_DOT_COLOR,
        style: {
          backgroundColor: backgroundColor || DEFAULT_BACKGROUND_COLOR,
          ...dotColors,
        },
      });
      return (
        <div {...blockProps}>
          <div className="riyasat-image-carousel__track">
            <InnerBlocks.Content />
          </div>
          {showPagination ? (
            <div className="riyasat-image-carousel__pagination" aria-hidden="true" />
          ) : null}
        </div>
      );
    },
  });
}

/**
 * Register the carousel parent + slide child. Child must register first so the
 * parent's InnerBlocks template can reference it.
 */
export function registerImageCarousel() {
  registerCarouselItem();
  registerCarouselParent();
}
