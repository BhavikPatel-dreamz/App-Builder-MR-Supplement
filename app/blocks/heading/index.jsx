// @ts-nocheck
import { registerBlockType, unregisterBlockType } from 'gutenberg-block-kit/wp/blocks';
import {
  useBlockProps,
  InspectorControls,
  RichText,
} from 'gutenberg-block-kit/wp/block-editor';
import { ColorSettingsPanel } from '../inspector-shared';
import {
  PanelBody,
  TextControl,
  SelectControl,
  RangeControl,
} from 'gutenberg-block-kit/wp/components';
import { ActionBuilder } from 'gutenberg-block-kit/actions';
import { HEADING_BLOCK, APPBUILDER_CATEGORY } from '../constants';

const DEFAULT_TEXT = 'Heading Text';
const DEFAULT_LEVEL = 2;
const DEFAULT_FONT_SIZE = 24;
const DEFAULT_FONT_WEIGHT = '700';
const DEFAULT_FONT_COLOR = '#000000';
const DEFAULT_BACKGROUND_COLOR = '#ffffff';
const DEFAULT_PADDING = 10;
const DEFAULT_MARGIN = 10;
const DEFAULT_TEXT_ALIGN = 'left';
const DEFAULT_TEXT_FORMAT = 'normal';
const DEFAULT_LINE_HEIGHT = 1.2;
const DEFAULT_LETTER_SPACING = 0;
const DEFAULT_TEXT_TRANSFORM = 'none';
const DEFAULT_BORDER_WIDTH = 0;
const DEFAULT_BORDER_RADIUS = 0;

function toFiniteNumber(value, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return parsed;
}

function HeadingIcon() {
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
        d="M5 4v3h5.5v12H7v2h10v-2h-3.5V7H19V4H5z"
      />
    </svg>
  );
}

function getResolvedText(attributes) {
  if (typeof attributes?.text === 'string' && attributes.text.length > 0) {
    return attributes.text;
  }
  if (typeof attributes?.content === 'string' && attributes.content.length > 0) {
    return attributes.content;
  }
  return DEFAULT_TEXT;
}

function getResolvedFontSize(attributes) {
  if (typeof attributes?.fontSize === 'number' && Number.isFinite(attributes.fontSize) && attributes.fontSize > 0) {
    return attributes.fontSize;
  }
  if (typeof attributes?.fontSize === 'string') {
    const parsed = Number.parseInt(attributes.fontSize, 10);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  if (attributes?.style?.typography?.fontSize) {
    const parsed = Number.parseInt(attributes.style.typography.fontSize, 10);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  return DEFAULT_FONT_SIZE;
}

function getResolvedFontColor(attributes) {
  if (attributes?.fontColor) return attributes.fontColor;
  if (attributes?.style?.color?.text) return attributes.style.color.text;
  return DEFAULT_FONT_COLOR;
}

function getResolvedBackgroundColor(attributes) {
  if (attributes?.backgroundColor) return attributes.backgroundColor;
  if (attributes?.style?.color?.background) return attributes.style.color.background;
  return DEFAULT_BACKGROUND_COLOR;
}

function getHeadingStyle(attributes) {
  const {
    fontWeight,
    padding,
    textAlign,
    textFormat,
    lineHeight,
    letterSpacing,
    textTransform,
    borderWidth,
    borderRadius,
  } = attributes || {};

  const numFontSize = getResolvedFontSize(attributes);
  const fontColor = getResolvedFontColor(attributes);
  const backgroundColor = getResolvedBackgroundColor(attributes);
  const numPadding = toFiniteNumber(padding, DEFAULT_PADDING);
  const numBorderWidth = toFiniteNumber(borderWidth, DEFAULT_BORDER_WIDTH);
  const numBorderRadius = toFiniteNumber(borderRadius, DEFAULT_BORDER_RADIUS);
  const numLineHeight = toFiniteNumber(lineHeight, DEFAULT_LINE_HEIGHT);
  const numLetterSpacing = toFiniteNumber(letterSpacing, DEFAULT_LETTER_SPACING);

  let styleFontWeight = fontWeight || DEFAULT_FONT_WEIGHT;
  let fontStyle = 'normal';
  let textDecoration = 'none';

  switch (textFormat) {
    case 'bold':
      styleFontWeight = 'bold';
      break;
    case 'italic':
      fontStyle = 'italic';
      break;
    case 'underline':
      textDecoration = 'underline';
      break;
    case 'strikethrough':
      textDecoration = 'line-through';
      break;
    case 'normal':
    default:
      break;
  }

  return {
    fontSize: `${numFontSize}px`,
    fontWeight: styleFontWeight,
    fontStyle,
    textDecoration,
    color: fontColor,
    backgroundColor,
    padding: `${numPadding}px`,
    textAlign: textAlign || DEFAULT_TEXT_ALIGN,
    lineHeight: String(numLineHeight),
    letterSpacing: `${numLetterSpacing}px`,
    textTransform: textTransform || DEFAULT_TEXT_TRANSFORM,
    borderStyle: numBorderWidth > 0 ? 'solid' : 'none',
    borderWidth: `${numBorderWidth}px`,
    borderColor: fontColor,
    borderRadius: `${numBorderRadius}px`,
    boxSizing: 'border-box',
    display: 'block',
    width: '100%',
  };
}

export function registerHeading() {
  try {
    unregisterBlockType(HEADING_BLOCK);
  } catch {
    // safe fallback if not yet registered
  }

  registerBlockType(HEADING_BLOCK, {
    apiVersion: 3,
    title: 'Heading',
    description: 'Semantic H1–H6 heading block with RichText editing and typography controls.',
    category: APPBUILDER_CATEGORY,
    icon: HeadingIcon,
    supports: { html: false, align: ['wide', 'full'] },
    attributes: {
      content: { type: 'string', default: DEFAULT_TEXT },
      text: { type: 'string', default: DEFAULT_TEXT },
      level: { type: 'number', default: DEFAULT_LEVEL },
      fontSize: { type: 'number', default: DEFAULT_FONT_SIZE },
      fontWeight: { type: 'string', default: DEFAULT_FONT_WEIGHT },
      fontColor: { type: 'string', default: DEFAULT_FONT_COLOR },
      backgroundColor: { type: 'string', default: DEFAULT_BACKGROUND_COLOR },
      padding: { type: 'number', default: DEFAULT_PADDING },
      margin: { type: 'number', default: DEFAULT_MARGIN },
      textAlign: { type: 'string', default: DEFAULT_TEXT_ALIGN },
      textFormat: { type: 'string', default: DEFAULT_TEXT_FORMAT },
      lineHeight: { type: 'number', default: DEFAULT_LINE_HEIGHT },
      letterSpacing: { type: 'number', default: DEFAULT_LETTER_SPACING },
      textTransform: { type: 'string', default: DEFAULT_TEXT_TRANSFORM },
      borderWidth: { type: 'number', default: DEFAULT_BORDER_WIDTH },
      borderRadius: { type: 'number', default: DEFAULT_BORDER_RADIUS },
      style: { type: 'object', default: {} },
      action: { type: 'object', default: {} },
    },

    edit: ({ attributes, setAttributes }) => {
      const {
        level,
        fontWeight,
        padding,
        margin,
        textAlign,
        textFormat,
        lineHeight,
        letterSpacing,
        textTransform,
        borderWidth,
        borderRadius,
        action,
      } = attributes;

      const currentText = getResolvedText(attributes);
      const currentFontSize = getResolvedFontSize(attributes);
      const currentFontColor = getResolvedFontColor(attributes);
      const currentBackgroundColor = getResolvedBackgroundColor(attributes);

      const validLevel = Math.min(Math.max(toFiniteNumber(level, DEFAULT_LEVEL), 1), 6);
      const TagName = `h${validLevel}`;
      const numMargin = toFiniteNumber(margin, DEFAULT_MARGIN);

      const blockProps = useBlockProps({
        className: `appbuilder-heading-editor appbuilder-heading-editor--h${validLevel}`,
        style: { margin: `${numMargin}px` },
      });

      const style = getHeadingStyle(attributes);

      const updateText = (newText) => {
        setAttributes({
          text: newText,
          content: newText,
        });
      };

      const updateFontSize = (newSize) => {
        const num = toFiniteNumber(newSize, DEFAULT_FONT_SIZE);
        setAttributes({
          fontSize: num,
          style: {
            ...(attributes.style || {}),
            typography: {
              ...(attributes.style?.typography || {}),
              fontSize: `${num}px`,
            },
          },
        });
      };

      const updateLevel = (newLevel) => {
        const parsed = Number.parseInt(newLevel, 10);
        const valid = Math.min(Math.max(toFiniteNumber(parsed, DEFAULT_LEVEL), 1), 6);
        setAttributes({ level: valid });
      };

      const updateFontColor = (newColor) => {
        if (newColor === undefined || newColor === null || newColor === '') {
          return;
        }
        const color = newColor || DEFAULT_FONT_COLOR;
        setAttributes({
          fontColor: color,
          style: {
            ...(attributes.style || {}),
            color: {
              ...(attributes.style?.color || {}),
              text: color,
            },
          },
        });
      };

      const updateBackgroundColor = (newBg) => {
        if (newBg === undefined || newBg === null || newBg === '') {
          return;
        }
        const bg = newBg || DEFAULT_BACKGROUND_COLOR;
        setAttributes({
          backgroundColor: bg,
          style: {
            ...(attributes.style || {}),
            color: {
              ...(attributes.style?.color || {}),
              background: bg,
            },
          },
        });
      };

      return (
        <>
          <InspectorControls group="content">
            <PanelBody title="Heading Settings" initialOpen={true}>
              <SelectControl
                label="Heading Level"
                value={validLevel}
                options={[
                  { label: 'H1 — Main Title', value: 1 },
                  { label: 'H2 — Section Title', value: 2 },
                  { label: 'H3 — Subtitle', value: 3 },
                  { label: 'H4 — Small Header', value: 4 },
                  { label: 'H5 — Tiny Header', value: 5 },
                  { label: 'H6 — Caption Header', value: 6 },
                ]}
                onChange={updateLevel}
              />
              <TextControl
                label="Heading Text"
                value={currentText}
                onChange={updateText}
              />
            </PanelBody>

            <PanelBody title="Typography" initialOpen={true}>
              <RangeControl
                label="Font Size (px)"
                value={currentFontSize}
                onChange={updateFontSize}
                min={8}
                max={120}
                step={1}
              />
              <SelectControl
                label="Font Weight"
                value={fontWeight || DEFAULT_FONT_WEIGHT}
                options={[
                  { label: '300 — Light', value: '300' },
                  { label: '400 — Normal', value: '400' },
                  { label: '500 — Medium', value: '500' },
                  { label: '600 — Semi-Bold', value: '600' },
                  { label: '700 — Bold', value: '700' },
                  { label: '800 — Extra-Bold', value: '800' },
                  { label: '900 — Black', value: '900' },
                ]}
                onChange={(value) => setAttributes({ fontWeight: value })}
              />
              <RangeControl
                label="Line Height"
                value={toFiniteNumber(lineHeight, DEFAULT_LINE_HEIGHT)}
                onChange={(value) =>
                  setAttributes({ lineHeight: Number.parseFloat(value) })}
                min={0.8}
                max={3.0}
                step={0.1}
              />
              <RangeControl
                label="Letter Spacing (px)"
                value={toFiniteNumber(letterSpacing, DEFAULT_LETTER_SPACING)}
                onChange={(value) =>
                  setAttributes({ letterSpacing: Number.parseFloat(value) })}
                min={-2}
                max={20}
                step={0.5}
              />
              <SelectControl
                label="Text Transform"
                value={textTransform || DEFAULT_TEXT_TRANSFORM}
                options={[
                  { label: 'None', value: 'none' },
                  { label: 'Capitalize', value: 'capitalize' },
                  { label: 'Uppercase', value: 'uppercase' },
                  { label: 'Lowercase', value: 'lowercase' },
                ]}
                onChange={(value) => setAttributes({ textTransform: value })}
              />
              <SelectControl
                label="Text Align"
                value={textAlign || DEFAULT_TEXT_ALIGN}
                options={[
                  { label: 'Left', value: 'left' },
                  { label: 'Center', value: 'center' },
                  { label: 'Right', value: 'right' },
                  { label: 'Justify', value: 'justify' },
                ]}
                onChange={(value) => setAttributes({ textAlign: value })}
              />
              <SelectControl
                label="Text Format"
                value={textFormat || DEFAULT_TEXT_FORMAT}
                options={[
                  { label: 'Normal', value: 'normal' },
                  { label: 'Bold', value: 'bold' },
                  { label: 'Italic', value: 'italic' },
                  { label: 'Underline', value: 'underline' },
                  { label: 'Strikethrough', value: 'strikethrough' },
                ]}
                onChange={(value) => setAttributes({ textFormat: value })}
              />
            </PanelBody>

            <PanelBody title="Spacing & Border" initialOpen={false}>
              <RangeControl
                label="Padding (px)"
                value={toFiniteNumber(padding, DEFAULT_PADDING)}
                onChange={(value) =>
                  setAttributes({ padding: toFiniteNumber(value, DEFAULT_PADDING) })}
                min={0}
                max={100}
                step={1}
              />
              <RangeControl
                label="Margin (px)"
                value={toFiniteNumber(margin, DEFAULT_MARGIN)}
                onChange={(value) =>
                  setAttributes({ margin: toFiniteNumber(value, DEFAULT_MARGIN) })}
                min={0}
                max={100}
                step={1}
              />
              <RangeControl
                label="Border Width (px)"
                value={toFiniteNumber(borderWidth, DEFAULT_BORDER_WIDTH)}
                onChange={(value) =>
                  setAttributes({ borderWidth: toFiniteNumber(value, DEFAULT_BORDER_WIDTH) })}
                min={0}
                max={20}
                step={1}
              />
              <RangeControl
                label="Border Radius (px)"
                value={toFiniteNumber(borderRadius, DEFAULT_BORDER_RADIUS)}
                onChange={(value) =>
                  setAttributes({ borderRadius: toFiniteNumber(value, DEFAULT_BORDER_RADIUS) })}
                min={0}
                max={100}
                step={1}
              />
            </PanelBody>

            <PanelBody title="Action" initialOpen={false}>
              <ActionBuilder
                label="Action"
                value={action ?? {}}
                onChange={(next) => setAttributes({ action: next })}
              />
            </PanelBody>
          </InspectorControls>

          <InspectorControls>
            <ColorSettingsPanel
              title="Colors"
              colorSettings={[
                {
                  label: 'Font Color',
                  value: currentFontColor,
                  onChange: updateFontColor,
                },
                {
                  label: 'Background Color',
                  value: currentBackgroundColor,
                  onChange: updateBackgroundColor,
                },
              ]}
            />
          </InspectorControls>

          <div {...blockProps}>
            <RichText
              key={`${TagName}-${currentFontSize}`}
              tagName={TagName}
              value={currentText}
              onChange={updateText}
              placeholder="Write heading..."
              className={`appbuilder-heading appbuilder-heading--${TagName}`}
              style={style}
            />
          </div>
        </>
      );
    },

    save: ({ attributes }) => {
      const {
        level,
        fontWeight,
        padding,
        margin,
        textAlign,
        textFormat,
        lineHeight,
        letterSpacing,
        textTransform,
        borderWidth,
        borderRadius,
        action,
      } = attributes;

      const currentText = getResolvedText(attributes);
      const currentFontSize = getResolvedFontSize(attributes);
      const currentFontColor = getResolvedFontColor(attributes);
      const currentBackgroundColor = getResolvedBackgroundColor(attributes);

      const validLevel = Math.min(Math.max(toFiniteNumber(level, DEFAULT_LEVEL), 1), 6);
      const TagName = `h${validLevel}`;
      const style = getHeadingStyle(attributes);
      const numMargin = toFiniteNumber(margin, DEFAULT_MARGIN);

      const blockProps = useBlockProps.save({
        className: `appbuilder-heading appbuilder-heading--h${validLevel}`,
        'data-level': String(validLevel),
        'data-text': currentText,
        'data-font-size': String(currentFontSize),
        'data-font-weight': String(fontWeight || DEFAULT_FONT_WEIGHT),
        'data-font-color': currentFontColor,
        'data-background-color': currentBackgroundColor,
        'data-padding': String(padding ?? DEFAULT_PADDING),
        'data-margin': String(margin ?? DEFAULT_MARGIN),
        'data-text-align': textAlign || DEFAULT_TEXT_ALIGN,
        'data-text-format': textFormat || DEFAULT_TEXT_FORMAT,
        'data-line-height': String(lineHeight || DEFAULT_LINE_HEIGHT),
        'data-letter-spacing': String(letterSpacing || DEFAULT_LETTER_SPACING),
        'data-text-transform': textTransform || DEFAULT_TEXT_TRANSFORM,
        'data-border-width': String(borderWidth ?? DEFAULT_BORDER_WIDTH),
        'data-border-radius': String(borderRadius ?? DEFAULT_BORDER_RADIUS),
        'data-action': JSON.stringify(action ?? {}),
        style: {
          ...style,
          margin: `${numMargin}px`,
        },
      });

      return (
        <RichText.Content
          tagName={TagName}
          value={currentText}
          {...blockProps}
        />
      );
    },
  });
}
