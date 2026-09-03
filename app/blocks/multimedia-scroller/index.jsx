// @ts-nocheck
import { useState } from "gutenberg-block-kit/wp/element";
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
  PanelBody,
  ToggleControl,
  TextControl,
  SelectControl,
  Button,
} from "gutenberg-block-kit/wp/components";
import { ActionBuilder } from "gutenberg-block-kit/actions";
import {
  SliderPaginationDots,
  useCarouselPagination,
} from "../inspector-shared";
import { isVideoLikeMedia } from "../../lib/media-utils";
import {
  MULTIMEDIA_SCROLLER_BLOCK,
  MULTIMEDIA_SCROLLER_ITEM_BLOCK,
  APPBUILDER_CATEGORY,
} from "../constants";

const DEFAULT_ACTIVE_DOT = "#FFFFFF";
const DEFAULT_INACTIVE_DOT = "#000000";
const DEFAULT_DELAY = 1000;
const DEFAULT_POSITION = "center";

function toNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function mediaDimension(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function mediaFromSelection(selected) {
  const imageWidth = mediaDimension(selected?.width);
  const imageHeight = mediaDimension(selected?.height);
  return {
    url: selected?.url ?? selected?.src ?? '',
    type: selected?.mime ?? selected?.type ?? '',
    imageWidth,
    imageHeight,
  };
}

function itemMediaAttributes(selected) {
  return { media: mediaFromSelection(selected) };
}

function mediaForSave(media) {
  return {
    url: media?.url ?? '',
    type: media?.type ?? '',
    imageWidth: mediaDimension(media?.imageWidth ?? media?.width),
    imageHeight: mediaDimension(media?.imageHeight ?? media?.height),
  };
}

function clearItemMediaAttributes() {
  return { media: {} };
}

function getMediaUrl(media) {
  return media?.url || "";
}

function isSlideVideo(media) {
  if (!media?.url) return false;
  const rawType = String(media.type || media.mime || "").toLowerCase();
  if (rawType.includes("video")) return true;
  if (/\.(mp4|webm|ogg|mov|m4v)(\?.*)?$/i.test(String(media.url))) return true;
  return isVideoLikeMedia({ type: media.type, mime: media.type });
}

function SlideMediaPicker({ media, onSelect, onClear }) {
  const mediaUrl = getMediaUrl(media);
  const isVideo = isSlideVideo(media);

  return (
    <MediaUploadCheck>
      <MediaUpload
        onSelect={(selected) => onSelect(mediaFromSelection(selected))}
        allowedTypes={["image", "video"]}
        render={({ open }) => (
          <div>
            {mediaUrl ? (
              <div
                onClick={open}
                style={{
                  marginBottom: "8px",
                  borderRadius: "6px",
                  overflow: "hidden",
                  cursor: "pointer",
                  border: "1px solid #ddd",
                }}
              >
                {isVideo ? (
                  <video
                    src={mediaUrl}
                    muted
                    playsInline
                    style={{
                      width: "100%",
                      height: "80px",
                      objectFit: "cover",
                      display: "block",
                    }}
                  />
                ) : (
                  <img
                    src={mediaUrl}
                    alt=""
                    style={{
                      width: "100%",
                      height: "80px",
                      objectFit: "cover",
                      display: "block",
                    }}
                  />
                )}
              </div>
            ) : null}
            <Button onClick={open} variant="secondary" style={{ width: "100%" }}>
              {mediaUrl ? "Change media" : "Add image or video"}
            </Button>
            {mediaUrl && onClear ? (
              <Button
                onClick={onClear}
                variant="link"
                isDestructive
                style={{ marginTop: "4px" }}
              >
                Remove media
              </Button>
            ) : null}
          </div>
        )}
      />
    </MediaUploadCheck>
  );
}

function registerMultimediaScrollerItem() {
  registerBlockType(MULTIMEDIA_SCROLLER_ITEM_BLOCK, {
    apiVersion: 3,
    title: "Multimedia Scroller Item",
    category: APPBUILDER_CATEGORY,
    parent: [MULTIMEDIA_SCROLLER_BLOCK],
    icon: "format-image",
    supports: { html: false, reusable: false },
    attributes: {
      media: { type: "object", default: {} },
      action: { type: "object", default: {} },
    },
    edit: ({ attributes, setAttributes }) => {
      const { media, action } = attributes;
      const mediaUrl = getMediaUrl(media);
      const blockProps = useBlockProps({
        className: "appbuilder-multimedia-scroller-item-editor",
      });

      return (
        <>
          <InspectorControls>
            <PanelBody title="Slide" initialOpen>
              <SlideMediaPicker
                media={media}
                onSelect={(next) => setAttributes({ media: next })}
                onClear={() => setAttributes(clearItemMediaAttributes())}
              />
              <ActionBuilder
                label="Action"
                value={action ?? {}}
                onChange={(next) => setAttributes({ action: next })}
              />
            </PanelBody>
          </InspectorControls>
          <div {...blockProps}>
            <MediaUploadCheck>
              <MediaUpload
                onSelect={(selected) =>
                  setAttributes(itemMediaAttributes(selected))
                }
                allowedTypes={["image", "video"]}
                render={({ open }) =>
                  mediaUrl ? (
                    isSlideVideo(media) ? (
                      <video
                        src={mediaUrl}
                        className="appbuilder-multimedia-scroller-item-editor__video"
                        muted
                        playsInline
                        onClick={open}
                      />
                    ) : (
                      <img
                        src={mediaUrl}
                        alt=""
                        className="appbuilder-multimedia-scroller-item-editor__image"
                        onClick={open}
                      />
                    )
                  ) : (
                    <button
                      type="button"
                      className="appbuilder-multimedia-scroller-item-editor__placeholder"
                      onClick={open}
                    >
                      Click to add image or video
                    </button>
                  )
                }
              />
            </MediaUploadCheck>
          </div>
        </>
      );
    },
    save: ({ attributes }) => {
      const { media, action } = attributes;
      const mediaUrl = getMediaUrl(media);
      const mediaPayload = mediaForSave(media);
      const blockProps = useBlockProps.save({
        className: "appbuilder-multimedia-scroller-item",
        "data-media": JSON.stringify(mediaPayload),
        "data-action": JSON.stringify(action ?? {}),
      });
      return (
        <div {...blockProps}>
          {mediaUrl ? (
            isSlideVideo(media) ? (
              <video
                src={mediaUrl}
                className="appbuilder-multimedia-scroller__video"
                muted
                playsInline
              />
            ) : (
              <img
                src={mediaUrl}
                alt=""
                className="appbuilder-multimedia-scroller__image"
              />
            )
          ) : null}
        </div>
      );
    },
  });
}

function registerMultimediaScrollerParent() {
  registerBlockType(MULTIMEDIA_SCROLLER_BLOCK, {
    apiVersion: 3,
    title: "MultiMedia Scroller",
    category: APPBUILDER_CATEGORY,
    icon: "slides",
    supports: { html: false, align: ["wide", "full"] },
    attributes: {
      showDotIndicator: { type: "boolean", default: true },
      showDotIndicatorOnImage: { type: "boolean", default: true },
      // JSON / mobile contract uses this misspelled key.
      dotIndicatorPosistion: { type: "string", default: DEFAULT_POSITION },
      activeDotColor: { type: "string", default: DEFAULT_ACTIVE_DOT },
      inActiveDotColor: { type: "string", default: DEFAULT_INACTIVE_DOT },
      enableAutoSlide: { type: "boolean", default: true },
      autoSlideDelay: { type: "number", default: DEFAULT_DELAY },
      inActiveDotBorderRadius: { type: "number", default: 5 },
      inActiveDotBorderColor: { type: "string", default: "#ffffff" },
    },
    edit: ({ attributes, setAttributes, clientId }) => {
      const {
        showDotIndicator,
        showDotIndicatorOnImage,
        dotIndicatorPosistion,
        activeDotColor,
        inActiveDotColor,
        enableAutoSlide,
        autoSlideDelay,
        inActiveDotBorderRadius,
        inActiveDotBorderColor,
      } = attributes;
      const [activeIndex, setActiveIndex] = useState(0);
      const { slideCount, goToSlide } = useCarouselPagination(
        clientId,
        activeIndex,
        setActiveIndex,
      );
      const delay = toNumber(autoSlideDelay, DEFAULT_DELAY);
      const inactiveRadius = toNumber(inActiveDotBorderRadius, 5);
      const overlayClass = showDotIndicatorOnImage
        ? "bottom-overlay"
        : "bottom";
      const alignClass = ["left", "center", "right"].includes(
        dotIndicatorPosistion,
      )
        ? dotIndicatorPosistion
        : DEFAULT_POSITION;
      const dotVars = {
        "--appbuilder-multimedia-scroller-pagination-active":
          activeDotColor || DEFAULT_ACTIVE_DOT,
        "--appbuilder-multimedia-scroller-pagination-inactive":
          inActiveDotColor || "transparent",
        "--appbuilder-multimedia-scroller-inactive-dot-radius":
          `${inactiveRadius}px`,
        "--appbuilder-multimedia-scroller-inactive-dot-border":
          inActiveDotBorderColor || "#ffffff",
      };
      const blockProps = useBlockProps({
        className: "appbuilder-multimedia-scroller-editor appbuilder-mms-simple",
        style: dotVars,
      });

      return (
        <>
          <InspectorControls>
            <PanelBody title="Scroller" initialOpen>
              <ToggleControl
                label="Show Dot Indicator"
                checked={!!showDotIndicator}
                onChange={(value) =>
                  setAttributes({ showDotIndicator: value })
                }
              />
              <ToggleControl
                label="Show Dot Indicator On Image"
                checked={!!showDotIndicatorOnImage}
                onChange={(value) =>
                  setAttributes({ showDotIndicatorOnImage: value })
                }
              />
              {showDotIndicator ? (
                <SelectControl
                  label="Dot Indicator Position"
                  value={alignClass}
                  options={[
                    { label: "Left", value: "left" },
                    { label: "Center", value: "center" },
                    { label: "Right", value: "right" },
                  ]}
                  onChange={(value) =>
                    setAttributes({ dotIndicatorPosistion: value })
                  }
                />
              ) : null}
              <ToggleControl
                label="Enable Auto Slide"
                checked={!!enableAutoSlide}
                onChange={(value) =>
                  setAttributes({ enableAutoSlide: value })
                }
              />
              {enableAutoSlide ? (
                <TextControl
                  label="Auto Slide Delay"
                  type="number"
                  value={delay}
                  onChange={(value) =>
                    setAttributes({
                      autoSlideDelay: toNumber(value, DEFAULT_DELAY),
                    })
                  }
                />
              ) : null}
              <TextControl
                label="Inactive Dot Border Radius"
                type="number"
                value={inactiveRadius}
                onChange={(value) =>
                  setAttributes({
                    inActiveDotBorderRadius: toNumber(value, 5),
                  })
                }
              />
            </PanelBody>
            <PanelColorSettings
              title="Dot Colors"
              colorSettings={[
                {
                  label: "Active Dot Color",
                  value: activeDotColor || DEFAULT_ACTIVE_DOT,
                  onChange: (value) =>
                    setAttributes({
                      activeDotColor: value || DEFAULT_ACTIVE_DOT,
                    }),
                },
                {
                  label: "Inactive Dot Color",
                  value: inActiveDotColor || DEFAULT_INACTIVE_DOT,
                  onChange: (value) =>
                    setAttributes({
                      inActiveDotColor: value || DEFAULT_INACTIVE_DOT,
                    }),
                },
                {
                  label: "Inactive Dot Border Color",
                  value: inActiveDotBorderColor || "#ffffff",
                  onChange: (value) =>
                    setAttributes({
                      inActiveDotBorderColor: value || "#ffffff",
                    }),
                },
              ]}
            />
          </InspectorControls>
          <div {...blockProps}>
            <div className="appbuilder-multimedia-scroller">
              <div
                className="appbuilder-multimedia-scroller__track"
                data-active-index={activeIndex}
              >
                <InnerBlocks
                  allowedBlocks={[MULTIMEDIA_SCROLLER_ITEM_BLOCK]}
                  template={[
                    [MULTIMEDIA_SCROLLER_ITEM_BLOCK, {}],
                    [MULTIMEDIA_SCROLLER_ITEM_BLOCK, {}],
                    [MULTIMEDIA_SCROLLER_ITEM_BLOCK, {}],
                  ]}
                  templateLock={false}
                  renderAppender={InnerBlocks.ButtonBlockAppender}
                />
              </div>
              {showDotIndicator && slideCount > 1 ? (
                <SliderPaginationDots
                  count={slideCount}
                  activeIndex={activeIndex}
                  onSelect={goToSlide}
                  className={`appbuilder-multimedia-scroller__pagination appbuilder-multimedia-scroller__pagination--${overlayClass} appbuilder-multimedia-scroller__pagination--${alignClass}`}
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
        dotIndicatorPosistion,
        activeDotColor,
        inActiveDotColor,
        enableAutoSlide,
        autoSlideDelay,
        inActiveDotBorderRadius,
        inActiveDotBorderColor,
      } = attributes;
      const overlayClass = showDotIndicatorOnImage
        ? "bottom-overlay"
        : "bottom";
      const alignClass = ["left", "center", "right"].includes(
        dotIndicatorPosistion,
      )
        ? dotIndicatorPosistion
        : DEFAULT_POSITION;
      const inactiveRadius = toNumber(inActiveDotBorderRadius, 5);
      const blockProps = useBlockProps.save({
        className: "appbuilder-multimedia-scroller appbuilder-mms-simple",
        "data-show-dot-indicator": String(!!showDotIndicator),
        "data-show-dot-indicator-on-image": String(!!showDotIndicatorOnImage),
        "data-dot-indicator-posistion": alignClass,
        "data-active-dot-color": activeDotColor || DEFAULT_ACTIVE_DOT,
        "data-inactive-dot-color": inActiveDotColor || DEFAULT_INACTIVE_DOT,
        "data-enable-auto-slide": String(!!enableAutoSlide),
        "data-auto-slide-delay": String(
          toNumber(autoSlideDelay, DEFAULT_DELAY),
        ),
        "data-inactive-dot-border-radius": String(inactiveRadius),
        "data-inactive-dot-border-color": inActiveDotBorderColor || "#ffffff",
        style: {
          "--appbuilder-multimedia-scroller-pagination-active":
            activeDotColor || DEFAULT_ACTIVE_DOT,
          "--appbuilder-multimedia-scroller-pagination-inactive":
            inActiveDotColor || "transparent",
          "--appbuilder-multimedia-scroller-inactive-dot-radius":
            `${inactiveRadius}px`,
          "--appbuilder-multimedia-scroller-inactive-dot-border":
            inActiveDotBorderColor || "#ffffff",
        },
      });
      return (
        <div {...blockProps}>
          <div className="appbuilder-multimedia-scroller__track">
            <InnerBlocks.Content />
          </div>
          {showDotIndicator ? (
            <div
              className={`appbuilder-multimedia-scroller__pagination appbuilder-multimedia-scroller__pagination--${overlayClass} appbuilder-multimedia-scroller__pagination--${alignClass}`}
              aria-hidden="true"
            />
          ) : null}
        </div>
      );
    },
  });
}

export function registerMultimediaScroller() {
  registerMultimediaScrollerItem();
  registerMultimediaScrollerParent();
}
