// @ts-nocheck
import { useState } from 'gutenberg-block-kit/wp/element';
import { registerBlockType, createBlock, unregisterBlockType } from 'gutenberg-block-kit/wp/blocks';
import {
  useBlockProps,
  InnerBlocks,
  InspectorControls,
  MediaUpload,
  MediaUploadCheck,
  RichText,
} from 'gutenberg-block-kit/wp/block-editor';
import {
  PanelBody,
  TextControl,
  ToggleControl,
  RangeControl,
  Button,
} from 'gutenberg-block-kit/wp/components';
import { useSelect, useDispatch } from 'gutenberg-block-kit/wp/data';
import { ActionBuilder } from 'gutenberg-block-kit/actions';
import {
  ColorSettingsPanel,
  contentTabStyle,
  ImagePicker,
  imageAttributesFromMedia,
  clearImageAttributes,
  useChildBlocks,
  ParentBlockBackButton,
} from '../inspector-shared';
import {
  IMAGE_SCROLLER_BLOCK,
  IMAGE_SCROLLER_ITEM_BLOCK,
  APPBUILDER_CATEGORY,
} from '../constants';

const DEFAULT_TITLE = 'Featured Categories';
const DEFAULT_BUTTON_TEXT = 'View All';
const DEFAULT_BLOCK_HEIGHT = 80;
const DEFAULT_PADDING = 16;
const DEFAULT_MARGIN = 12;
const DEFAULT_GAP = 14;
const DEFAULT_RADIUS = 12;
const DEFAULT_BACKGROUND = '#ffffff';

function toFiniteNumber(value, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return fallback;
  }
  return parsed;
}

function ImageScrollerIcon() {
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
        d="M3 5h18a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1zm1 2v10h16V7H4zm2 2h4v6H6V9zm6 0h4v6h-4V9zm6 0h4v6h-4V9z"
      />
    </svg>
  );
}

function ImageIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <polyline points="21 15 16 10 5 21" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Child: core/image-scroller-item
// ---------------------------------------------------------------------------
function registerImageScrollerItem() {
  try {
    unregisterBlockType(IMAGE_SCROLLER_ITEM_BLOCK);
  } catch {
    // safe fallback
  }

  registerBlockType(IMAGE_SCROLLER_ITEM_BLOCK, {
    apiVersion: 3,
    title: 'Scroller Item',
    description: 'Single item slide in Image Scroller.',
    category: APPBUILDER_CATEGORY,
    parent: [IMAGE_SCROLLER_BLOCK],
    icon: 'format-image',
    supports: { html: false, reusable: false },
    attributes: {
      imageUrl: { type: 'string', default: '' },
      imageWidth: { type: 'number', default: 0 },
      imageHeight: { type: 'number', default: 0 },
      label: { type: 'string', default: '' },
      action: { type: 'object', default: {} },
    },

    edit: ({ attributes, setAttributes, clientId }) => {
      const { imageUrl, label, action } = attributes;
      const blockProps = useBlockProps({
        className: 'appbuilder-image-scroller-item-editor',
      });

      const parentClientId = useSelect(
        (select) => {
          const editor = select('core/block-editor');
          const parents = editor.getBlockParents(clientId);
          return parents[parents.length - 1];
        },
        [clientId]
      );

      const { selectBlock } = useDispatch('core/block-editor');

      return (
        <>
          <InspectorControls group="content">
            <div style={contentTabStyle}>
              <ParentBlockBackButton clientId={clientId} />
              <PanelBody title="Scroller Item" initialOpen={true}>
                <ImagePicker
                  imageUrl={imageUrl}
                  onSelect={(media) => setAttributes(imageAttributesFromMedia(media))}
                  onClear={() => setAttributes(clearImageAttributes())}
                />
                <TextControl
                  label="Label"
                  value={label}
                  onChange={(value) => setAttributes({ label: value })}
                />
                <ActionBuilder
                  label="Item Action"
                  value={action ?? {}}
                  onChange={(next) => setAttributes({ action: next })}
                />
              </PanelBody>
            </div>
          </InspectorControls>

          <div {...blockProps}>
            <div className="appbuilder-image-scroller-item__content">
              {imageUrl ? (
                <MediaUploadCheck>
                  <MediaUpload
                    onSelect={(media) => setAttributes(imageAttributesFromMedia(media))}
                    allowedTypes={['image']}
                    render={({ open }) => (
                      <div
                        onClick={open}
                        className="appbuilder-image-scroller-item__image-wrap"
                        style={{ cursor: 'pointer' }}
                        title="Click to change image"
                      >
                        <img
                          src={imageUrl}
                          alt={label || ''}
                          className="appbuilder-image-scroller-item__image"
                        />
                      </div>
                    )}
                  />
                </MediaUploadCheck>
              ) : (
                <MediaUploadCheck>
                  <MediaUpload
                    onSelect={(media) => setAttributes(imageAttributesFromMedia(media))}
                    allowedTypes={['image']}
                    render={({ open }) => (
                      <div
                        onClick={open}
                        className="appbuilder-image-scroller-item__placeholder"
                        style={{ cursor: 'pointer' }}
                        title="Click to select image"
                      >
                        <ImageIcon />
                        <span style={{ marginLeft: '4px' }}>Add Image</span>
                      </div>
                    )}
                  />
                </MediaUploadCheck>
              )}
              {label ? (
                <span className="appbuilder-image-scroller-item__label">{label}</span>
              ) : null}
            </div>
          </div>
        </>
      );
    },

    save: ({ attributes }) => {
      const { imageUrl, imageWidth, imageHeight, label, action } = attributes;
      const blockProps = useBlockProps.save({
        className: 'appbuilder-image-scroller-item',
        'data-image-url': imageUrl ?? '',
        'data-image-width': String(imageWidth ?? 0),
        'data-image-height': String(imageHeight ?? 0),
        'data-label': label ?? '',
        'data-action': JSON.stringify(action ?? {}),
      });

      return (
        <div {...blockProps}>
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={label || ''}
              className="appbuilder-image-scroller-item__image"
            />
          ) : null}
          {label ? (
            <span className="appbuilder-image-scroller-item__label">{label}</span>
          ) : null}
        </div>
      );
    },
  });
}

// ---------------------------------------------------------------------------
// Parent: core/image-scroller
// ---------------------------------------------------------------------------
export function registerImageScroller() {
  registerImageScrollerItem();

  try {
    unregisterBlockType(IMAGE_SCROLLER_BLOCK);
  } catch {
    // safe fallback
  }

  registerBlockType(IMAGE_SCROLLER_BLOCK, {
    apiVersion: 3,
    title: 'Image Scroller',
    description: 'Horizontal image scroller carousel with responsive layout, gaps, titles, padding, margin, and actions.',
    category: APPBUILDER_CATEGORY,
    icon: ImageScrollerIcon,
    supports: { html: false, align: ['wide', 'full'] },
    attributes: {
      title: { type: 'string', default: DEFAULT_TITLE },
      subTitle: { type: 'string', default: '' },
      showTitle: { type: 'boolean', default: true },
      showButton: { type: 'boolean', default: true },
      buttonText: { type: 'string', default: DEFAULT_BUTTON_TEXT },
      backgroundColor: { type: 'string', default: DEFAULT_BACKGROUND },
      blockHeight: { type: 'number', default: DEFAULT_BLOCK_HEIGHT },
      enableGap: { type: 'boolean', default: true },
      gap: { type: 'number', default: DEFAULT_GAP },
      padding: { type: 'number', default: DEFAULT_PADDING },
      advancePaddingControl: {
        type: 'object',
        default: { top: 0, right: 0, bottom: 0, left: 0 },
      },
      margin: { type: 'number', default: DEFAULT_MARGIN },
      imageBorderRadius: { type: 'number', default: DEFAULT_RADIUS },
      action: { type: 'object', default: {} },
    },

    edit: ({ attributes, setAttributes, clientId }) => {
      const {
        title,
        subTitle,
        showTitle,
        showButton,
        buttonText,
        backgroundColor,
        blockHeight,
        enableGap,
        gap,
        padding,
        advancePaddingControl = {},
        margin,
        imageBorderRadius,
        action,
      } = attributes;

      const [selectedSlideIndex, setSelectedSlideIndex] = useState(0);
      const heightVal = toFiniteNumber(blockHeight, DEFAULT_BLOCK_HEIGHT);
      const padVal = toFiniteNumber(padding, DEFAULT_PADDING);
      const marVal = toFiniteNumber(margin, DEFAULT_MARGIN);
      const gapVal = toFiniteNumber(gap, DEFAULT_GAP);
      const radiusVal = toFiniteNumber(imageBorderRadius, DEFAULT_RADIUS);

      const advTop = advancePaddingControl?.top;
      const advRight = advancePaddingControl?.right;
      const advBottom = advancePaddingControl?.bottom;
      const advLeft = advancePaddingControl?.left;

      const hasAdvPadding =
        (advTop !== undefined && advTop !== 0) ||
        (advRight !== undefined && advRight !== 0) ||
        (advBottom !== undefined && advBottom !== 0) ||
        (advLeft !== undefined && advLeft !== 0);

      const effectivePadding = hasAdvPadding
        ? `${advTop ?? 0}px ${advRight ?? 0}px ${advBottom ?? 0}px ${advLeft ?? 0}px`
        : `${padVal}px 15px`;

      const effectiveMargin = `${marVal}px 0`;

      const { childBlocks, childCount, insertBlock, removeBlock, updateBlockAttributes } =
        useChildBlocks(clientId);
      const { selectBlock, moveBlocksUp, moveBlocksDown } = useDispatch('core/block-editor');

      const blockProps = useBlockProps({
        className: `appbuilder-image-scroller-editor ${enableGap ? 'has-gap' : 'no-gap'}`,
        style: {
          background: backgroundColor || DEFAULT_BACKGROUND,
          padding: effectivePadding,
          margin: effectiveMargin,
          '--appbuilder-scroller-height': `${heightVal}px`,
          '--appbuilder-image-scroller-padding': effectivePadding,
          '--appbuilder-image-scroller-margin': effectiveMargin,
          '--appbuilder-image-scroller-gap': enableGap ? `${gapVal}px` : '0px',
          '--appbuilder-image-scroller-radius': `${radiusVal}px`,
        },
      });

      const handleAddSlide = () => {
        const newBlock = createBlock(IMAGE_SCROLLER_ITEM_BLOCK, {
          label: `Set`,
        });
        insertBlock(newBlock, childCount, clientId);
        setSelectedSlideIndex(childCount);
      };

      const handleSelectSlide = (index) => {
        setSelectedSlideIndex(index);
        const child = childBlocks[index];
        if (child?.clientId && selectBlock) {
          selectBlock(child.clientId);
        }
      };

      const updateAdvPadding = (side, val) => {
        const num = Math.max(0, parseInt(val, 10) || 0);
        setAttributes({
          advancePaddingControl: {
            ...advancePaddingControl,
            [side]: num,
          },
        });
      };

      const updateColorAttribute = (key, fallback) => (nextColor) => {
        if (nextColor === undefined || nextColor === null || nextColor === '') {
          return;
        }
        setAttributes({ [key]: nextColor });
      };

      const selectedChild = childBlocks[selectedSlideIndex];

      return (
        <>
          <InspectorControls group="content">
            <div style={contentTabStyle}>
              <PanelBody title="Header Settings" initialOpen={true}>
                <ToggleControl
                  label="Show Title"
                  checked={showTitle ?? true}
                  onChange={(val) => setAttributes({ showTitle: val })}
                />
                {(showTitle ?? true) ? (
                  <>
                    <TextControl
                      label="Title"
                      value={title ?? DEFAULT_TITLE}
                      onChange={(val) => setAttributes({ title: val })}
                    />
                    <TextControl
                      label="Subtitle / Tagline"
                      value={subTitle ?? ''}
                      onChange={(val) => setAttributes({ subTitle: val })}
                    />
                  </>
                ) : null}
                <ToggleControl
                  label="Show Button"
                  checked={showButton ?? true}
                  onChange={(val) => setAttributes({ showButton: val })}
                />
                {(showButton ?? true) ? (
                  <>
                    <TextControl
                      label="Button Text"
                      value={buttonText ?? DEFAULT_BUTTON_TEXT}
                      onChange={(val) => setAttributes({ buttonText: val })}
                    />
                    <ActionBuilder
                      label="Button Action"
                      value={action ?? {}}
                      onChange={(next) => setAttributes({ action: next })}
                    />
                  </>
                ) : null}
              </PanelBody>

              <PanelBody title="Scroller & Spacing Settings" initialOpen={true}>
                <RangeControl
                  label="Block Height (px)"
                  value={heightVal}
                  onChange={(val) =>
                    setAttributes({ blockHeight: toFiniteNumber(val, DEFAULT_BLOCK_HEIGHT) })}
                  min={20}
                  max={500}
                  step={5}
                />
                <ToggleControl
                  label="Enable Gap"
                  checked={enableGap ?? true}
                  onChange={(val) => setAttributes({ enableGap: val })}
                />
                {(enableGap ?? true) ? (
                  <RangeControl
                    label="Item Gap (px)"
                    value={gapVal}
                    onChange={(val) => setAttributes({ gap: toFiniteNumber(val, DEFAULT_GAP) })}
                    min={0}
                    max={40}
                    step={2}
                  />
                ) : null}
                <RangeControl
                  label="Image Border Radius (px)"
                  value={radiusVal}
                  onChange={(val) => setAttributes({ imageBorderRadius: toFiniteNumber(val, DEFAULT_RADIUS) })}
                  min={0}
                  max={30}
                  step={1}
                />
                <RangeControl
                  label="Block Padding (px)"
                  value={padVal}
                  onChange={(val) => setAttributes({ padding: toFiniteNumber(val, DEFAULT_PADDING) })}
                  min={0}
                  max={100}
                  step={2}
                />
                <RangeControl
                  label="Block Margin (px)"
                  value={marVal}
                  onChange={(val) => setAttributes({ margin: toFiniteNumber(val, DEFAULT_MARGIN) })}
                  min={0}
                  max={100}
                  step={2}
                />

                <div style={{ marginTop: '12px' }}>
                  <p style={{ fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                    Advanced Padding (px):
                  </p>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                    <TextControl
                      label="Top"
                      type="number"
                      value={advTop ?? 0}
                      onChange={(val) => updateAdvPadding('top', val)}
                    />
                    <TextControl
                      label="Right"
                      type="number"
                      value={advRight ?? 0}
                      onChange={(val) => updateAdvPadding('right', val)}
                    />
                    <TextControl
                      label="Bottom"
                      type="number"
                      value={advBottom ?? 0}
                      onChange={(val) => updateAdvPadding('bottom', val)}
                    />
                    <TextControl
                      label="Left"
                      type="number"
                      value={advLeft ?? 0}
                      onChange={(val) => updateAdvPadding('left', val)}
                    />
                  </div>
                </div>
              </PanelBody>

              <PanelBody title={`Items (${childCount})`} initialOpen={true}>
                <Button
                  variant="primary"
                  onClick={handleAddSlide}
                  style={{ width: '100%', marginBottom: '12px', justifyContent: 'center' }}
                >
                  + Add Item
                </Button>

                {childBlocks.map((child, index) => (
                  <div
                    key={child.clientId}
                    onClick={() => handleSelectSlide(index)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '8px 10px',
                      marginBottom: '6px',
                      borderRadius: '6px',
                      border:
                        selectedSlideIndex === index
                          ? '2px solid #007cba'
                          : '1px solid #e2e8f0',
                      background: selectedSlideIndex === index ? '#f0f7fc' : '#fff',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <span style={{ fontSize: '13px', fontWeight: 600, color: '#1e293b' }}>
                      {child.attributes?.label || `Item ${index + 1}`}
                    </span>
                    <div style={{ display: 'flex', gap: '4px' }}>
                      {index > 0 ? (
                        <Button
                          variant="tertiary"
                          compact
                          onClick={(e) => {
                            e.stopPropagation();
                            moveBlocksUp([child.clientId], clientId);
                            setSelectedSlideIndex(index - 1);
                          }}
                        >
                          ↑
                        </Button>
                      ) : null}
                      {index < childCount - 1 ? (
                        <Button
                          variant="tertiary"
                          compact
                          onClick={(e) => {
                            e.stopPropagation();
                            moveBlocksDown([child.clientId], clientId);
                            setSelectedSlideIndex(index + 1);
                          }}
                        >
                          ↓
                        </Button>
                      ) : null}
                      <Button
                        variant="link"
                        isDestructive
                        compact
                        onClick={(e) => {
                          e.stopPropagation();
                          removeBlock(child.clientId);
                          if (selectedSlideIndex >= childCount - 1) {
                            setSelectedSlideIndex(Math.max(0, childCount - 2));
                          }
                        }}
                      >
                        ✕
                      </Button>
                    </div>
                  </div>
                ))}

                {selectedChild ? (
                  <div
                    style={{
                      marginTop: '16px',
                      paddingTop: '16px',
                      borderTop: '1px solid #e2e8f0',
                    }}
                  >
                    <h4 style={{ margin: '0 0 12px', fontSize: '13px', fontWeight: 700, color: '#0f172a' }}>
                      Configure Item {selectedSlideIndex + 1}
                    </h4>
                    <ImagePicker
                      imageUrl={selectedChild.attributes?.imageUrl}
                      onSelect={(media) =>
                        updateBlockAttributes(
                          selectedChild.clientId,
                          imageAttributesFromMedia(media),
                        )
                      }
                      onClear={() =>
                        updateBlockAttributes(
                          selectedChild.clientId,
                          clearImageAttributes(),
                        )
                      }
                    />
                    <TextControl
                      label="Label"
                      value={selectedChild.attributes?.label ?? ''}
                      onChange={(val) =>
                        updateBlockAttributes(selectedChild.clientId, { label: val })}
                    />
                    <ActionBuilder
                      label="Item Action"
                      value={selectedChild.attributes?.action ?? {}}
                      onChange={(next) =>
                        updateBlockAttributes(selectedChild.clientId, { action: next })}
                    />
                  </div>
                ) : null}
              </PanelBody>
            </div>
          </InspectorControls>

          <InspectorControls>
            <PanelBody title="Color Settings" initialOpen={true}>
              <ColorSettingsPanel
                title="Colors"
                colorSettings={[
                  {
                    label: 'Background Color',
                    value: backgroundColor || DEFAULT_BACKGROUND,
                    onChange: updateColorAttribute('backgroundColor', DEFAULT_BACKGROUND),
                  },
                ]}
              />
            </PanelBody>
          </InspectorControls>

          <div {...blockProps}>
            {(showTitle ?? true) || (showButton ?? true) ? (
              <div className="appbuilder-image-scroller__header">
                {(showTitle ?? true) ? (
                  <div>
                    {subTitle ? (
                      <span className="appbuilder-image-scroller__subtitle">{subTitle}</span>
                    ) : null}
                    <RichText
                      tagName="h3"
                      className="appbuilder-image-scroller__title"
                      value={title ?? DEFAULT_TITLE}
                      onChange={(val) => setAttributes({ title: val })}
                      placeholder="Enter Title..."
                      allowedFormats={[]}
                    />
                  </div>
                ) : <div />}
                {(showButton ?? true) ? (
                  <button type="button" className="appbuilder-image-scroller__header-btn">
                    {buttonText ?? DEFAULT_BUTTON_TEXT}
                  </button>
                ) : null}
              </div>
            ) : null}

            <div className={`appbuilder-image-scroller__track ${enableGap ? 'has-gap' : 'no-gap'}`}>
              <InnerBlocks
                allowedBlocks={[IMAGE_SCROLLER_ITEM_BLOCK]}
                template={[
                  [IMAGE_SCROLLER_ITEM_BLOCK, { label: 'Category 1' }],
                  [IMAGE_SCROLLER_ITEM_BLOCK, { label: 'Category 2' }],
                  [IMAGE_SCROLLER_ITEM_BLOCK, { label: 'Category 3' }],
                ]}
                orientation="horizontal"
              />
            </div>
          </div>
        </>
      );
    },

    save: ({ attributes }) => {
      const {
        title,
        subTitle,
        showTitle,
        showButton,
        buttonText,
        backgroundColor,
        blockHeight,
        enableGap,
        gap,
        padding,
        advancePaddingControl = {},
        margin,
        imageBorderRadius,
        action,
      } = attributes;

      const heightVal = toFiniteNumber(blockHeight, DEFAULT_BLOCK_HEIGHT);
      const padVal = toFiniteNumber(padding, DEFAULT_PADDING);
      const marVal = toFiniteNumber(margin, DEFAULT_MARGIN);
      const gapVal = toFiniteNumber(gap, DEFAULT_GAP);
      const radiusVal = toFiniteNumber(imageBorderRadius, DEFAULT_RADIUS);

      const advTop = advancePaddingControl?.top;
      const advRight = advancePaddingControl?.right;
      const advBottom = advancePaddingControl?.bottom;
      const advLeft = advancePaddingControl?.left;

      const hasAdvPadding =
        (advTop !== undefined && advTop !== 0) ||
        (advRight !== undefined && advRight !== 0) ||
        (advBottom !== undefined && advBottom !== 0) ||
        (advLeft !== undefined && advLeft !== 0);

      const effectivePadding = hasAdvPadding
        ? `${advTop ?? 0}px ${advRight ?? 0}px ${advBottom ?? 0}px ${advLeft ?? 0}px`
        : `${padVal}px 15px`;

      const effectiveMargin = `${marVal}px 0`;

      const blockProps = useBlockProps.save({
        className: `appbuilder-image-scroller ${enableGap ? 'has-gap' : 'no-gap'}`,
        'data-title': title ?? '',
        'data-subtitle': subTitle ?? '',
        'data-show-title': String(showTitle ?? true),
        'data-show-button': String(showButton ?? true),
        'data-button-text': buttonText ?? '',
        'data-background-color': backgroundColor || DEFAULT_BACKGROUND,
        'data-block-height': String(heightVal),
        'data-enable-gap': String(enableGap ?? true),
        'data-gap': String(gapVal),
        'data-padding': String(padVal),
        'data-margin': String(marVal),
        'data-image-border-radius': String(radiusVal),
        'data-advance-padding': JSON.stringify(advancePaddingControl ?? {}),
        'data-action': JSON.stringify(action ?? {}),
        style: {
          background: backgroundColor || DEFAULT_BACKGROUND,
          padding: effectivePadding,
          margin: effectiveMargin,
          '--appbuilder-scroller-height': `${heightVal}px`,
          '--appbuilder-image-scroller-padding': effectivePadding,
          '--appbuilder-image-scroller-margin': effectiveMargin,
          '--appbuilder-image-scroller-gap': enableGap ? `${gapVal}px` : '0px',
          '--appbuilder-image-scroller-radius': `${radiusVal}px`,
        },
      });

      return (
        <div {...blockProps}>
          {(showTitle ?? true) || (showButton ?? true) ? (
            <div className="appbuilder-image-scroller__header">
              {(showTitle ?? true) ? (
                <div>
                  {subTitle ? (
                    <span className="appbuilder-image-scroller__subtitle">{subTitle}</span>
                  ) : null}
                  {title ? (
                    <RichText.Content
                      tagName="h3"
                      className="appbuilder-image-scroller__title"
                      value={title ?? DEFAULT_TITLE}
                    />
                  ) : null}
                </div>
              ) : <div />}
              {(showButton ?? true) ? (
                <button type="button" className="appbuilder-image-scroller__header-btn">
                  {buttonText ?? DEFAULT_BUTTON_TEXT}
                </button>
              ) : null}
            </div>
          ) : null}

          <div className={`appbuilder-image-scroller__track ${enableGap ? 'has-gap' : 'no-gap'}`}>
            <InnerBlocks.Content />
          </div>
        </div>
      );
    },
  });
}
