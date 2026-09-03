// @ts-nocheck
// Advanced Multimedia Scroller — parent (core/advanced-multimedia-scroller) + child
// slide (core/advanced-multimedia-scroller-item) using InnerBlocks.
// Authored against the kit's shared @wordpress runtime. Registered from ../index.ts.
import { useState } from 'gutenberg-block-kit/wp/element';
import { registerBlockType, createBlock } from 'gutenberg-block-kit/wp/blocks';
import {
  useBlockProps,
  InnerBlocks,
  InspectorControls,
  MediaUpload,
  MediaUploadCheck,
} from 'gutenberg-block-kit/wp/block-editor';
import {
  PanelBody,
  ToggleControl,
  Button,
  SelectControl,
  RangeControl,
  TextControl,
} from 'gutenberg-block-kit/wp/components';
import { useSelect, useDispatch } from 'gutenberg-block-kit/wp/data';
import { ActionBuilder } from 'gutenberg-block-kit/actions';
import {
  ColorSettingsPanel,
  contentTabStyle,
  useChildBlocks,
  useCarouselPagination,
  SliderPaginationDots,
  stopPaginationEvent,
} from '../inspector-shared';
import { isVideoLikeMedia } from '../../lib/media-utils';
import {
  ADVANCED_MULTIMEDIA_SCROLLER_BLOCK,
  ADVANCED_MULTIMEDIA_SCROLLER_ITEM_BLOCK,
  APPBUILDER_CATEGORY,
} from '../constants';

const DEFAULT_ACTIVE_DOT_COLOR = '#FFFFFF';
const DEFAULT_INACTIVE_DOT_COLOR = '#000000';
const DEFAULT_BACKGROUND_COLOR = '#FFFFFF';
const DEFAULT_CAROUSEL_HEIGHT = 320;

function getDotColors(activeDotColor, inActiveDotColor) {
  return {
    '--appbuilder-multimedia-scroller-pagination-active': activeDotColor || DEFAULT_ACTIVE_DOT_COLOR,
    '--appbuilder-multimedia-scroller-pagination-inactive':
      inActiveDotColor || DEFAULT_INACTIVE_DOT_COLOR,
  };
}

function mediaDimension(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function mediaFromSelection(selected) {
  const imageWidth = mediaDimension(selected?.width);
  const imageHeight = mediaDimension(selected?.height);
  return {
    media: {
      url: selected?.url ?? selected?.src ?? '',
      type: selected?.mime ?? selected?.type ?? '',
      imageWidth,
      imageHeight,
    },
  };
}

function mediaForSave(media) {
  return {
    url: media?.url ?? '',
    type: media?.type ?? '',
    imageWidth: mediaDimension(media?.imageWidth ?? media?.width),
    imageHeight: mediaDimension(media?.imageHeight ?? media?.height),
  };
}

function clearMedia() {
  return {
    media: {
      url: '',
      type: '',
      imageWidth: 0,
      imageHeight: 0,
    },
  };
}

function getMediaUrl(media) {
  return media?.url || '';
}

function isSlideVideo(media) {
  if (!media || !media.url) return false;
  const rawType = String(media.type || media.mime || '').toLowerCase();
  if (rawType.includes('video')) return true;

  const urlStr = String(media.url || '').toLowerCase();
  if (/\.(mp4|webm|ogg|mov|m4v)(\?.*)?$/i.test(urlStr)) return true;

  return isVideoLikeMedia({
    type: media.type,
    mime: media.type,
  });
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
                    className="appbuilder-multimedia-scroller-item-editor__video"
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

function SlideMediaDisplay({ media, onOpen }) {
  const mediaUrl = getMediaUrl(media);

  if (!mediaUrl) {
    return (
      <button
        type="button"
        className="appbuilder-multimedia-scroller-item-editor__placeholder"
        onClick={onOpen}
      >
        Click to add image or video
      </button>
    );
  }

  if (isSlideVideo(media)) {
    return (
      <video
        src={mediaUrl}
        className="appbuilder-multimedia-scroller-item-editor__video"
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
      className="appbuilder-multimedia-scroller-item-editor__image"
      onClick={onOpen}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') onOpen();
      }}
      role="button"
      tabIndex={0}
    />
  );
}

function patchMediaSize(media, key, value) {
  return {
    media: {
      url: media?.url ?? '',
      type: media?.type ?? '',
      imageWidth:
        key === 'imageWidth'
          ? mediaDimension(value)
          : mediaDimension(media?.imageWidth),
      imageHeight:
        key === 'imageHeight'
          ? mediaDimension(value)
          : mediaDimension(media?.imageHeight),
    },
  };
}

function MediaSizeFields({ media, onChange }) {
  return (
    <>
      <TextControl
        label="Image Width"
        type="number"
        min={0}
        value={mediaDimension(media?.imageWidth)}
        onChange={(value) => onChange(patchMediaSize(media, 'imageWidth', value))}
      />
      <TextControl
        label="Image Height"
        type="number"
        min={0}
        value={mediaDimension(media?.imageHeight)}
        onChange={(value) => onChange(patchMediaSize(media, 'imageHeight', value))}
      />
    </>
  );
}

function CarouselSettingsPanels({ attributes, setAttributes }) {
  const {
    showDotIndicator,
    showDotIndicatorOnImage,
    dotAlignment,
    activeDotColor,
    inActiveDotColor,
    enableAutoSlide,
    autoSlideDelay,
  } = attributes || {};

  return (
    <>
      <PanelBody title="Indicators" initialOpen={true}>
        <ToggleControl
          label="Show Dot Indicator"
          checked={!!showDotIndicator}
          onChange={(value) => setAttributes({ showDotIndicator: value })}
        />
        {showDotIndicator ? (
          <>
            <ToggleControl
              label="Show Dot Indicator On Image"
              checked={!!showDotIndicatorOnImage}
              onChange={(value) => setAttributes({ showDotIndicatorOnImage: value })}
            />
            <SelectControl
              label="Dot Indicator Position"
              value={dotAlignment || 'center'}
              options={[
                { label: 'Left', value: 'left' },
                { label: 'Center', value: 'center' },
                { label: 'Right', value: 'right' },
              ]}
              onChange={(value) => setAttributes({ dotAlignment: value })}
            />
            <ColorSettingsPanel
              title="Dot Colors"
              colorSettings={[
                {
                  label: 'Active Dot Color',
                  value: activeDotColor || DEFAULT_ACTIVE_DOT_COLOR,
                  onChange: (value) => {
                    if (value === undefined || value === null || value === '') {
                      return;
                    }
                    setAttributes({ activeDotColor: value });
                  },
                },
                {
                  label: 'Inactive Dot Color',
                  value: inActiveDotColor || DEFAULT_INACTIVE_DOT_COLOR,
                  onChange: (value) => {
                    if (value === undefined || value === null || value === '') {
                      return;
                    }
                    setAttributes({
                      inActiveDotColor: value,
                    });
                  },
                },
              ]}
            />
          </>
        ) : null}
      </PanelBody>

      <PanelBody title="Auto Slide" initialOpen={true}>
        <ToggleControl
          label="Enable Auto Slide"
          checked={!!enableAutoSlide}
          onChange={(value) => setAttributes({ enableAutoSlide: value })}
        />
        {enableAutoSlide ? (
          <RangeControl
            label="Auto Slide Delay (ms)"
            value={autoSlideDelay || 3000}
            onChange={(value) => setAttributes({ autoSlideDelay: Math.max(500, value) })}
            min={500}
            max={10000}
            step={100}
          />
        ) : null}
      </PanelBody>
    </>
  );
}

// ---------------------------------------------------------------------------
// Child: core/advanced-multimedia-scroller-item — one hero slide
// ---------------------------------------------------------------------------
function registerMultimediaScrollerItem() {
  registerBlockType(ADVANCED_MULTIMEDIA_SCROLLER_ITEM_BLOCK, {
    apiVersion: 3,
    title: 'Hero Slide',
    description: 'A single slide with image or video and optional tap action.',
    category: APPBUILDER_CATEGORY,
    parent: [ADVANCED_MULTIMEDIA_SCROLLER_BLOCK],
    icon: 'format-image',
    supports: { html: false, reusable: false },
    attributes: {
      media: { type: 'object', default: {} },
      action: { type: 'object', default: {} },
    },

    edit: ({ attributes, setAttributes, clientId }) => {
      const { media, action: rawAction } = attributes;
      const action = rawAction ?? {};
      const blockProps = useBlockProps({
        className: 'appbuilder-multimedia-scroller-item-editor',
      });

      const { parentClientId, parentAttributes, childBlocks } = useSelect(
        (select) => {
          const editor = select('core/block-editor');
          const parents = editor.getBlockParents(clientId);
          const parentId = parents[parents.length - 1];
          return {
            parentClientId: parentId,
            parentAttributes: parentId ? editor.getBlockAttributes(parentId) : null,
            childBlocks: parentId ? editor.getBlocks(parentId) : [],
          };
        },
        [clientId],
      );
      const childCount = childBlocks.length;
      const { insertBlock, removeBlock, updateBlockAttributes } =
        useDispatch('core/block-editor');

      return (
        <>
          <InspectorControls group="content">
            <div style={contentTabStyle}>
              {childBlocks.length > 0 ? (
                childBlocks.map((block, index) => {
                  const bMedia = block.attributes?.media;
                  const bAction = block.attributes?.action;
                  const isCurrent = block.clientId === clientId;
                  return (
                    <PanelBody
                      key={block.clientId}
                      title={`Slide ${index + 1}${
                        bMedia?.url ? ` — ${isSlideVideo(bMedia) ? 'Video' : 'Image'}` : ''
                      }`}
                      initialOpen={isCurrent}
                    >
                      <SlideMediaPicker
                        media={bMedia}
                        onSelect={(next) =>
                          isCurrent
                            ? setAttributes(next)
                            : updateBlockAttributes(block.clientId, next)
                        }
                        onClear={() =>
                          isCurrent
                            ? setAttributes(clearMedia())
                            : updateBlockAttributes(block.clientId, clearMedia())
                        }
                      />
                      <MediaSizeFields
                        media={bMedia}
                        onChange={(next) =>
                          isCurrent
                            ? setAttributes(next)
                            : updateBlockAttributes(block.clientId, next)
                        }
                      />
                      <div style={{ marginTop: '12px' }}>
                        <ActionBuilder
                          label="Tap action"
                          value={bAction ?? {}}
                          onChange={(next) =>
                            isCurrent
                              ? setAttributes({ action: next })
                              : updateBlockAttributes(block.clientId, { action: next })
                          }
                        />
                      </div>
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
                })
              ) : (
                <PanelBody title="Slide" initialOpen={true}>
                  <SlideMediaPicker
                    media={media}
                    onSelect={(next) => setAttributes(next)}
                    onClear={() => setAttributes(clearMedia())}
                  />
                  <MediaSizeFields
                    media={media}
                    onChange={(next) => setAttributes(next)}
                  />
                  <div style={{ marginTop: '12px' }}>
                    <ActionBuilder
                      label="Tap action"
                      value={action}
                      onChange={(next) => setAttributes({ action: next })}
                    />
                  </div>
                </PanelBody>
              )}

              {parentClientId ? (
                <Button
                  variant="primary"
                  onClick={() =>
                    insertBlock(
                      createBlock(ADVANCED_MULTIMEDIA_SCROLLER_ITEM_BLOCK, {}),
                      childCount,
                      parentClientId,
                    )
                  }
                  style={{ width: '100%', justifyContent: 'center' }}
                >
                  Add slide
                </Button>
              ) : null}
            </div>
          </InspectorControls>

          {parentAttributes ? (
            <InspectorControls>
              <CarouselSettingsPanels
                attributes={parentAttributes}
                setAttributes={(newAttrs) => updateBlockAttributes(parentClientId, newAttrs)}
              />
            </InspectorControls>
          ) : null}

          <div {...blockProps}>
            <MediaUploadCheck>
              <MediaUpload
                onSelect={(selected) => setAttributes(mediaFromSelection(selected))}
                allowedTypes={['image', 'video']}
                render={({ open }) => <SlideMediaDisplay media={media} onOpen={open} />}
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
        className: 'appbuilder-multimedia-scroller__slide',
        'data-media': JSON.stringify(mediaForSave(media)),
        'data-action': JSON.stringify(action ?? {}),
      });

      if (!mediaUrl) return <div {...blockProps} />;

      if (isSlideVideo(media)) {
        return (
          <div {...blockProps}>
            <video
              src={mediaUrl}
              className="appbuilder-multimedia-scroller__video"
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
          <img src={mediaUrl} alt="" className="appbuilder-multimedia-scroller__image" />
        </div>
      );
    },
  });
}

// ---------------------------------------------------------------------------
// Parent: core/advanced-multimedia-scroller — hero carousel with arrows + autoplay
// ---------------------------------------------------------------------------
function registerMultimediaScrollerParent() {
  registerBlockType(ADVANCED_MULTIMEDIA_SCROLLER_BLOCK, {
    apiVersion: 3,
    title: 'Advanced Multimedia Scroller',
    description: 'Full-width hero carousel with arrow navigation and auto-slide.',
    category: APPBUILDER_CATEGORY,
    icon: 'slides',
    keywords: ['carousel', 'hero', 'slider', 'images', 'video', 'multimedia'],
    supports: { html: false, align: ['wide', 'full'] },
    attributes: {
      showDotIndicator: { type: 'boolean', default: true },
      showDotIndicatorOnImage: { type: 'boolean', default: false },
      dotIndicatorPosition: { type: 'string', default: 'bottom' },
      dotAlignment: { type: 'string', default: 'center' },
      activeDotColor: { type: 'string', default: DEFAULT_ACTIVE_DOT_COLOR },
      inActiveDotColor: { type: 'string', default: DEFAULT_INACTIVE_DOT_COLOR },
      enableAutoSlide: { type: 'boolean', default: true },
      autoSlideDelay: { type: 'number', default: 3000 },
    },

    edit: ({ attributes, setAttributes, clientId }) => {
      const {
        showDotIndicator,
        showDotIndicatorOnImage,
        dotIndicatorPosition,
        dotAlignment,
        activeDotColor,
        inActiveDotColor,
      } = attributes;

      const blockProps = useBlockProps({ className: 'appbuilder-multimedia-scroller-editor' });
      const [activeIndex, setActiveIndex] = useState(0);

      const { childBlocks, insertBlock, removeBlock, updateBlockAttributes } =
        useChildBlocks(clientId);
      const { slideCount, goToSlide } = useCarouselPagination(
        clientId,
        activeIndex,
        setActiveIndex,
      );

      const dotColors = getDotColors(activeDotColor, inActiveDotColor);
      const showDots = showDotIndicator && slideCount > 1;
      const positionClass = showDotIndicatorOnImage ? 'bottom-overlay' : 'bottom';
      const heightPx = `${DEFAULT_CAROUSEL_HEIGHT}px`;

      return (
        <>
          <InspectorControls group="content">
            <div style={contentTabStyle}>
              {childBlocks.map((block, index) => {
                const { media, action } = block.attributes;
                return (
                  <PanelBody
                    key={block.clientId}
                    title={`Slide ${index + 1}${
                      media?.url ? ` — ${isSlideVideo(media) ? 'Video' : 'Image'}` : ''
                    }`}
                    initialOpen={false}
                  >
                    <SlideMediaPicker
                      media={media}
                      onSelect={(next) => updateBlockAttributes(block.clientId, next)}
                      onClear={() => updateBlockAttributes(block.clientId, clearMedia())}
                    />
                    <MediaSizeFields
                      media={media}
                      onChange={(next) => updateBlockAttributes(block.clientId, next)}
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
                    createBlock(ADVANCED_MULTIMEDIA_SCROLLER_ITEM_BLOCK, {}),
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
            <CarouselSettingsPanels attributes={attributes} setAttributes={setAttributes} />
          </InspectorControls>

          <div {...blockProps}>
            <div
              className="appbuilder-multimedia-scroller"
              style={{
                position: 'relative',
                backgroundColor: DEFAULT_BACKGROUND_COLOR,
                '--appbuilder-multimedia-scroller-height': heightPx,
                ...dotColors,
              }}
              data-dot-position={dotIndicatorPosition}
            >
              <div
                className="appbuilder-multimedia-scroller__track"
                data-active-index={activeIndex}
              >
                <InnerBlocks
                  allowedBlocks={[ADVANCED_MULTIMEDIA_SCROLLER_ITEM_BLOCK]}
                  template={[
                    [ADVANCED_MULTIMEDIA_SCROLLER_ITEM_BLOCK, {}],
                    [ADVANCED_MULTIMEDIA_SCROLLER_ITEM_BLOCK, {}],
                  ]}
                  templateLock={false}
                  renderAppender={false}
                />
              </div>

              {slideCount > 1 ? (
                <>
                  <button
                    type="button"
                    className="appbuilder-multimedia-scroller__arrow appbuilder-multimedia-scroller__arrow--prev"
                    onClick={(e) => goToSlide((activeIndex - 1 + slideCount) % slideCount, e)}
                    onMouseDown={stopPaginationEvent}
                    aria-label="Previous slide"
                  >
                    ‹
                  </button>
                  <button
                    type="button"
                    className="appbuilder-multimedia-scroller__arrow appbuilder-multimedia-scroller__arrow--next"
                    onClick={(e) => goToSlide((activeIndex + 1) % slideCount, e)}
                    onMouseDown={stopPaginationEvent}
                    aria-label="Next slide"
                  >
                    ›
                  </button>
                </>
              ) : null}

              {showDots ? (
                <SliderPaginationDots
                  count={slideCount}
                  activeIndex={activeIndex}
                  onSelect={goToSlide}
                  className={`appbuilder-multimedia-scroller__pagination appbuilder-multimedia-scroller__pagination--${positionClass} appbuilder-multimedia-scroller__pagination--${dotAlignment || 'center'}`}
                  dotClassName="appbuilder-multimedia-scroller__dot"
                  ariaLabelPrefix="Go to slide"
                />
              ) : null}
            </div>
          </div>
        </>
      );
    },

    save: ({ attributes }) => {
      const {
        showDotIndicator,
        showDotIndicatorOnImage,
        dotIndicatorPosition,
        dotAlignment,
        activeDotColor,
        inActiveDotColor,
        enableAutoSlide,
        autoSlideDelay,
      } = attributes;

      const dotColors = getDotColors(activeDotColor, inActiveDotColor);
      const positionClass = showDotIndicatorOnImage ? 'bottom-overlay' : 'bottom';
      const heightPx = `${DEFAULT_CAROUSEL_HEIGHT}px`;
      const blockProps = useBlockProps.save({
        className: 'appbuilder-multimedia-scroller',
        'data-show-dots': showDotIndicator ? 'true' : 'false',
        'data-dots-on-image': showDotIndicatorOnImage ? 'true' : 'false',
        'data-dot-position': dotIndicatorPosition,
        'data-dot-alignment': dotAlignment || 'center',
        'data-auto-slide': enableAutoSlide ? 'true' : 'false',
        'data-auto-slide-delay': enableAutoSlide ? String(autoSlideDelay) : '0',
        'data-active-dot-color': activeDotColor || DEFAULT_ACTIVE_DOT_COLOR,
        'data-inactive-dot-color': inActiveDotColor || DEFAULT_INACTIVE_DOT_COLOR,
        style: {
          backgroundColor: DEFAULT_BACKGROUND_COLOR,
          '--appbuilder-multimedia-scroller-height': heightPx,
          ...dotColors,
        },
      });

      return (
        <div {...blockProps}>
          <div className="appbuilder-multimedia-scroller__track">
            <InnerBlocks.Content />
          </div>
          {showDotIndicator ? (
            <div
              className={`appbuilder-multimedia-scroller__pagination appbuilder-multimedia-scroller__pagination--${positionClass} appbuilder-multimedia-scroller__pagination--${dotAlignment || 'center'}`}
              aria-hidden="true"
            />
          ) : null}
        </div>
      );
    },
  });
}

/**
 * Register multimedia-scroller parent + item child. Child registers first.
 */
export function registerAdvancedMultimediaScroller() {
  registerMultimediaScrollerItem();
  registerMultimediaScrollerParent();
}
