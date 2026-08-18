// @ts-nocheck
import { registerBlockType } from 'gutenberg-block-kit/wp/blocks';
import {
  useBlockProps,
  InspectorControls,
  PanelColorSettings,
} from 'gutenberg-block-kit/wp/block-editor';
import {
  PanelBody,
  TextControl,
  TextareaControl,
  SelectControl,
} from 'gutenberg-block-kit/wp/components';
import { ActionBuilder } from 'gutenberg-block-kit/actions';
import { STANDARD_TEXT_BLOCK, RIYASAT_CATEGORY } from '../constants';

const DEFAULT_TEXT = 'Hello, World!';
const DEFAULT_FONT_SIZE = 16;
const DEFAULT_FONT_COLOR = '#000000';
const DEFAULT_BACKGROUND = '#ffffff';
const DEFAULT_PADDING = 10;

function toNonNegativeNumber(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return fallback;
  }
  return parsed;
}

function TextIcon() {
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
        d="M4 5h16v3h-1.5V6.5h-5V19h2.5v1.5h-8V19H10.5V6.5h-5V8H4V5z"
      />
    </svg>
  );
}

export function registerStandardText() {
  registerBlockType(STANDARD_TEXT_BLOCK, {
    apiVersion: 3,
    title: 'Text',
    description: 'Plain text with typography, spacing and action settings.',
    category: RIYASAT_CATEGORY,
    icon: TextIcon,
    supports: { html: false, align: ['wide', 'full'] },
    attributes: {
      text: { type: 'string', default: DEFAULT_TEXT },
      fontSize: { type: 'number', default: DEFAULT_FONT_SIZE },
      fontColor: { type: 'string', default: DEFAULT_FONT_COLOR },
      backgroundColor: { type: 'string', default: DEFAULT_BACKGROUND },
      paddingTop: { type: 'number', default: DEFAULT_PADDING },
      paddingBottom: { type: 'number', default: DEFAULT_PADDING },
      paddingLeft: { type: 'number', default: DEFAULT_PADDING },
      paddingRight: { type: 'number', default: DEFAULT_PADDING },
      textAlign: { type: 'string', default: 'left' },
      fontWeight: { type: 'string', default: 'normal' },
      action: { type: 'object', default: {} },
    },

    edit: ({ attributes, setAttributes }) => {
      const {
        text,
        fontSize,
        fontColor,
        backgroundColor,
        paddingTop,
        paddingBottom,
        paddingLeft,
        paddingRight,
        textAlign,
        fontWeight,
        action,
      } = attributes;

      const blockProps = useBlockProps({
        className: 'riyasat-standard-text-editor',
      });

      const resolvedStyle = {
        fontSize: `${toNonNegativeNumber(fontSize, DEFAULT_FONT_SIZE)}px`,
        color: fontColor || DEFAULT_FONT_COLOR,
        backgroundColor: backgroundColor || DEFAULT_BACKGROUND,
        paddingTop: `${toNonNegativeNumber(paddingTop, DEFAULT_PADDING)}px`,
        paddingBottom: `${toNonNegativeNumber(paddingBottom, DEFAULT_PADDING)}px`,
        paddingLeft: `${toNonNegativeNumber(paddingLeft, DEFAULT_PADDING)}px`,
        paddingRight: `${toNonNegativeNumber(paddingRight, DEFAULT_PADDING)}px`,
        textAlign: textAlign || 'left',
        fontWeight: fontWeight || 'normal',
      };

      return (
        <>
          <InspectorControls group="content">
            <PanelBody title="Text" initialOpen={true}>
              <TextareaControl
                label="Text"
                rows={4}
                value={text}
                onChange={(value) => setAttributes({ text: value })}
              />
              <TextControl
                label="Font size (px)"
                type="number"
                min={0}
                value={String(toNonNegativeNumber(fontSize, DEFAULT_FONT_SIZE))}
                onChange={(value) =>
                  setAttributes({ fontSize: toNonNegativeNumber(value, DEFAULT_FONT_SIZE) })}
              />
              <SelectControl
                label="Text align"
                value={textAlign || 'left'}
                options={[
                  { label: 'Left', value: 'left' },
                  { label: 'Center', value: 'center' },
                  { label: 'Right', value: 'right' },
                  { label: 'Justify', value: 'justify' },
                ]}
                onChange={(value) => setAttributes({ textAlign: value })}
              />
              <SelectControl
                label="Font weight"
                value={fontWeight || 'normal'}
                options={[
                  { label: 'Normal', value: 'normal' },
                  { label: 'Bold', value: 'bold' },
                  { label: '500', value: '500' },
                  { label: '600', value: '600' },
                  { label: '700', value: '700' },
                ]}
                onChange={(value) => setAttributes({ fontWeight: value })}
              />
              <TextControl
                label="Padding top (px)"
                type="number"
                min={0}
                value={String(toNonNegativeNumber(paddingTop, DEFAULT_PADDING))}
                onChange={(value) =>
                  setAttributes({ paddingTop: toNonNegativeNumber(value, DEFAULT_PADDING) })}
              />
              <TextControl
                label="Padding bottom (px)"
                type="number"
                min={0}
                value={String(toNonNegativeNumber(paddingBottom, DEFAULT_PADDING))}
                onChange={(value) =>
                  setAttributes({ paddingBottom: toNonNegativeNumber(value, DEFAULT_PADDING) })}
              />
              <TextControl
                label="Padding left (px)"
                type="number"
                min={0}
                value={String(toNonNegativeNumber(paddingLeft, DEFAULT_PADDING))}
                onChange={(value) =>
                  setAttributes({ paddingLeft: toNonNegativeNumber(value, DEFAULT_PADDING) })}
              />
              <TextControl
                label="Padding right (px)"
                type="number"
                min={0}
                value={String(toNonNegativeNumber(paddingRight, DEFAULT_PADDING))}
                onChange={(value) =>
                  setAttributes({ paddingRight: toNonNegativeNumber(value, DEFAULT_PADDING) })}
              />
              <ActionBuilder
                label="Action"
                value={action ?? {}}
                onChange={(next) => setAttributes({ action: next })}
              />
            </PanelBody>
          </InspectorControls>

          <InspectorControls>
            <PanelColorSettings
              title="Colors"
              colorSettings={[
                {
                  label: 'Font color',
                  value: fontColor,
                  onChange: (value) =>
                    setAttributes({ fontColor: value || DEFAULT_FONT_COLOR }),
                },
                {
                  label: 'Background color',
                  value: backgroundColor,
                  onChange: (value) =>
                    setAttributes({ backgroundColor: value || DEFAULT_BACKGROUND }),
                },
              ]}
            />
          </InspectorControls>

          <div {...blockProps}>
            <div className="riyasat-standard-text" style={resolvedStyle}>
              {text || DEFAULT_TEXT}
            </div>
          </div>
        </>
      );
    },

    save: ({ attributes }) => {
      const {
        text,
        fontSize,
        fontColor,
        backgroundColor,
        paddingTop,
        paddingBottom,
        paddingLeft,
        paddingRight,
        textAlign,
        fontWeight,
        action,
      } = attributes;

      const style = {
        fontSize: `${toNonNegativeNumber(fontSize, DEFAULT_FONT_SIZE)}px`,
        color: fontColor || DEFAULT_FONT_COLOR,
        backgroundColor: backgroundColor || DEFAULT_BACKGROUND,
        paddingTop: `${toNonNegativeNumber(paddingTop, DEFAULT_PADDING)}px`,
        paddingBottom: `${toNonNegativeNumber(paddingBottom, DEFAULT_PADDING)}px`,
        paddingLeft: `${toNonNegativeNumber(paddingLeft, DEFAULT_PADDING)}px`,
        paddingRight: `${toNonNegativeNumber(paddingRight, DEFAULT_PADDING)}px`,
        textAlign: textAlign || 'left',
        fontWeight: fontWeight || 'normal',
      };

      const blockProps = useBlockProps.save({
        className: 'riyasat-standard-text',
        'data-text': text || DEFAULT_TEXT,
        'data-font-size': `${toNonNegativeNumber(fontSize, DEFAULT_FONT_SIZE)}`,
        'data-font-color': fontColor || DEFAULT_FONT_COLOR,
        'data-background-color': backgroundColor || DEFAULT_BACKGROUND,
        'data-padding-top': `${toNonNegativeNumber(paddingTop, DEFAULT_PADDING)}`,
        'data-padding-bottom': `${toNonNegativeNumber(paddingBottom, DEFAULT_PADDING)}`,
        'data-padding-left': `${toNonNegativeNumber(paddingLeft, DEFAULT_PADDING)}`,
        'data-padding-right': `${toNonNegativeNumber(paddingRight, DEFAULT_PADDING)}`,
        'data-text-align': textAlign || 'left',
        'data-font-weight': fontWeight || 'normal',
        'data-action': JSON.stringify(action ?? {}),
        style,
      });

      return <div {...blockProps}>{text || DEFAULT_TEXT}</div>;
    },
  });
}
