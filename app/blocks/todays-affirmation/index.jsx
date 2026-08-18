// @ts-nocheck
// Today's Affirmation — Banner clone (image + action, no audio).
import { registerBlockType } from 'gutenberg-block-kit/wp/blocks';
import {
  useBlockProps,
  InspectorControls,
  MediaUpload,
  MediaUploadCheck,
} from 'gutenberg-block-kit/wp/block-editor';
import { PanelBody, Button } from 'gutenberg-block-kit/wp/components';
import { ActionBuilder } from 'gutenberg-block-kit/actions';
import {
  contentTabStyle,
  imageAttributesFromMedia,
  clearImageAttributes,
} from '../inspector-shared';
import {
  STANDARD_TODAYS_AFFIRMATION_BLOCK,
  RIYASAT_CATEGORY,
} from '../constants';

function parseDimension(value, fallback = 0) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function getAffirmationImageStyle(imageWidth, imageHeight) {
  const style = {
    display: 'block',
    borderRadius: '8px',
    objectFit: 'cover',
    maxWidth: '100%',
  };

  if (imageWidth > 0) {
    style.width = `${imageWidth}px`;
  } else {
    style.width = '100%';
  }

  if (imageHeight > 0) {
    style.height = `${imageHeight}px`;
  } else {
    style.minHeight = '160px';
  }

  return style;
}

function getAffirmationPlaceholderStyle(imageWidth, imageHeight) {
  const style = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: '1px dashed rgba(0, 0, 0, 0.25)',
    borderRadius: '8px',
    color: '#6b7280',
    maxWidth: '100%',
  };

  if (imageWidth > 0) {
    style.width = `${imageWidth}px`;
  } else {
    style.width = '100%';
  }

  style.minHeight = imageHeight > 0 ? `${imageHeight}px` : '160px';
  return style;
}

function TodaysAffirmationIcon() {
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
        d="M12 2a7 7 0 0 1 7 7c0 4.5-3.5 8.2-7 11-3.5-2.8-7-6.5-7-11a7 7 0 0 1 7-7zm0 2a5 5 0 0 0-5 5c0 3.2 2.6 6.1 5 8.2 2.4-2.1 5-5 5-8.2a5 5 0 0 0-5-5zm0 3.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5z"
      />
    </svg>
  );
}

export function registerStandardTodaysAffirmation() {
  registerBlockType(STANDARD_TODAYS_AFFIRMATION_BLOCK, {
    apiVersion: 3,
    title: "Today's Affirmation",
    description: 'Affirmation banner with selectable image and action.',
    category: RIYASAT_CATEGORY,
    icon: TodaysAffirmationIcon,
    supports: { html: false, align: ['wide', 'full'] },
    attributes: {
      imageUrl: { type: 'string', default: '' },
      imageWidth: { type: 'number', default: 0 },
      imageHeight: { type: 'number', default: 0 },
      action: { type: 'object', default: {} },
    },

    edit: ({ attributes, setAttributes }) => {
      const { imageUrl, imageWidth, imageHeight, action } = attributes;
      const width = parseDimension(imageWidth);
      const height = parseDimension(imageHeight);
      const blockProps = useBlockProps({
        className: 'riyasat-todays-affirmation-editor',
      });

      return (
        <>
          <InspectorControls group="content">
            <div style={contentTabStyle}>
              <PanelBody title="Today's Affirmation" initialOpen={true}>
                <MediaUploadCheck>
                  <MediaUpload
                    onSelect={(media) =>
                      setAttributes(imageAttributesFromMedia(media))
                    }
                    allowedTypes={['image']}
                    render={({ open }) => (
                      <div>
                        <Button
                          onClick={open}
                          variant="secondary"
                          style={{ width: '100%', justifyContent: 'center' }}
                        >
                          {imageUrl ? 'Change image' : 'Add image'}
                        </Button>
                        {imageUrl ? (
                          <Button
                            onClick={() => setAttributes(clearImageAttributes())}
                            variant="link"
                            isDestructive
                            style={{ marginTop: '4px' }}
                          >
                            Remove image
                          </Button>
                        ) : null}
                      </div>
                    )}
                  />
                </MediaUploadCheck>
                <ActionBuilder
                  label="Affirmation action"
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
                style={getAffirmationImageStyle(width, height)}
              />
            ) : (
              <div style={getAffirmationPlaceholderStyle(width, height)}>
                Select affirmation image from sidebar
              </div>
            )}
          </div>
        </>
      );
    },

    save: ({ attributes }) => {
      const { imageUrl, imageWidth, imageHeight, action } = attributes;
      const width = parseDimension(imageWidth);
      const height = parseDimension(imageHeight);
      const blockProps = useBlockProps.save({
        className: 'riyasat-todays-affirmation',
        'data-image-width': `${width}`,
        'data-image-height': `${height}`,
        'data-action': JSON.stringify(action ?? {}),
      });

      return (
        <div {...blockProps}>
          {imageUrl ? (
            <img
              src={imageUrl}
              alt=""
              className="riyasat-todays-affirmation__image"
              style={getAffirmationImageStyle(width, height)}
            />
          ) : null}
        </div>
      );
    },
  });
}
