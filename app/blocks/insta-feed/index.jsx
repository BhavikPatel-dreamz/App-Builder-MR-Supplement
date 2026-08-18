// @ts-nocheck
import { registerBlockType } from 'gutenberg-block-kit/wp/blocks';
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
import { contentTabStyle } from '../inspector-shared';
import {
  INSTA_FEED_BLOCK,
  INSTA_FEED_ITEM_BLOCK,
  RIYASAT_CATEGORY,
} from '../constants';

function InstaFeedIcon() {
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
        d="M7.5 3h9A4.5 4.5 0 0 1 21 7.5v9a4.5 4.5 0 0 1-4.5 4.5h-9A4.5 4.5 0 0 1 3 16.5v-9A4.5 4.5 0 0 1 7.5 3zm0 1.8A2.7 2.7 0 0 0 4.8 7.5v9a2.7 2.7 0 0 0 2.7 2.7h9a2.7 2.7 0 0 0 2.7-2.7v-9a2.7 2.7 0 0 0-2.7-2.7h-9zM12 8a4 4 0 1 1 0 8 4 4 0 0 1 0-8zm0 1.8a2.2 2.2 0 1 0 0 4.4 2.2 2.2 0 0 0 0-4.4zm4.8-3a1.2 1.2 0 1 1 0 2.4 1.2 1.2 0 0 1 0-2.4z"
      />
    </svg>
  );
}

function registerInstaFeedItem() {
  registerBlockType(INSTA_FEED_ITEM_BLOCK, {
    apiVersion: 3,
    title: 'Insta Feed Item',
    description: 'A single Instagram image tile with optional tap action.',
    category: RIYASAT_CATEGORY,
    parent: [INSTA_FEED_BLOCK],
    icon: 'format-image',
    supports: { html: false, reusable: false },
    attributes: {
      imageUrl: {
        type: 'string',
        default:
          'https://www.woocommerce.com/wp-content/uploads/2024/06/visit-our-stores.jpg',
      },
      action: { type: 'object', default: {} },
    },

    edit: ({ attributes, setAttributes }) => {
      const { imageUrl, action } = attributes;
      const blockProps = useBlockProps({
        className: 'riyasat-insta-feed-item-editor',
      });

      return (
        <>
          <InspectorControls group="content">
            <div style={contentTabStyle}>
              <PanelBody title="Item" initialOpen={true}>
                <MediaUploadCheck>
                  <MediaUpload
                    onSelect={(media) =>
                      setAttributes({
                        imageUrl: media?.url || '',
                      })}
                    allowedTypes={['image']}
                    render={({ open }) => (
                      <div style={{ marginBottom: 8 }}>
                        <Button onClick={open} variant="secondary" style={{ width: '100%' }}>
                          {imageUrl ? 'Change image' : 'Add image'}
                        </Button>
                      </div>
                    )}
                  />
                </MediaUploadCheck>
                <ActionBuilder
                  label="Tap action"
                  value={action ?? {}}
                  onChange={(next) => setAttributes({ action: next })}
                />
              </PanelBody>
            </div>
          </InspectorControls>

          <div {...blockProps}>
            {imageUrl ? (
              <img src={imageUrl} alt="" className="riyasat-insta-feed__image" />
            ) : (
              <div className="riyasat-insta-feed-item-editor__placeholder">Add image</div>
            )}
          </div>
        </>
      );
    },

    save: ({ attributes }) => {
      const { imageUrl, action } = attributes;
      const blockProps = useBlockProps.save({
        className: 'riyasat-insta-feed__item',
        'data-action': JSON.stringify(action ?? {}),
      });

      return (
        <div {...blockProps}>
          {imageUrl ? <img src={imageUrl} alt="" className="riyasat-insta-feed__image" /> : null}
        </div>
      );
    },
  });
}

function registerInstaFeedParent() {
  registerBlockType(INSTA_FEED_BLOCK, {
    apiVersion: 3,
    title: 'Insta Feed',
    description: 'Instagram feed tiles with heading, link and action.',
    category: RIYASAT_CATEGORY,
    icon: InstaFeedIcon,
    supports: { html: false, align: ['wide', 'full'] },
    attributes: {
      title: { type: 'string', default: 'Follow us on Instagram' },
      link: { type: 'string', default: 'https://houseofgoodvibes.in' },
      backgroundColor: { type: 'string', default: '#f5f5f5' },
      action: { type: 'object', default: {} },
    },

    edit: ({ attributes, setAttributes }) => {
      const { title, link, backgroundColor, action } = attributes;
      const blockProps = useBlockProps({
        className: 'riyasat-insta-feed-editor',
        style: { backgroundColor },
      });

      return (
        <>
          <InspectorControls group="content">
            <div style={contentTabStyle}>
              <PanelBody title="Content" initialOpen={true}>
                <TextControl
                  label="Title"
                  value={title}
                  onChange={(value) => setAttributes({ title: value })}
                />
                <TextControl
                  label="Link"
                  value={link}
                  onChange={(value) => setAttributes({ link: value })}
                />
                <ActionBuilder
                  label="Action"
                  value={action ?? {}}
                  onChange={(next) => setAttributes({ action: next })}
                />
              </PanelBody>
            </div>
          </InspectorControls>

          <InspectorControls>
            <PanelColorSettings
              title="Color"
              colorSettings={[
                {
                  label: 'Background color',
                  value: backgroundColor,
                  onChange: (value) =>
                    setAttributes({ backgroundColor: value || '#f5f5f5' }),
                },
              ]}
            />
          </InspectorControls>

          <div {...blockProps}>
            <div className="riyasat-insta-feed">
              {title ? <h3 className="riyasat-insta-feed__title">{title}</h3> : null}
              {link ? <p className="riyasat-insta-feed__link">{link}</p> : null}
              <div className="riyasat-insta-feed__grid">
                <InnerBlocks
                  allowedBlocks={[INSTA_FEED_ITEM_BLOCK]}
                  template={[
                    [INSTA_FEED_ITEM_BLOCK, {}],
                    [INSTA_FEED_ITEM_BLOCK, {}],
                    [INSTA_FEED_ITEM_BLOCK, {}],
                  ]}
                  templateLock={false}
                  renderAppender={InnerBlocks.ButtonBlockAppender}
                />
              </div>
            </div>
          </div>
        </>
      );
    },

    save: ({ attributes }) => {
      const { title, link, backgroundColor, action } = attributes;
      const blockProps = useBlockProps.save({
        className: 'riyasat-insta-feed',
        'data-link': link || '',
        'data-action': JSON.stringify(action ?? {}),
        'data-background-color': backgroundColor || '#f5f5f5',
        style: { backgroundColor: backgroundColor || '#f5f5f5' },
      });

      return (
        <div {...blockProps}>
          {title ? <h3 className="riyasat-insta-feed__title">{title}</h3> : null}
          {link ? <p className="riyasat-insta-feed__link">{link}</p> : null}
          <div className="riyasat-insta-feed__grid">
            <InnerBlocks.Content />
          </div>
        </div>
      );
    },
  });
}

export function registerInstaFeed() {
  registerInstaFeedItem();
  registerInstaFeedParent();
}
