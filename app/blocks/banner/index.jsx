// @ts-nocheck
// Standard Banner — single block (standard/banner) with image + action.
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
import { STANDARD_BANNER_BLOCK, RIYASAT_CATEGORY } from '../constants';

function parseDimension(value, fallback = 0) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function getBannerImageStyle(imageWidth, imageHeight) {
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

function getBannerPlaceholderStyle(imageWidth, imageHeight) {
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

function StandardBannerIcon() {
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
        d="M3 5h18a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1zm1 2v10h16V7H4zm2 2h8v2H6V9z"
      />
    </svg>
  );
}

export function registerStandardBanner() {
  registerBlockType(STANDARD_BANNER_BLOCK, {
    apiVersion: 3,
    title: 'Banner',
    description: 'Standard banner with selectable image and action.',
    category: RIYASAT_CATEGORY,
    icon: StandardBannerIcon,
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
      const blockProps = useBlockProps({ className: 'riyasat-standard-banner-editor' });

      return (
        <>
          <InspectorControls group="content">
            <div style={contentTabStyle}>
              <PanelBody title="Banner" initialOpen={true}>
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
                  label="Banner action"
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
                style={getBannerImageStyle(width, height)}
              />
            ) : (
              <div style={getBannerPlaceholderStyle(width, height)}>
                Select banner image from sidebar
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
        className: 'riyasat-standard-banner',
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
              className="riyasat-standard-banner__image"
              style={getBannerImageStyle(width, height)}
            />
          ) : null}
        </div>
      );
    },
  });
}
