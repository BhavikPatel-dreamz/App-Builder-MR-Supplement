// @ts-nocheck
// Standard Spacer — single block (standard/spacer).
import { registerBlockType } from 'gutenberg-block-kit/wp/blocks';
import {
  useBlockProps,
  InspectorControls,
} from 'gutenberg-block-kit/wp/block-editor';
import { PanelBody, TextControl } from 'gutenberg-block-kit/wp/components';
import { ActionBuilder } from 'gutenberg-block-kit/actions';
import { ColorSettingsPanel, contentTabStyle } from '../inspector-shared';
import { STANDARD_SPACER_BLOCK, APPBUILDER_CATEGORY } from '../constants';

const DEFAULT_HEIGHT = 20;
const DEFAULT_BACKGROUND = '#ffffff';

function StandardSpacerIcon() {
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
        d="M3 8h18v2H3V8zm0 6h18v2H3v-2z"
      />
    </svg>
  );
}

export function registerStandardSpacer() {
  registerBlockType(STANDARD_SPACER_BLOCK, {
    apiVersion: 3,
    title: 'Spacer',
    description: 'Adjustable spacer with height, background color, and action.',
    category: APPBUILDER_CATEGORY,
    icon: StandardSpacerIcon,
    supports: { html: false, align: ['wide', 'full'] },
    attributes: {
      height: { type: 'number', default: DEFAULT_HEIGHT },
      backgroundColor: { type: 'string', default: DEFAULT_BACKGROUND },
      action: { type: 'object', default: {} },
    },

    edit: ({ attributes, setAttributes }) => {
      const { height, backgroundColor, action } = attributes;
      const spacerHeight = Number.isFinite(height) ? height : DEFAULT_HEIGHT;
      const blockProps = useBlockProps({ className: 'appbuilder-standard-spacer-editor' });

      return (
        <>
          <InspectorControls group="content">
            <div style={contentTabStyle}>
              <PanelBody title="Spacer" initialOpen={true}>
                <TextControl
                  label="Height"
                  type="number"
                  value={String(spacerHeight)}
                  onChange={(value) =>
                    setAttributes({
                      height: Number.parseInt(value || `${DEFAULT_HEIGHT}`, 10),
                    })
                  }
                />
                <ActionBuilder
                  label="Spacer action"
                  value={action ?? {}}
                  onChange={(next) => setAttributes({ action: next })}
                />
              </PanelBody>
            </div>
          </InspectorControls>

          <InspectorControls>
            <PanelBody title="Settings" initialOpen={true}>
              <ColorSettingsPanel
                title="Colors"
                colorSettings={[
                  {
                    label: 'Background color',
                    value: backgroundColor,
                    onChange: (value) => {
                      if (value === undefined || value === null || value === '') {
                        return;
                      }
                      setAttributes({ backgroundColor: value });
                    },
                  },
                ]}
              />
            </PanelBody>
          </InspectorControls>

          <div {...blockProps}>
            <div
              className="appbuilder-standard-spacer"
              style={{
                height: `${spacerHeight}px`,
                background: backgroundColor || DEFAULT_BACKGROUND,
                border: '1px dashed rgba(0, 0, 0, 0.15)',
              }}
            />
          </div>
        </>
      );
    },

    save: ({ attributes }) => {
      const { height, backgroundColor, action } = attributes;
      const spacerHeight = Number.isFinite(height) ? height : DEFAULT_HEIGHT;
      const blockProps = useBlockProps.save({
        className: 'appbuilder-standard-spacer',
        'data-height': `${spacerHeight}`,
        'data-background-color': backgroundColor || DEFAULT_BACKGROUND,
        'data-action': JSON.stringify(action ?? {}),
        style: {
          height: `${spacerHeight}px`,
          background: backgroundColor || DEFAULT_BACKGROUND,
        },
      });
      return <div {...blockProps} />;
    },
  });
}
