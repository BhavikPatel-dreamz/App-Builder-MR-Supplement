// @ts-nocheck
import { registerBlockType } from 'gutenberg-block-kit/wp/blocks';
import { useBlockProps, InspectorControls } from 'gutenberg-block-kit/wp/block-editor';
import { PanelBody, TextareaControl } from 'gutenberg-block-kit/wp/components';
import { ActionBuilder } from 'gutenberg-block-kit/actions';
import { contentTabStyle } from '../inspector-shared';
import { STANDARD_HTML_BLOCK, RIYASAT_CATEGORY } from '../constants';

const DEFAULT_HTML_TEXT = `<!DOCTYPE html>
<html>
<body>

<h1>This is heading 1</h1>
<h2>This is heading 2</h2>
<h3>This is heading 3</h3>
<h4>This is heading 4</h4>
<h5>This is heading 5</h5>
<h6>This is heading 6</h6>

</body>
</html>
`;

function HtmlIcon() {
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
        d="M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zm5.2 4.4L7.1 12l2.1 3.6 1.7-1L9.4 12l1.5-2.6-1.7-1zm5.6 0-1.7 1 1.5 2.6-1.5 2.6 1.7 1 2.1-3.6-2.1-3.6z"
      />
    </svg>
  );
}

export function registerStandardHtml() {
  registerBlockType(STANDARD_HTML_BLOCK, {
    apiVersion: 3,
    title: 'Html',
    description: 'Custom HTML content with action metadata.',
    category: RIYASAT_CATEGORY,
    icon: HtmlIcon,
    supports: { html: false, align: ['wide', 'full'] },
    attributes: {
      htmlText: { type: 'string', default: DEFAULT_HTML_TEXT },
      action: { type: 'object', default: {} },
    },

    edit: ({ attributes, setAttributes }) => {
      const { htmlText, action } = attributes;
      const blockProps = useBlockProps({ className: 'riyasat-standard-html-editor' });

      return (
        <>
          <InspectorControls group="content">
            <div style={contentTabStyle}>
              <PanelBody title="Html" initialOpen={true}>
                <TextareaControl
                  label="HTML text"
                  rows={12}
                  value={htmlText}
                  onChange={(value) => setAttributes({ htmlText: value })}
                />
                <ActionBuilder
                  label="Action"
                  value={action ?? {}}
                  onChange={(next) => setAttributes({ action: next })}
                />
              </PanelBody>
            </div>
          </InspectorControls>

          <div {...blockProps}>
            <pre className="riyasat-standard-html-editor__preview">
              {htmlText || ''}
            </pre>
          </div>
        </>
      );
    },

    save: ({ attributes }) => {
      const { htmlText, action } = attributes;
      const blockProps = useBlockProps.save({
        className: 'riyasat-standard-html',
        'data-html-text': htmlText || '',
        'data-action': JSON.stringify(action ?? {}),
      });

      return <div {...blockProps}>{htmlText || ''}</div>;
    },
  });
}
