// @ts-nocheck
// Today's Meditation — single block (standard/todays-meditation).
import { registerBlockType } from 'gutenberg-block-kit/wp/blocks';
import {
  useBlockProps,
  InspectorControls,
  MediaUpload,
  MediaUploadCheck,
} from 'gutenberg-block-kit/wp/block-editor';
import { PanelBody, TextControl, Button } from 'gutenberg-block-kit/wp/components';
import { ActionBuilder } from 'gutenberg-block-kit/actions';
import {
  contentTabStyle,
  imageAttributesFromMedia,
  clearImageAttributes,
} from '../inspector-shared';
import {
  STANDARD_TODAYS_MEDITATION_BLOCK,
  RIYASAT_CATEGORY,
} from '../constants';

const DEFAULT_AUDIO_URL = 'https://example.com/audio.mp3';
const DEFAULT_IMAGE_URL = 'https://example.com/image.png';

function getMediaUrl(media) {
  return media?.url || media?.source_url || media?.src || '';
}

function TodaysMeditationIcon() {
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
        d="M12 3v10.1a4 4 0 1 0 2 3.46V8h4V5h-6V3zm-2 11.54v2.02A2 2 0 1 1 10 14.54z"
      />
    </svg>
  );
}

export function registerStandardTodaysMeditation() {
  registerBlockType(STANDARD_TODAYS_MEDITATION_BLOCK, {
    apiVersion: 3,
    title: "Today's Meditation",
    description: 'Meditation card with selectable audio, image and action.',
    category: RIYASAT_CATEGORY,
    icon: TodaysMeditationIcon,
    supports: { html: false, align: ['wide', 'full'] },
    attributes: {
      audioUrl: { type: 'string', default: DEFAULT_AUDIO_URL },
      imageUrl: { type: 'string', default: DEFAULT_IMAGE_URL },
      imageWidth: { type: 'number', default: 0 },
      imageHeight: { type: 'number', default: 0 },
      action: { type: 'object', default: {} },
    },

    edit: ({ attributes, setAttributes }) => {
      const { audioUrl, imageUrl, action } = attributes;
      const blockProps = useBlockProps({
        className: 'riyasat-todays-meditation-editor',
      });

      return (
        <>
          <InspectorControls group="content">
            <div style={contentTabStyle}>
              <PanelBody title="Today's Meditation" initialOpen={true}>
                <TextControl
                  label="Audio URL"
                  value={audioUrl}
                  onChange={(value) => setAttributes({ audioUrl: value })}
                />

                <MediaUploadCheck>
                  <MediaUpload
                    onSelect={(media) =>
                      setAttributes({ audioUrl: getMediaUrl(media) })
                    }
                    allowedTypes={['audio']}
                    render={({ open }) => (
                      <div style={{ marginBottom: '12px' }}>
                        <Button
                          onClick={open}
                          variant="secondary"
                          style={{ width: '100%', justifyContent: 'center' }}
                        >
                          {audioUrl ? 'Choose another audio file' : 'Choose audio file'}
                        </Button>
                        {audioUrl ? (
                          <Button
                            onClick={() => setAttributes({ audioUrl: '' })}
                            variant="link"
                            isDestructive
                          >
                            Clear audio
                          </Button>
                        ) : null}
                      </div>
                    )}
                  />
                </MediaUploadCheck>

                <MediaUploadCheck>
                  <MediaUpload
                    onSelect={(media) =>
                      setAttributes(imageAttributesFromMedia(media))
                    }
                    allowedTypes={['image']}
                    render={({ open }) => (
                      <div style={{ marginBottom: '12px' }}>
                        <Button
                          onClick={open}
                          variant="secondary"
                          style={{ width: '100%', justifyContent: 'center' }}
                        >
                          {imageUrl ? 'Change image' : 'Add image'}
                        </Button>
                        {imageUrl ? (
                          <Button
                            onClick={() =>
                              setAttributes(clearImageAttributes())
                            }
                            variant="link"
                            isDestructive
                          >
                            Remove image
                          </Button>
                        ) : null}
                      </div>
                    )}
                  />
                </MediaUploadCheck>

                <ActionBuilder
                  label="Action"
                  value={action ?? {}}
                  onChange={(next) => setAttributes({ action: next })}
                />
              </PanelBody>
            </div>
          </InspectorControls>

          <div {...blockProps}>
            {imageUrl ? (
              <img
                src={imageUrl}
                alt=""
                className="riyasat-todays-meditation-editor__image"
              />
            ) : (
              <div className="riyasat-todays-meditation-editor__placeholder">
                Add a meditation image
              </div>
            )}
            {audioUrl ? (
              <audio
                src={audioUrl}
                controls
                className="riyasat-todays-meditation-editor__audio"
              />
            ) : null}
          </div>
        </>
      );
    },

    save: ({ attributes }) => {
      const {
        audioUrl,
        imageUrl,
        imageWidth,
        imageHeight,
        action,
      } = attributes;
      const blockProps = useBlockProps.save({
        className: 'riyasat-todays-meditation',
        'data-audio-url': audioUrl || '',
        'data-image-url': imageUrl || '',
        'data-image-width': `${imageWidth || 0}`,
        'data-image-height': `${imageHeight || 0}`,
        'data-action': JSON.stringify(action ?? {}),
      });

      return (
        <div {...blockProps}>
          {imageUrl ? (
            <img
              src={imageUrl}
              alt=""
              className="riyasat-todays-meditation__image"
            />
          ) : null}
          {audioUrl ? (
            <audio
              src={audioUrl}
              controls
              className="riyasat-todays-meditation__audio"
            />
          ) : null}
        </div>
      );
    },
  });
}
