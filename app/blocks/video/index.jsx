// @ts-nocheck
// Standard Video — single block (standard/video) with media options.
import { registerBlockType } from 'gutenberg-block-kit/wp/blocks';
import {
  useBlockProps,
  InspectorControls,
  MediaUpload,
  MediaUploadCheck,
} from 'gutenberg-block-kit/wp/block-editor';
import {
  PanelBody,
  ToggleControl,
  RadioControl,
  Button,
} from 'gutenberg-block-kit/wp/components';
import { useEffect, useRef, useState } from 'gutenberg-block-kit/wp/element';
import { ActionBuilder } from 'gutenberg-block-kit/actions';
import { contentTabStyle } from '../inspector-shared';
import { STANDARD_VIDEO_BLOCK, RIYASAT_CATEGORY } from '../constants';
import { isVideoLikeMedia } from '../../lib/media-utils';

const DEFAULT_HEIGHT = 300;

function getPickedMediaUrl(media) {
  return (
    media?.url ||
    media?.source_url ||
    media?.src ||
    media?.link ||
    ''
  );
}

function getVideoAttributesFromMedia(media) {
  return {
    videoUrl: getPickedMediaUrl(media),
    height: media?.height > 0 ? media.height : DEFAULT_HEIGHT,
  };
}

function StandardVideoIcon() {
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
        d="M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zm6 4.2v7.6L16 12l-6-3.8z"
      />
    </svg>
  );
}

function isVideoMedia(media) {
  return isVideoLikeMedia({
    type: media?.type,
    mimeType: media?.mimeType,
    mime: media?.mime,
  });
}

export function registerStandardVideo() {
  registerBlockType(STANDARD_VIDEO_BLOCK, {
    apiVersion: 3,
    title: 'Video',
    description: 'Standard video section with thumbnail, playback options and action.',
    category: RIYASAT_CATEGORY,
    icon: StandardVideoIcon,
    supports: { html: false, align: ['wide', 'full'] },
    attributes: {
      thumbnailUrl: { type: 'string', default: '' },
      videoUrl: { type: 'string', default: '' },
      resizeMode: { type: 'string', default: 'cover' },
      control: { type: 'boolean', default: true },
      repeat: { type: 'boolean', default: false },
      paused: { type: 'boolean', default: false },
      playOnVisible: { type: 'boolean', default: true },
      muted: { type: 'boolean', default: false },
      height: { type: 'number', default: DEFAULT_HEIGHT },
      action: { type: 'object', default: {} },
    },

    edit: ({ attributes, setAttributes }) => {
      const {
        thumbnailUrl,
        videoUrl,
        resizeMode,
        control,
        repeat,
        paused,
        playOnVisible,
        muted,
        height,
        action,
      } = attributes;
      const blockProps = useBlockProps({ className: 'riyasat-standard-video-editor' });
      const videoElRef = useRef(null);
      const [isPlaying, setIsPlaying] = useState(false);

      useEffect(() => {
        setIsPlaying(false);
      }, [videoUrl, thumbnailUrl]);

      useEffect(() => {
        if (!isPlaying) return;
        const el = videoElRef.current;
        if (!el) return;
        const maybePromise = el.play?.();
        if (maybePromise && typeof maybePromise.catch === 'function') {
          maybePromise.catch(() => {});
        }
      }, [isPlaying]);

      return (
        <>
          <InspectorControls group="content">
            <div style={contentTabStyle}>
              <PanelBody title="Video" initialOpen={true}>
                <MediaUploadCheck>
                  <MediaUpload
                    onSelect={(media) =>
                      setAttributes({
                        thumbnailUrl: getPickedMediaUrl(media),
                        height: media?.height > 0 ? media.height : DEFAULT_HEIGHT,
                      })
                    }
                    allowedTypes={['image']}
                    render={({ open }) => (
                      <div style={{ marginBottom: '12px' }}>
                        <Button onClick={open} variant="secondary" style={{ width: '100%' }}>
                          {thumbnailUrl ? 'Change thumbnail' : 'Add thumbnail'}
                        </Button>
                        {thumbnailUrl ? (
                          <Button
                            onClick={() => setAttributes({ thumbnailUrl: '' })}
                            variant="link"
                            isDestructive
                          >
                            Remove thumbnail
                          </Button>
                        ) : null}
                      </div>
                    )}
                  />
                </MediaUploadCheck>

                <MediaUploadCheck>
                  <MediaUpload
                    onSelect={(media) => {
                      if (!isVideoMedia(media)) return;
                      setAttributes(getVideoAttributesFromMedia(media));
                    }}
                    allowedTypes={['video']}
                    render={({ open }) => (
                      <div style={{ marginBottom: '12px' }}>
                        <Button onClick={open} variant="secondary" style={{ width: '100%' }}>
                          {videoUrl ? 'Change video' : 'Add video'}
                        </Button>
                        {videoUrl ? (
                          <Button
                            onClick={() => setAttributes({ videoUrl: '' })}
                            variant="link"
                            isDestructive
                          >
                            Remove video
                          </Button>
                        ) : null}
                      </div>
                    )}
                  />
                </MediaUploadCheck>

                <RadioControl
                  label="Resize mode"
                  selected={resizeMode || 'cover'}
                  options={[
                    { label: 'Cover', value: 'cover' },
                    { label: 'Contain', value: 'contain' },
                  ]}
                  onChange={(value) => setAttributes({ resizeMode: value })}
                />

                <ToggleControl
                  label="Show controls"
                  checked={!!control}
                  onChange={(value) => setAttributes({ control: value })}
                />
                <ToggleControl
                  label="Repeat"
                  checked={!!repeat}
                  onChange={(value) => setAttributes({ repeat: value })}
                />
                <ToggleControl
                  label="Paused on load"
                  checked={!!paused}
                  onChange={(value) => setAttributes({ paused: value })}
                />
                <ToggleControl
                  label="Play on visible"
                  checked={!!playOnVisible}
                  onChange={(value) => setAttributes({ playOnVisible: value })}
                />
                <ToggleControl
                  label="Muted"
                  checked={!!muted}
                  onChange={(value) => setAttributes({ muted: value })}
                />

                <ActionBuilder
                  label="Video action"
                  value={action ?? {}}
                  onChange={(next) => setAttributes({ action: next })}
                />
              </PanelBody>
            </div>
          </InspectorControls>

          <div {...blockProps}>
            {/* No dedicated CMS UI required; simple preview only */}
            {videoUrl ? (
              thumbnailUrl && !isPlaying ? (
                <button
                  type="button"
                  onClick={() => setIsPlaying(true)}
                  style={{
                    position: 'relative',
                    width: '100%',
                    height: `${height || DEFAULT_HEIGHT}px`,
                    border: 'none',
                    padding: 0,
                    cursor: 'pointer',
                    background: '#000',
                  }}
                  aria-label="Play video"
                >
                  <img
                    src={thumbnailUrl}
                    alt=""
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: resizeMode || 'cover',
                      display: 'block',
                    }}
                  />
                  <span
                    style={{
                      position: 'absolute',
                      top: '50%',
                      left: '50%',
                      transform: 'translate(-50%, -50%)',
                      width: '56px',
                      height: '56px',
                      borderRadius: '999px',
                      background: 'rgba(0, 0, 0, 0.55)',
                      border: '2px solid rgba(255, 255, 255, 0.85)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <span
                      style={{
                        width: 0,
                        height: 0,
                        borderTop: '10px solid transparent',
                        borderBottom: '10px solid transparent',
                        borderLeft: '16px solid #fff',
                        marginLeft: '3px',
                      }}
                    />
                  </span>
                </button>
              ) : (
                <video
                  ref={videoElRef}
                  src={videoUrl}
                  poster={thumbnailUrl || undefined}
                  controls={!!control}
                  loop={!!repeat}
                  muted={!!muted}
                  autoPlay={isPlaying || !paused}
                  playsInline
                  style={{
                    width: '100%',
                    height: `${height || DEFAULT_HEIGHT}px`,
                    objectFit: resizeMode || 'cover',
                    display: 'block',
                  }}
                />
              )
            ) : (
              <div
                style={{
                  height: `${height || DEFAULT_HEIGHT}px`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: '1px dashed rgba(0, 0, 0, 0.25)',
                  color: '#6b7280',
                }}
              >
                Configure video from the right sidebar
              </div>
            )}
          </div>
        </>
      );
    },

    save: ({ attributes }) => {
      const {
        thumbnailUrl,
        videoUrl,
        resizeMode,
        control,
        repeat,
        paused,
        playOnVisible,
        muted,
        height,
        action,
      } = attributes;

      const blockProps = useBlockProps.save({
        className: 'riyasat-standard-video',
        'data-thumbnail-url': thumbnailUrl || '',
        'data-video-url': videoUrl || '',
        'data-resize-mode': resizeMode || 'cover',
        'data-control': control ? 'true' : 'false',
        'data-repeat': repeat ? 'true' : 'false',
        'data-paused': paused ? 'true' : 'false',
        'data-play-on-visible': playOnVisible ? 'true' : 'false',
        'data-muted': muted ? 'true' : 'false',
        'data-height': `${height ?? DEFAULT_HEIGHT}`,
        'data-action': JSON.stringify(action ?? {}),
      });

      return (
        <div {...blockProps}>
          {videoUrl ? (
            <video
              className="riyasat-standard-video__video"
              src={videoUrl}
              poster={thumbnailUrl || undefined}
              controls={!!control}
              loop={!!repeat}
              muted={!!muted}
              autoPlay={!paused}
              playsInline
              style={{
                width: '100%',
                height: `${height ?? DEFAULT_HEIGHT}px`,
                objectFit: resizeMode || 'cover',
                display: 'block',
              }}
            />
          ) : null}
        </div>
      );
    },
  });
}
