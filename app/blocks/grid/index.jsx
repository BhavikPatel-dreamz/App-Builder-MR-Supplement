// @ts-nocheck
//test
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
import { useDispatch } from 'gutenberg-block-kit/wp/data';
import { ActionBuilder } from 'gutenberg-block-kit/actions';
import {
  contentTabStyle,
  ImagePicker,
  imageAttributesFromMedia,
  clearImageAttributes,
  useChildBlocks,
  ParentBlockBackButton,
} from '../inspector-shared';
import {
  GRID_BLOCK,
  GRID_ITEM_BLOCK,
  APPBUILDER_CATEGORY,
} from '../constants';

const DEFAULT_GRID_TITLE = 'Products';
const DEFAULT_BUTTON_TEXT = 'View more';
const DEFAULT_COLUMN = 2;

function clampColumn(val) {
  const parsed = parseInt(val, 10);
  if (!Number.isFinite(parsed) || parsed < 1) return 1;
  if (parsed > 5) return 5;
  return parsed;
}

function GridIcon() {
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
        d="M3 3h8v8H3V3zm10 0h8v8h-8V3zM3 13h8v8H3v-8zm10 0h8v8h-8v-8z"
      />
    </svg>
  );
}

function ImageIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width="22"
      height="22"
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
// Child: core/grid-item
// ---------------------------------------------------------------------------
function registerGridItem() {
  try {
    unregisterBlockType(GRID_ITEM_BLOCK);
  } catch {
    // safe fallback
  }

  registerBlockType(GRID_ITEM_BLOCK, {
    apiVersion: 3,
    title: 'Grid Item',
    description: 'Single image tile with title overlay and action.',
    category: APPBUILDER_CATEGORY,
    parent: [GRID_BLOCK],
    icon: 'format-image',
    supports: { html: false, reusable: false },
    attributes: {
      imageUrl: { type: 'string', default: '' },
      imageWidth: { type: 'number', default: 0 },
      imageHeight: { type: 'number', default: 0 },
      showImageTitle: { type: 'boolean', default: true },
      imageTitle: { type: 'string', default: 'Set' },
      action: { type: 'object', default: {} },
    },

    edit: ({ attributes, setAttributes, clientId }) => {
      const { imageUrl, showImageTitle, imageTitle, action } = attributes;
      const blockProps = useBlockProps({
        className: 'appbuilder-grid-item-editor',
      });

      return (
        <>
          <InspectorControls group="content">
            <div style={contentTabStyle}>
              <ParentBlockBackButton clientId={clientId} />
              <PanelBody title="Grid Item Settings" initialOpen={true}>
                <ImagePicker
                  imageUrl={imageUrl}
                  onSelect={(media) => setAttributes(imageAttributesFromMedia(media))}
                  onClear={() => setAttributes(clearImageAttributes())}
                />
                <ToggleControl
                  label="Show Image Title"
                  checked={showImageTitle ?? true}
                  onChange={(val) => setAttributes({ showImageTitle: val })}
                />
                {(showImageTitle ?? true) ? (
                  <TextControl
                    label="Image Title"
                    value={imageTitle ?? 'Set'}
                    onChange={(val) => setAttributes({ imageTitle: val })}
                  />
                ) : null}
                <ActionBuilder
                  label="Item Action"
                  value={action ?? {}}
                  onChange={(next) => setAttributes({ action: next })}
                />
              </PanelBody>
            </div>
          </InspectorControls>

          <div {...blockProps}>
            <div className="appbuilder-grid-item__content">
              <div className="appbuilder-grid-item__card">
                {imageUrl ? (
                  <MediaUploadCheck>
                    <MediaUpload
                      onSelect={(media) => setAttributes(imageAttributesFromMedia(media))}
                      allowedTypes={['image']}
                      render={({ open }) => (
                        <img
                          src={imageUrl}
                          alt={imageTitle || ''}
                          className="appbuilder-grid-item__image"
                          onClick={open}
                          style={{ cursor: 'pointer' }}
                          title="Click to change image"
                        />
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
                          className="appbuilder-grid-item__placeholder"
                          style={{ cursor: 'pointer' }}
                          title="Click to select image"
                        >
                          <ImageIcon />
                          <span>Select Image</span>
                        </div>
                      )}
                    />
                  </MediaUploadCheck>
                )}

                <div className="appbuilder-grid-item__overlay">
                  {(showImageTitle ?? true) && imageTitle ? (
                    <span className="appbuilder-grid-item__title">{imageTitle}</span>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        </>
      );
    },

    save: ({ attributes }) => {
      const {
        imageUrl,
        imageWidth,
        imageHeight,
        showImageTitle,
        imageTitle,
        action,
      } = attributes;

      const blockProps = useBlockProps.save({
        className: 'appbuilder-grid-item',
        'data-image-url': imageUrl ?? '',
        'data-image-width': String(imageWidth ?? 0),
        'data-image-height': String(imageHeight ?? 0),
        'data-show-image-title': String(showImageTitle ?? true),
        'data-image-title': imageTitle ?? '',
        'data-action': JSON.stringify(action ?? {}),
      });

      return (
        <div {...blockProps}>
          <div className="appbuilder-grid-item__card">
            {imageUrl ? (
              <img
                src={imageUrl}
                alt={imageTitle || ''}
                className="appbuilder-grid-item__image"
              />
            ) : null}
            <div className="appbuilder-grid-item__overlay">
              {(showImageTitle ?? true) && imageTitle ? (
                <span className="appbuilder-grid-item__title">{imageTitle}</span>
              ) : null}
            </div>
          </div>
        </div>
      );
    },
  });
}

// ---------------------------------------------------------------------------
// Parent: core/grid
// ---------------------------------------------------------------------------
export function registerGrid() {
  registerGridItem();

  try {
    unregisterBlockType(GRID_BLOCK);
  } catch {
    // safe fallback
  }

  registerBlockType(GRID_BLOCK, {
    apiVersion: 3,
    title: 'Grid',
    description: 'Responsive CSS grid layout block with custom columns (1-5), split mode, gap options, and actions.',
    category: APPBUILDER_CATEGORY,
    icon: GridIcon,
    supports: { html: false, align: ['wide', 'full'] },
    attributes: {
      gridTitle: { type: 'string', default: DEFAULT_GRID_TITLE },
      showGridTitle: { type: 'boolean', default: true },
      showButton: { type: 'boolean', default: true },
      buttonText: { type: 'string', default: DEFAULT_BUTTON_TEXT },
      column: { type: 'number', default: DEFAULT_COLUMN },
      enableGap: { type: 'boolean', default: true },
      enableSplit: { type: 'boolean', default: false },
      action: { type: 'object', default: {} },
    },

    edit: ({ attributes, setAttributes, clientId }) => {
      const {
        gridTitle,
        showGridTitle,
        showButton,
        buttonText,
        column,
        enableGap,
        enableSplit,
        action,
      } = attributes;

      const [selectedItemIndex, setSelectedItemIndex] = useState(0);
      const colVal = clampColumn(column);

      const { childBlocks, childCount, insertBlock, removeBlock, updateBlockAttributes } =
        useChildBlocks(clientId);
      const { selectBlock, moveBlocksUp, moveBlocksDown } = useDispatch('core/block-editor');

      const blockProps = useBlockProps({
        className: `appbuilder-grid-editor ${enableGap ? 'has-gap' : 'no-gap'} ${enableSplit ? 'is-split' : 'is-standard'}`,
        style: {
          '--appbuilder-grid-columns': String(colVal),
        },
      });

      const handleAddItem = () => {
        const newBlock = createBlock(GRID_ITEM_BLOCK, {
          imageTitle: 'Set',
          showImageTitle: true,
        });
        insertBlock(newBlock, childCount, clientId);
        setSelectedItemIndex(childCount);
      };

      const handleSelectItem = (index) => {
        setSelectedItemIndex(index);
        const child = childBlocks[index];
        if (child?.clientId && selectBlock) {
          selectBlock(child.clientId);
        }
      };

      const selectedChild = childBlocks[selectedItemIndex];

      return (
        <>
          <InspectorControls group="content">
            <div style={contentTabStyle}>
              <PanelBody title="Header Settings" initialOpen={true}>
                <ToggleControl
                  label="Show Grid Title"
                  checked={showGridTitle ?? true}
                  onChange={(val) => setAttributes({ showGridTitle: val })}
                />
                {(showGridTitle ?? true) ? (
                  <TextControl
                    label="Grid Title"
                    value={gridTitle ?? DEFAULT_GRID_TITLE}
                    onChange={(val) => setAttributes({ gridTitle: val })}
                  />
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

              <PanelBody title="Grid Layout Settings" initialOpen={true}>
                <RangeControl
                  label="Column (1-5)"
                  value={colVal}
                  onChange={(val) => setAttributes({ column: clampColumn(val) })}
                  min={1}
                  max={5}
                  step={1}
                />
                <ToggleControl
                  label="Enable Gap"
                  checked={enableGap ?? true}
                  onChange={(val) => setAttributes({ enableGap: val })}
                />
                <ToggleControl
                  label="Enable Split"
                  checked={enableSplit ?? false}
                  onChange={(val) => setAttributes({ enableSplit: val })}
                />
              </PanelBody>

              <PanelBody title={`Grid Items (${childCount})`} initialOpen={true}>
                <Button
                  variant="primary"
                  onClick={handleAddItem}
                  style={{ width: '100%', marginBottom: '12px', justifyContent: 'center' }}
                >
                  + Add Grid Item
                </Button>

                {childBlocks.map((child, index) => (
                  <div
                    key={child.clientId}
                    onClick={() => handleSelectItem(index)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '8px 10px',
                      marginBottom: '6px',
                      borderRadius: '6px',
                      border:
                        selectedItemIndex === index
                          ? '2px solid #007cba'
                          : '1px solid #e2e8f0',
                      background: selectedItemIndex === index ? '#f0f7fc' : '#fff',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <span style={{ fontSize: '13px', fontWeight: 600, color: '#1e293b' }}>
                      {child.attributes?.imageTitle || `Item ${index + 1}`}
                    </span>
                    <div style={{ display: 'flex', gap: '4px' }}>
                      {index > 0 ? (
                        <Button
                          variant="tertiary"
                          compact
                          onClick={(e) => {
                            e.stopPropagation();
                            moveBlocksUp([child.clientId], clientId);
                            setSelectedItemIndex(index - 1);
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
                            setSelectedItemIndex(index + 1);
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
                          if (selectedItemIndex >= childCount - 1) {
                            setSelectedItemIndex(Math.max(0, childCount - 2));
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
                      Configure Grid Item {selectedItemIndex + 1}
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
                    <ToggleControl
                      label="Show Image Title"
                      checked={selectedChild.attributes?.showImageTitle ?? true}
                      onChange={(val) =>
                        updateBlockAttributes(selectedChild.clientId, { showImageTitle: val })}
                    />
                    {(selectedChild.attributes?.showImageTitle ?? true) ? (
                      <TextControl
                        label="Image Title"
                        value={selectedChild.attributes?.imageTitle ?? 'Set'}
                        onChange={(val) =>
                          updateBlockAttributes(selectedChild.clientId, { imageTitle: val })}
                      />
                    ) : null}
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

          <div {...blockProps}>
            {(showGridTitle ?? true) || (showButton ?? true) ? (
              <div className="appbuilder-grid__header">
                {(showGridTitle ?? true) ? (
                  <RichText
                    tagName="h3"
                    className="appbuilder-grid__title"
                    value={gridTitle ?? DEFAULT_GRID_TITLE}
                    onChange={(val) => setAttributes({ gridTitle: val })}
                    placeholder="Enter Grid Title..."
                    allowedFormats={[]}
                  />
                ) : <div />}
                {(showButton ?? true) ? (
                  <button type="button" className="appbuilder-grid__header-btn">
                    {buttonText ?? DEFAULT_BUTTON_TEXT}
                  </button>
                ) : null}
              </div>
            ) : null}

            <InnerBlocks
              allowedBlocks={[GRID_ITEM_BLOCK]}
              renderAppender={InnerBlocks.ButtonBlockAppender}
              template={[
                [
                  GRID_ITEM_BLOCK,
                  {
                    imageTitle: 'BUILT FOR PERFORMANCE',
                    showImageTitle: true,
                  },
                ],
                [
                  GRID_ITEM_BLOCK,
                  {
                    imageTitle: 'EASY & BREEZY',
                    showImageTitle: true,
                  },
                ],
                [
                  GRID_ITEM_BLOCK,
                  {
                    imageTitle: 'HOT DAYS SORTED',
                    showImageTitle: true,
                  },
                ],
                [
                  GRID_ITEM_BLOCK,
                  {
                    imageTitle: 'ADVENTURE APPROVED',
                    showImageTitle: true,
                  },
                ],
              ]}
            />
          </div>
        </>
      );
    },

    save: ({ attributes }) => {
      const {
        gridTitle,
        showGridTitle,
        showButton,
        buttonText,
        column,
        enableGap,
        enableSplit,
        action,
      } = attributes;

      const colVal = clampColumn(column);

      const blockProps = useBlockProps.save({
        className: `appbuilder-grid ${enableGap ? 'has-gap' : 'no-gap'} ${enableSplit ? 'is-split' : 'is-standard'}`,
        'data-grid-title': gridTitle ?? '',
        'data-show-grid-title': String(showGridTitle ?? true),
        'data-show-button': String(showButton ?? true),
        'data-button-text': buttonText ?? '',
        'data-column': String(colVal),
        'data-enable-gap': String(enableGap ?? true),
        'data-enable-split': String(enableSplit ?? false),
        'data-action': JSON.stringify(action ?? {}),
        style: {
          '--appbuilder-grid-columns': String(colVal),
        },
      });

      return (
        <div {...blockProps}>
          {(showGridTitle ?? true) || (showButton ?? true) ? (
            <div className="appbuilder-grid__header">
              {(showGridTitle ?? true) ? (
                <RichText.Content
                  tagName="h3"
                  className="appbuilder-grid__title"
                  value={gridTitle ?? DEFAULT_GRID_TITLE}
                />
              ) : <div />}
              {(showButton ?? true) ? (
                <button type="button" className="appbuilder-grid__header-btn">
                  {buttonText ?? DEFAULT_BUTTON_TEXT}
                </button>
              ) : null}
            </div>
          ) : null}

          <div
            className={`appbuilder-grid__layout ${enableGap ? 'has-gap' : 'no-gap'} ${enableSplit ? 'is-split' : 'is-standard'}`}
            style={{
              '--appbuilder-grid-columns': String(colVal),
            }}
          >
            <InnerBlocks.Content />
          </div>
        </div>
      );
    },
  });
}
