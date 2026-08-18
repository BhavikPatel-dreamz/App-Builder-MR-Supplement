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
import {
  PanelBody,
  TextControl,
  ToggleControl,
  Button,
} from 'gutenberg-block-kit/wp/components';
import { ActionBuilder } from 'gutenberg-block-kit/actions';
import { contentTabStyle } from '../inspector-shared';
import {
  BLOGS_BLOCK,
  BLOGS_ITEM_BLOCK,
  RIYASAT_CATEGORY,
} from '../constants';

const DEFAULT_IMAGE_URL =
  'https://www.woocommerce.com/wp-content/uploads/2024/06/visit-our-stores.jpg';
const DEFAULT_DATE = 'April 14, 2026';
const DEFAULT_TITLE = '8 Signs Your Shani Might Feel "Bhaari"';
const DEFAULT_BUTTON_TEXT = 'Read More';

function BlogsIcon() {
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
        d="M5 4h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zm0 2v12h14V6H5zm2 2h6v2H7V8zm0 4h10v2H7v-2zm0 4h8v2H7v-2z"
      />
    </svg>
  );
}

function registerBlogsItem() {
  registerBlockType(BLOGS_ITEM_BLOCK, {
    apiVersion: 3,
    title: 'Blogs Item',
    description: 'A single blog card item with image, date, title, button text and action.',
    category: RIYASAT_CATEGORY,
    parent: [BLOGS_BLOCK],
    icon: 'format-image',
    supports: { html: false, reusable: false },
    attributes: {
      imageUrl: { type: 'string', default: DEFAULT_IMAGE_URL },
      date: { type: 'string', default: DEFAULT_DATE },
      title: { type: 'string', default: DEFAULT_TITLE },
      buttonText: { type: 'string', default: DEFAULT_BUTTON_TEXT },
      action: { type: 'object', default: {} },
    },

    edit: ({ attributes, setAttributes }) => {
      const { imageUrl, date, title, buttonText, action } = attributes;
      const blockProps = useBlockProps({
        className: 'riyasat-blogs-item-editor',
      });

      return (
        <>
          <InspectorControls group="content">
            <div style={contentTabStyle}>
              <PanelBody title="Blog Item" initialOpen={true}>
                <MediaUploadCheck>
                  <MediaUpload
                    onSelect={(media) =>
                      setAttributes({
                        imageUrl: media?.url || '',
                      })}
                    allowedTypes={['image']}
                    render={({ open }) => (
                      <div style={{ marginBottom: '12px' }}>
                        <Button onClick={open} variant="secondary" style={{ width: '100%' }}>
                          {imageUrl ? 'Change image' : 'Add image'}
                        </Button>
                      </div>
                    )}
                  />
                </MediaUploadCheck>
                <TextControl
                  label="Date"
                  value={date}
                  onChange={(value) => setAttributes({ date: value })}
                />
                <TextControl
                  label="Title"
                  value={title}
                  onChange={(value) => setAttributes({ title: value })}
                />
                <TextControl
                  label="Button text"
                  value={buttonText}
                  onChange={(value) => setAttributes({ buttonText: value })}
                />
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
              <img src={imageUrl} alt="" className="riyasat-blogs__image" />
            ) : (
              <div className="riyasat-blogs-item-editor__placeholder">Add image</div>
            )}
            {date ? <p className="riyasat-blogs__date">{date}</p> : null}
            {title ? <p className="riyasat-blogs__item-title">{title}</p> : null}
            {buttonText ? (
              <span className="riyasat-blogs__button">{buttonText}</span>
            ) : null}
          </div>
        </>
      );
    },

    save: ({ attributes }) => {
      const { imageUrl, date, title, buttonText, action } = attributes;
      const blockProps = useBlockProps.save({
        className: 'riyasat-blogs__item',
        'data-action': JSON.stringify(action ?? {}),
      });

      return (
        <div {...blockProps}>
          {imageUrl ? <img src={imageUrl} alt="" className="riyasat-blogs__image" /> : null}
          {date ? <p className="riyasat-blogs__date">{date}</p> : null}
          {title ? <p className="riyasat-blogs__item-title">{title}</p> : null}
          {buttonText ? <span className="riyasat-blogs__button">{buttonText}</span> : null}
        </div>
      );
    },
  });
}

function registerBlogsParent() {
  registerBlockType(BLOGS_BLOCK, {
    apiVersion: 3,
    title: 'Blogs',
    description: 'Blog cards section with title, view-all toggle, background and action.',
    category: RIYASAT_CATEGORY,
    icon: BlogsIcon,
    supports: { html: false, align: ['wide', 'full'] },
    attributes: {
      title: { type: 'string', default: 'Blogs & Insights' },
      showViewAll: { type: 'boolean', default: true },
      backgroundColor: { type: 'string', default: '#f5f5f5' },
      action: { type: 'object', default: {} },
    },

    edit: ({ attributes, setAttributes }) => {
      const { title, showViewAll, backgroundColor, action } = attributes;
      const blockProps = useBlockProps({
        className: 'riyasat-blogs-editor',
        style: { backgroundColor: backgroundColor || '#f5f5f5' },
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
                <ToggleControl
                  label="Show View All"
                  checked={!!showViewAll}
                  onChange={(value) => setAttributes({ showViewAll: value })}
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
              title="Colors"
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
            <div className="riyasat-blogs">
              {title ? <h3 className="riyasat-blogs__title">{title}</h3> : null}
              {showViewAll ? (
                <span className="riyasat-blogs__view-all">View All</span>
              ) : null}
              <div className="riyasat-blogs__grid">
                <InnerBlocks
                  allowedBlocks={[BLOGS_ITEM_BLOCK]}
                  template={[
                    [BLOGS_ITEM_BLOCK, {}],
                    [BLOGS_ITEM_BLOCK, {}],
                    [BLOGS_ITEM_BLOCK, {}],
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
      const { title, showViewAll, backgroundColor, action } = attributes;
      const blockProps = useBlockProps.save({
        className: 'riyasat-blogs',
        'data-show-view-all': showViewAll ? 'true' : 'false',
        'data-action': JSON.stringify(action ?? {}),
        'data-background-color': backgroundColor || '#f5f5f5',
        style: { backgroundColor: backgroundColor || '#f5f5f5' },
      });

      return (
        <div {...blockProps}>
          {title ? <h3 className="riyasat-blogs__title">{title}</h3> : null}
          {showViewAll ? <span className="riyasat-blogs__view-all">View All</span> : null}
          <div className="riyasat-blogs__grid">
            <InnerBlocks.Content />
          </div>
        </div>
      );
    },
  });
}

export function registerBlogs() {
  registerBlogsItem();
  registerBlogsParent();
}
