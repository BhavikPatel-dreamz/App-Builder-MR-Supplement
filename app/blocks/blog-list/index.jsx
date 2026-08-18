// @ts-nocheck
// Blogs List — single block (standard/blog-list).
import { registerBlockType } from 'gutenberg-block-kit/wp/blocks';
import {
  useBlockProps,
  InspectorControls,
  PanelColorSettings,
} from 'gutenberg-block-kit/wp/block-editor';
import { PanelBody, TextControl } from 'gutenberg-block-kit/wp/components';
import { ActionBuilder } from 'gutenberg-block-kit/actions';
import { contentTabStyle } from '../inspector-shared';
import { STANDARD_BLOG_LIST_BLOCK, RIYASAT_CATEGORY } from '../constants';

const DEFAULT_BACKGROUND_COLOR = '#ffffff';
const DEFAULT_TITLE = 'Blogs & Insights';

function BlogListIcon() {
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
        d="M5 4h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zm0 2v12h14V6H5zm2 2h10v2H7V8zm0 4h10v2H7v-2zm0 4h7v2H7v-2z"
      />
    </svg>
  );
}

export function registerStandardBlogList() {
  registerBlockType(STANDARD_BLOG_LIST_BLOCK, {
    apiVersion: 3,
    title: 'Blogs List',
    description: 'Blogs list section with title, background color and action.',
    category: RIYASAT_CATEGORY,
    icon: BlogListIcon,
    supports: { html: false, align: ['wide', 'full'] },
    attributes: {
      backgroundColor: { type: 'string', default: DEFAULT_BACKGROUND_COLOR },
      title: { type: 'string', default: DEFAULT_TITLE },
      action: { type: 'object', default: {} },
    },

    edit: ({ attributes, setAttributes }) => {
      const { backgroundColor, title, action } = attributes;
      const blockProps = useBlockProps({
        className: 'riyasat-blog-list-editor',
        style: {
          background: backgroundColor || DEFAULT_BACKGROUND_COLOR,
          padding: '16px',
        },
      });

      return (
        <>
          <InspectorControls group="content">
            <div style={contentTabStyle}>
              <PanelBody title="Blogs List" initialOpen={true}>
                <TextControl
                  label="Title"
                  value={title}
                  onChange={(value) => setAttributes({ title: value })}
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
                  value: backgroundColor || DEFAULT_BACKGROUND_COLOR,
                  onChange: (value) =>
                    setAttributes({
                      backgroundColor: value || DEFAULT_BACKGROUND_COLOR,
                    }),
                },
              ]}
            />
          </InspectorControls>

          <div {...blockProps}>
            <h3 className="riyasat-blog-list__title" style={{ margin: 0 }}>
              {title || DEFAULT_TITLE}
            </h3>
          </div>
        </>
      );
    },

    save: ({ attributes }) => {
      const { backgroundColor, title, action } = attributes;
      const blockProps = useBlockProps.save({
        className: 'riyasat-blog-list',
        'data-background-color': backgroundColor || DEFAULT_BACKGROUND_COLOR,
        'data-action': JSON.stringify(action ?? {}),
        style: { background: backgroundColor || DEFAULT_BACKGROUND_COLOR },
      });

      return (
        <div {...blockProps}>
          {title ? <h3 className="riyasat-blog-list__title">{title}</h3> : null}
        </div>
      );
    },
  });
}
