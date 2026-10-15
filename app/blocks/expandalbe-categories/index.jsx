// @ts-nocheck
import { registerBlockType, createBlock } from 'gutenberg-block-kit/wp/blocks';
import {
  useBlockProps,
  InnerBlocks,
  InspectorControls,
} from 'gutenberg-block-kit/wp/block-editor';
import {
  PanelBody,
  TextControl,
  SelectControl,
  RangeControl,
  ToggleControl,
  Button,
} from 'gutenberg-block-kit/wp/components';
import { useSelect } from 'gutenberg-block-kit/wp/data';
import { ActionBuilder } from '../../lib/gutenberg-actions';
import {
  ColorSettingsPanel,
  contentTabStyle,
  ImagePicker,
  ParentBlockBackButton,
  useChildBlocks,
} from '../inspector-shared';
import {
  EXPANDALBE_CATEGORIES_BLOCK,
  EXPANDALBE_CATEGORIES_ITEM_BLOCK,
  EXPANDALBE_SUB_CATEGORIES_ITEM_BLOCK,
  APPBUILDER_CATEGORY,
} from '../constants';

const DEFAULT_PARENT_STYLE = {
  listView: 'grid',
  imgResizeMode: 'contain',
  backgroundColor: '#FFF',
  imageBackgrounColor: '#fff',
  activeBorderColor: '#fff',
  inActiveBorderColor: '#fff',
  borderWidth: 2,
  aspectRatio: 1.2,
  horizontalPadding: 2,
  verticalPadding: 5,
  showParentArrow: true,
  parentArrowColor: '#0f172a',
  parentArrowSize: 16,
  parentCategoryTitle: '',
  parentTitleColor: '#0f172a',
};

const DEFAULT_CHILD_STYLE = {
  imgResizeMode: 'contain',
  backgroundColor: '#FFF',
  cardBackgroundColor: '#FFF',
  childImageBackgrounColor: '#fff',
  activeBorderColor: '#fff',
  textColor: '#fff',
  textSize: 10,
  showChildText: true,
  showChildTxtOnImg: true,
  imageWidht: 200,
  imageHeigth: 100,
  aspectRatio: 1.0,
  horizontalPadding: 2,
  verticalPadding: 5,
  gap: 5,
  horizontalGap: 10,
  verticalGap: 10,
};

function clamp(value, min, max, fallback) {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  return Math.min(max, Math.max(min, num));
}

function getImageUrl(media) {
  if (!media) return '';
  if (typeof media === 'string') return media;
  const item = Array.isArray(media) ? media[0] : media;
  if (!item || typeof item !== 'object') return '';
  return (
    item.url ||
    item.src ||
    item.sizes?.full?.url ||
    item.sizes?.medium?.url ||
    item.source_url ||
    ''
  );
}

function getParentContainerStyle(rootAttr) {
  const custom = (rootAttr && typeof rootAttr === 'object' && !Array.isArray(rootAttr) && rootAttr.parentContainerStyle) || {};
  return {
    listView: custom.listView === 'list' ? 'list' : 'grid',
    imgResizeMode: custom.imgResizeMode === 'cover' ? 'cover' : 'contain',
    backgroundColor: custom.backgroundColor || DEFAULT_PARENT_STYLE.backgroundColor,
    imageBackgrounColor: custom.imageBackgrounColor || DEFAULT_PARENT_STYLE.imageBackgrounColor,
    activeBorderColor: custom.activeBorderColor || DEFAULT_PARENT_STYLE.activeBorderColor,
    inActiveBorderColor: custom.inActiveBorderColor || DEFAULT_PARENT_STYLE.inActiveBorderColor,
    borderWidth: clamp(custom.borderWidth ?? DEFAULT_PARENT_STYLE.borderWidth, 1, 5, 2),
    aspectRatio: clamp(custom.aspectRatio ?? DEFAULT_PARENT_STYLE.aspectRatio, 0.1, 3, 1.2),
    horizontalPadding: clamp(custom.horizontalPadding ?? DEFAULT_PARENT_STYLE.horizontalPadding, 0, 50, 2),
    verticalPadding: clamp(custom.verticalPadding ?? DEFAULT_PARENT_STYLE.verticalPadding, 0, 50, 5),
    showParentArrow: custom.showParentArrow !== false,
    parentArrowColor: custom.parentArrowColor || DEFAULT_PARENT_STYLE.parentArrowColor,
    parentArrowSize: clamp(custom.parentArrowSize ?? DEFAULT_PARENT_STYLE.parentArrowSize, 8, 36, 16),
    parentCategoryTitle: custom.parentCategoryTitle || '',
    parentTitleColor: custom.parentTitleColor || DEFAULT_PARENT_STYLE.parentTitleColor,
  };
}

function getChildContainerStyle(rootAttr) {
  const custom = (rootAttr && typeof rootAttr === 'object' && !Array.isArray(rootAttr) && (rootAttr.childContainerStye || rootAttr.childContainerStyle)) || {};
  return {
    imgResizeMode: custom.imgResizeMode === 'cover' ? 'cover' : 'contain',
    backgroundColor: custom.backgroundColor || DEFAULT_CHILD_STYLE.backgroundColor,
    cardBackgroundColor: custom.cardBackgroundColor || DEFAULT_CHILD_STYLE.cardBackgroundColor,
    childImageBackgrounColor: custom.childImageBackgrounColor || DEFAULT_CHILD_STYLE.childImageBackgrounColor,
    activeBorderColor: custom.activeBorderColor || DEFAULT_CHILD_STYLE.activeBorderColor,
    textColor: custom.textColor || DEFAULT_CHILD_STYLE.textColor,
    textSize: clamp(custom.textSize ?? DEFAULT_CHILD_STYLE.textSize, 8, 30, 10),
    showChildText: custom.showChildText !== false,
    showChildTxtOnImg: custom.showChildTxtOnImg !== false,
    imageWidht: clamp(custom.imageWidht ?? DEFAULT_CHILD_STYLE.imageWidht, 40, 500, 200),
    imageHeigth: clamp(custom.imageHeigth ?? DEFAULT_CHILD_STYLE.imageHeigth, 40, 400, 100),
    aspectRatio: clamp(custom.aspectRatio ?? DEFAULT_CHILD_STYLE.aspectRatio, 0.1, 3, 1.0),
    horizontalPadding: clamp(custom.horizontalPadding ?? DEFAULT_CHILD_STYLE.horizontalPadding, 0, 40, 2),
    verticalPadding: clamp(custom.verticalPadding ?? DEFAULT_CHILD_STYLE.verticalPadding, 0, 40, 5),
    gap: clamp(custom.gap ?? DEFAULT_CHILD_STYLE.gap, 0, 40, 5),
    horizontalGap: clamp(custom.horizontalGap ?? DEFAULT_CHILD_STYLE.horizontalGap, 0, 40, 10),
    verticalGap: clamp(custom.verticalGap ?? DEFAULT_CHILD_STYLE.verticalGap, 0, 40, 10),
  };
}

function ChevronDownIcon({ size = 16, color = 'currentColor' }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="currentColor"
      style={{ color, flexShrink: 0, transition: 'transform 0.25s cubic-bezier(0.4, 0, 0.2, 1)' }}
    >
      <path
        fillRule="evenodd"
        d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
        clipRule="evenodd"
      />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Child Item: core/expandalbe-sub-categories-item
// ---------------------------------------------------------------------------
function registerExpandalbeSubCategoriesItem() {
  registerBlockType(EXPANDALBE_SUB_CATEGORIES_ITEM_BLOCK, {
    apiVersion: 3,
    title: 'Sub Category Item',
    description: 'A sub category card inside an expanded parent category.',
    category: APPBUILDER_CATEGORY,
    parent: [EXPANDALBE_CATEGORIES_ITEM_BLOCK],
    icon: 'tag',
    supports: { html: false, reusable: false },
    attributes: {
      title: { type: 'string', default: 'Full Sleeves' },
      fontColor: { type: 'string', default: '#fff' },
      fontSize: { type: 'number', default: 10 },
      image: { type: 'string', default: '' },
      imageUrl: { type: 'string', default: '' },
      action: { type: 'object', default: {} },
    },

    edit: ({ attributes, setAttributes, clientId }) => {
      const title = attributes?.title ?? 'Full Sleeves';
      const fontColor = attributes?.fontColor ?? '#fff';
      const fontSize = attributes?.fontSize ?? 10;
      const displayImage = getImageUrl(attributes?.image || attributes?.imageUrl);
      const action = attributes?.action ?? {};

      const rootAttributes = useSelect(
        (select) => {
          try {
            const editor = select('core/block-editor');
            if (!editor || !editor.getBlockParents) return {};
            const parents = editor.getBlockParents(clientId);
            if (!parents || !parents.length) return {};
            for (let i = 0; i < parents.length; i++) {
              const pId = parents[i];
              if (!pId) continue;
              const name = editor.getBlockName ? editor.getBlockName(pId) : (editor.getBlock(pId)?.name || '');
              if (name === EXPANDALBE_CATEGORIES_BLOCK) {
                return editor.getBlockAttributes ? (editor.getBlockAttributes(pId) || {}) : {};
              }
            }
            const topId = parents[0];
            return topId && editor.getBlockAttributes ? (editor.getBlockAttributes(topId) || {}) : {};
          } catch (err) {
            return {};
          }
        },
        [clientId],
      );

      const childStyle = getChildContainerStyle(rootAttributes);
      const blockProps = useBlockProps({ className: 'appbuilder-expandalbe-sub-categories-item-editor' });

      const cardTitle = title || 'Sub Category';
      const textColor = fontColor || childStyle.textColor || '#fff';
      const textSize = fontSize || childStyle.textSize || 10;

      return (
        <>
          <InspectorControls group="content">
            <div style={contentTabStyle}>
              <ParentBlockBackButton clientId={clientId} />
              <PanelBody title="Sub Category Settings" initialOpen={true}>
                <ImagePicker
                  imageUrl={displayImage}
                  onSelect={(media) => {
                    const url = getImageUrl(media);
                    setAttributes({ image: url, imageUrl: url });
                  }}
                  onClear={() => setAttributes({ image: '', imageUrl: '' })}
                />
                <TextControl
                  label="Title"
                  value={title}
                  onChange={(val) => setAttributes({ title: val })}
                />
                <TextControl
                  label="Font color"
                  value={fontColor}
                  onChange={(val) => setAttributes({ fontColor: val })}
                />
                <RangeControl
                  label="Font size"
                  value={fontSize}
                  min={8}
                  max={32}
                  onChange={(val) => setAttributes({ fontSize: val })}
                />
                <ActionBuilder
                  label="Action"
                  value={action}
                  onChange={(next) => setAttributes({ action: next })}
                />
              </PanelBody>
            </div>
          </InspectorControls>

          <div {...blockProps}>
            <div
              className="appbuilder-expandalbe-sub-categories-item__card"
              style={{
                backgroundColor: childStyle.cardBackgroundColor || childStyle.backgroundColor || '#FFF',
                padding: `${childStyle.verticalPadding}px ${childStyle.horizontalPadding}px`,
                gap: `${childStyle.gap}px`,
              }}
            >
              <div
                className="appbuilder-expandalbe-sub-categories-item__image-wrap"
                style={{
                  backgroundColor: childStyle.childImageBackgrounColor || '#fff',
                  aspectRatio: `${childStyle.aspectRatio}`,
                  maxHeight: childStyle.imageHeigth ? `${childStyle.imageHeigth}px` : undefined,
                  maxWidth: childStyle.imageWidht ? `${childStyle.imageWidht}px` : '100%',
                }}
              >
                {displayImage ? (
                  <img
                    src={displayImage}
                    alt={cardTitle}
                    className="appbuilder-expandalbe-sub-categories-item__image"
                    style={{ objectFit: childStyle.imgResizeMode || 'contain' }}
                  />
                ) : (
                  <div className="appbuilder-expandalbe-sub-categories-item__placeholder">
                    Sub Category Item
                  </div>
                )}
                {childStyle.showChildTxtOnImg && childStyle.showChildText ? (
                  <div
                    className="appbuilder-expandalbe-sub-categories-item__overlay-title"
                    style={{ color: textColor, fontSize: `${textSize}px` }}
                  >
                    {cardTitle}
                  </div>
                ) : null}
              </div>

              {!childStyle.showChildTxtOnImg && childStyle.showChildText ? (
                <div
                  className="appbuilder-expandalbe-sub-categories-item__title"
                  style={{ color: textColor, fontSize: `${textSize}px` }}
                >
                  {cardTitle}
                </div>
              ) : null}
            </div>
          </div>
        </>
      );
    },

    save: ({ attributes }) => {
      const title = attributes?.title ?? '';
      const fontColor = attributes?.fontColor ?? '#fff';
      const fontSize = attributes?.fontSize ?? 10;
      const displayImage = getImageUrl(attributes?.image || attributes?.imageUrl);
      const action = attributes?.action ?? {};

      const blockProps = useBlockProps.save({
        className: 'appbuilder-expandalbe-sub-categories-item',
        'data-title': title,
        'data-font-color': fontColor,
        'data-font-size': fontSize,
        'data-image': displayImage,
        'data-action': JSON.stringify(action),
      });

      return (
        <div {...blockProps}>
          <div className="appbuilder-expandalbe-sub-categories-item__card">
            <div className="appbuilder-expandalbe-sub-categories-item__image-wrap">
              {displayImage ? (
                <img
                  src={displayImage}
                  alt={title}
                  className="appbuilder-expandalbe-sub-categories-item__image"
                />
              ) : null}
              <div
                className="appbuilder-expandalbe-sub-categories-item__overlay-title"
                style={{
                  color: fontColor || undefined,
                  fontSize: fontSize ? `${fontSize}px` : undefined,
                }}
              >
                {title}
              </div>
            </div>
            <div
              className="appbuilder-expandalbe-sub-categories-item__title"
              style={{
                color: fontColor || undefined,
                fontSize: fontSize ? `${fontSize}px` : undefined,
              }}
            >
              {title}
            </div>
          </div>
        </div>
      );
    },
  });
}

// ---------------------------------------------------------------------------
// Parent Item: core/expandalbe-categories-item
// ---------------------------------------------------------------------------
function registerExpandalbeCategoriesItem() {
  registerBlockType(EXPANDALBE_CATEGORIES_ITEM_BLOCK, {
    apiVersion: 3,
    title: 'Category Item',
    description: 'A parent category card with expandable child categories.',
    category: APPBUILDER_CATEGORY,
    parent: [EXPANDALBE_CATEGORIES_BLOCK],
    icon: 'archive',
    supports: { html: false, reusable: false },
    attributes: {
      title: { type: 'string', default: 'T-shirts For Men' },
      fontColor: { type: 'string', default: '#fff' },
      fontSize: { type: 'number', default: 10 },
      image: { type: 'string', default: '' },
      imageUrl: { type: 'string', default: '' },
      action: { type: 'object', default: {} },
      expanded: { type: 'boolean', default: false },
    },

    edit: ({ attributes, setAttributes, clientId }) => {
      const title = attributes?.title ?? 'T-shirts For Men';
      const fontColor = attributes?.fontColor ?? '#fff';
      const fontSize = attributes?.fontSize ?? 10;
      const displayImage = getImageUrl(attributes?.image || attributes?.imageUrl);
      const action = attributes?.action ?? {};
      const expanded = Boolean(attributes?.expanded);

      const rootAttributes = useSelect(
        (select) => {
          try {
            const editor = select('core/block-editor');
            if (!editor || !editor.getBlockParents) return {};
            const parents = editor.getBlockParents(clientId);
            if (!parents || !parents.length) return {};
            for (let i = 0; i < parents.length; i++) {
              const pId = parents[i];
              if (!pId) continue;
              const name = editor.getBlockName ? editor.getBlockName(pId) : (editor.getBlock(pId)?.name || '');
              if (name === EXPANDALBE_CATEGORIES_BLOCK) {
                return editor.getBlockAttributes ? (editor.getBlockAttributes(pId) || {}) : {};
              }
            }
            const topId = parents[0];
            return topId && editor.getBlockAttributes ? (editor.getBlockAttributes(topId) || {}) : {};
          } catch (err) {
            return {};
          }
        },
        [clientId],
      );

      const { childBlocks, childCount, insertBlock, removeBlock, updateBlockAttributes } =
        useChildBlocks(clientId);

      const parentStyle = getParentContainerStyle(rootAttributes);
      const childStyle = getChildContainerStyle(rootAttributes);
      const blockProps = useBlockProps({ className: 'appbuilder-expandalbe-categories-item-editor' });

      const cardTitle = title || 'Parent Category';
      const textColor = fontColor || parentStyle.parentTitleColor || '#fff';
      const textSize = fontSize || 10;

      const handleToggleExpand = (e) => {
        if (e && typeof e.stopPropagation === 'function') {
          e.stopPropagation();
        }
        setAttributes({ expanded: !expanded });
      };

      const handleAddSubCategory = (e) => {
        if (e && typeof e.stopPropagation === 'function') {
          e.stopPropagation();
        }
        insertBlock(
          createBlock(EXPANDALBE_SUB_CATEGORIES_ITEM_BLOCK, {
            title: 'New Sub Category',
            fontColor: '#fff',
            fontSize: 10,
          }),
          childCount,
          clientId,
        );
        if (!expanded) {
          setAttributes({ expanded: true });
        }
      };

      return (
        <>
          <InspectorControls group="content">
            <div style={contentTabStyle}>
              <ParentBlockBackButton clientId={clientId} />
              <PanelBody title="Parent Category Item" initialOpen={true}>
                <ImagePicker
                  imageUrl={displayImage}
                  onSelect={(media) => {
                    const url = getImageUrl(media);
                    setAttributes({ image: url, imageUrl: url });
                  }}
                  onClear={() => setAttributes({ image: '', imageUrl: '' })}
                />
                <TextControl
                  label="Title"
                  value={title}
                  onChange={(val) => setAttributes({ title: val })}
                />
                <TextControl
                  label="Font color"
                  value={fontColor}
                  onChange={(val) => setAttributes({ fontColor: val })}
                />
                <RangeControl
                  label="Font size"
                  value={fontSize}
                  min={8}
                  max={36}
                  onChange={(val) => setAttributes({ fontSize: val })}
                />
                <ToggleControl
                  label="Expanded state"
                  checked={expanded}
                  onChange={(val) => setAttributes({ expanded: val })}
                />
                <ActionBuilder
                  label="Action"
                  value={action}
                  onChange={(next) => setAttributes({ action: next })}
                />
              </PanelBody>

              <PanelBody title="Manage Sub Categories" initialOpen={false}>
                <Button
                  variant="secondary"
                  onClick={handleAddSubCategory}
                  style={{ width: '100%', justifyContent: 'center', marginBottom: '10px' }}
                >
                  + Add Sub Category Item
                </Button>

                {childBlocks.map((subBlock, index) => {
                  const { title: subTitle, fontColor: subColor, fontSize: subSize, image: subImg } = subBlock.attributes;
                  const subDisplayImg = getImageUrl(subImg || subBlock.attributes.imageUrl);
                  return (
                    <div
                      key={subBlock.clientId}
                      style={{
                        padding: '10px',
                        marginBottom: '10px',
                        background: '#f8fafc',
                        border: '1px solid #e2e8f0',
                        borderRadius: '6px',
                      }}
                    >
                      <div style={{ fontWeight: 600, fontSize: '13px', marginBottom: '8px' }}>
                        Sub Category {index + 1}: {subTitle || 'Untitled'}
                      </div>
                      <ImagePicker
                        imageUrl={subDisplayImg}
                        onSelect={(media) => {
                          const url = getImageUrl(media);
                          updateBlockAttributes(subBlock.clientId, { image: url, imageUrl: url });
                        }}
                        onClear={() => updateBlockAttributes(subBlock.clientId, { image: '', imageUrl: '' })}
                      />
                      <TextControl
                        label="Sub Category Title"
                        value={subTitle}
                        onChange={(val) => updateBlockAttributes(subBlock.clientId, { title: val })}
                      />
                      <Button
                        onClick={() => removeBlock(subBlock.clientId)}
                        variant="link"
                        isDestructive
                        style={{ marginTop: '4px' }}
                      >
                        Remove Sub Category
                      </Button>
                    </div>
                  );
                })}
              </PanelBody>
            </div>
          </InspectorControls>

          <div {...blockProps}>
            <div
              className={`appbuilder-expandalbe-categories-item__card ${expanded ? 'is-expanded' : ''}`}
              style={{
                backgroundColor: parentStyle.backgroundColor || '#FFF',
                borderColor: expanded
                  ? parentStyle.activeBorderColor || '#fff'
                  : parentStyle.inActiveBorderColor || '#fff',
                borderWidth: `${parentStyle.borderWidth}px`,
                borderStyle: 'solid',
                borderRadius: '12px',
                padding: `${parentStyle.verticalPadding}px ${parentStyle.horizontalPadding}px`,
              }}
            >
              <div
                className="appbuilder-expandalbe-categories-item__header"
                onClick={handleToggleExpand}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    handleToggleExpand(e);
                  }
                }}
              >
                <div
                  className="appbuilder-expandalbe-categories-item__image-wrap"
                  style={{
                    backgroundColor: parentStyle.imageBackgrounColor || '#fff',
                    aspectRatio: `${parentStyle.aspectRatio}`,
                  }}
                >
                  {displayImage ? (
                    <img
                      src={displayImage}
                      alt={cardTitle}
                      className="appbuilder-expandalbe-categories-item__image"
                      style={{ objectFit: parentStyle.imgResizeMode || 'contain' }}
                    />
                  ) : (
                    <div className="appbuilder-expandalbe-categories-item__placeholder">
                      Category Item
                    </div>
                  )}
                </div>

                <div className="appbuilder-expandalbe-categories-item__meta">
                  <span
                    className="appbuilder-expandalbe-categories-item__title"
                    style={{ color: textColor, fontSize: `${textSize}px` }}
                  >
                    {cardTitle}
                  </span>
                  {parentStyle.showParentArrow ? (
                    <span
                      className={`appbuilder-expandalbe-categories-item__arrow ${expanded ? 'is-open' : ''}`}
                    >
                      <ChevronDownIcon
                        size={parentStyle.parentArrowSize || 16}
                        color={parentStyle.parentArrowColor || '#0f172a'}
                      />
                    </span>
                  ) : null}
                </div>
              </div>

              <div className={`appbuilder-expandalbe-categories-item-editor__children ${expanded ? 'is-open' : ''}`}>
                <InnerBlocks
                  allowedBlocks={[EXPANDALBE_SUB_CATEGORIES_ITEM_BLOCK]}
                  template={[
                    [EXPANDALBE_SUB_CATEGORIES_ITEM_BLOCK, { title: 'Full Sleeves', fontColor: '#fff', fontSize: 10 }],
                    [EXPANDALBE_SUB_CATEGORIES_ITEM_BLOCK, { title: 'SOLID', fontColor: '#fff', fontSize: 10 }],
                  ]}
                  templateLock={false}
                  renderAppender={InnerBlocks.ButtonBlockAppender}
                />
                <div style={{ marginTop: '10px', textAlign: 'center' }}>
                  <Button
                    variant="secondary"
                    onClick={handleAddSubCategory}
                    style={{
                      width: '100%',
                      justifyContent: 'center',
                      border: '1px dashed #cbd5e1',
                      padding: '6px 12px',
                      borderRadius: '6px',
                      fontSize: '12px',
                      fontWeight: 600,
                      color: '#0284c7',
                      backgroundColor: '#f0f9ff',
                    }}
                  >
                    + Add Sub Category
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </>
      );
    },

    save: ({ attributes }) => {
      const title = attributes?.title ?? '';
      const fontColor = attributes?.fontColor ?? '#fff';
      const fontSize = attributes?.fontSize ?? 10;
      const displayImage = getImageUrl(attributes?.image || attributes?.imageUrl);
      const action = attributes?.action ?? {};
      const expanded = Boolean(attributes?.expanded);

      const blockProps = useBlockProps.save({
        className: `appbuilder-expandalbe-categories-item ${expanded ? 'is-expanded' : ''}`,
        'data-title': title,
        'data-font-color': fontColor,
        'data-font-size': fontSize,
        'data-image': displayImage,
        'data-action': JSON.stringify(action),
        'data-expanded': expanded ? 'true' : 'false',
      });

      return (
        <div {...blockProps}>
          <div className="appbuilder-expandalbe-categories-item__card">
            <button type="button" className="appbuilder-expandalbe-categories-item__header">
              <div className="appbuilder-expandalbe-categories-item__image-wrap">
                {displayImage ? (
                  <img
                    src={displayImage}
                    alt={title}
                    className="appbuilder-expandalbe-categories-item__image"
                  />
                ) : null}
              </div>
              <div className="appbuilder-expandalbe-categories-item__meta">
                <span
                  className="appbuilder-expandalbe-categories-item__title"
                  style={{
                    color: fontColor || undefined,
                    fontSize: fontSize ? `${fontSize}px` : undefined,
                  }}
                >
                  {title}
                </span>
                <span className="appbuilder-expandalbe-categories-item__arrow">
                  <ChevronDownIcon />
                </span>
              </div>
            </button>
            <div className="appbuilder-expandalbe-categories-item__children">
              <InnerBlocks.Content />
            </div>
          </div>
        </div>
      );
    },
  });
}

// ---------------------------------------------------------------------------
// Parent Container: core/expandalbe-categories
// ---------------------------------------------------------------------------
function registerExpandalbeCategoriesParent() {
  registerBlockType(EXPANDALBE_CATEGORIES_BLOCK, {
    apiVersion: 3,
    title: 'Expandable Categories',
    description: 'A parent category layout with expandable child category cards.',
    category: APPBUILDER_CATEGORY,
    icon: 'category',
    keywords: ['expandable', 'categories', 'catalog', 'subcategories'],
    supports: { html: false, align: ['wide', 'full'] },
    attributes: {
      parentContainerStyle: {
        type: 'object',
        default: DEFAULT_PARENT_STYLE,
      },
      childContainerStye: {
        type: 'object',
        default: DEFAULT_CHILD_STYLE,
      },
      action: { type: 'object', default: {} },
    },

    edit: ({ attributes, setAttributes, clientId }) => {
      const parentStyle = getParentContainerStyle(attributes);
      const childStyle = getChildContainerStyle(attributes);
      const action = attributes?.action ?? {};

      const { childBlocks, childCount, insertBlock, removeBlock, updateBlockAttributes } =
        useChildBlocks(clientId);

      const updateParentStyle = (key, val) => {
        setAttributes({
          parentContainerStyle: {
            ...parentStyle,
            [key]: val,
          },
        });
      };

      const updateChildStyle = (key, val) => {
        setAttributes({
          childContainerStye: {
            ...childStyle,
            [key]: val,
          },
        });
      };

      const handleAddParentCategory = () => {
        insertBlock(
          createBlock(EXPANDALBE_CATEGORIES_ITEM_BLOCK, {
            title: 'New Category',
            fontColor: '#fff',
            fontSize: 10,
          }),
          childCount,
          clientId,
        );
      };

      const blockProps = useBlockProps({
        className: `appbuilder-expandalbe-categories-editor mode-${parentStyle.listView}`,
      });

      return (
        <>
          <InspectorControls group="content">
            <div style={contentTabStyle}>
              <PanelBody title="Add & Manage Categories" initialOpen={true}>
                <Button
                  variant="primary"
                  onClick={handleAddParentCategory}
                  style={{ width: '100%', justifyContent: 'center', marginBottom: '14px' }}
                >
                  + Add Parent Category Item
                </Button>

                {childBlocks.map((block, index) => {
                  const { title: itemTitle, image: itemImg } = block.attributes;
                  const itemDisplayImg = getImageUrl(itemImg || block.attributes.imageUrl);
                  return (
                    <div
                      key={block.clientId}
                      style={{
                        padding: '10px',
                        marginBottom: '10px',
                        background: '#f8fafc',
                        border: '1px solid #e2e8f0',
                        borderRadius: '6px',
                      }}
                    >
                      <div style={{ fontWeight: 600, fontSize: '13px', marginBottom: '8px' }}>
                        Category {index + 1}: {itemTitle || 'Untitled'}
                      </div>
                      <ImagePicker
                        imageUrl={itemDisplayImg}
                        onSelect={(media) => {
                          const url = getImageUrl(media);
                          updateBlockAttributes(block.clientId, { image: url, imageUrl: url });
                        }}
                        onClear={() => updateBlockAttributes(block.clientId, { image: '', imageUrl: '' })}
                      />
                      <TextControl
                        label="Category Title"
                        value={itemTitle}
                        onChange={(val) => updateBlockAttributes(block.clientId, { title: val })}
                      />
                      {childCount > 1 ? (
                        <Button
                          onClick={() => removeBlock(block.clientId)}
                          variant="link"
                          isDestructive
                          style={{ marginTop: '4px' }}
                        >
                          Remove Category
                        </Button>
                      ) : null}
                    </div>
                  );
                })}
              </PanelBody>

              <PanelBody title="Parent Layout & Settings" initialOpen={false}>
                <SelectControl
                  label="Image resize mode"
                  value={parentStyle.imgResizeMode}
                  options={[
                    { label: 'Contain', value: 'contain' },
                    { label: 'Cover', value: 'cover' },
                  ]}
                  onChange={(val) => updateParentStyle('imgResizeMode', val)}
                />
                <SelectControl
                  label="List view"
                  value={parentStyle.listView}
                  options={[
                    { label: 'Grid', value: 'grid' },
                    { label: 'List', value: 'list' },
                  ]}
                  onChange={(val) => updateParentStyle('listView', val)}
                />
                <TextControl
                  label="Parent category Title"
                  value={parentStyle.parentCategoryTitle}
                  onChange={(val) => updateParentStyle('parentCategoryTitle', val)}
                />
                <RangeControl
                  label="Border width (1 to 5)"
                  value={parentStyle.borderWidth}
                  min={1}
                  max={5}
                  onChange={(val) => updateParentStyle('borderWidth', val)}
                />
                <RangeControl
                  label="Parent card aspect ratio (1 to 2)"
                  value={parentStyle.aspectRatio}
                  min={0.1}
                  max={3}
                  step={0.1}
                  onChange={(val) => updateParentStyle('aspectRatio', val)}
                />
                <RangeControl
                  label="Horizontal padding"
                  value={parentStyle.horizontalPadding}
                  min={0}
                  max={50}
                  onChange={(val) => updateParentStyle('horizontalPadding', val)}
                />
                <RangeControl
                  label="Vertical padding"
                  value={parentStyle.verticalPadding}
                  min={0}
                  max={50}
                  onChange={(val) => updateParentStyle('verticalPadding', val)}
                />
                <ToggleControl
                  label="Parent show arrow"
                  checked={parentStyle.showParentArrow}
                  onChange={(val) => updateParentStyle('showParentArrow', val)}
                />
                <RangeControl
                  label="Parent arrow size"
                  value={parentStyle.parentArrowSize}
                  min={8}
                  max={36}
                  onChange={(val) => updateParentStyle('parentArrowSize', val)}
                />
                <ColorSettingsPanel
                  title="Parent Colors"
                  colorSettings={[
                    {
                      label: 'Background color',
                      value: parentStyle.backgroundColor,
                      onChange: (val) => updateParentStyle('backgroundColor', val || DEFAULT_PARENT_STYLE.backgroundColor),
                    },
                    {
                      label: 'Image background color',
                      value: parentStyle.imageBackgrounColor,
                      onChange: (val) => updateParentStyle('imageBackgrounColor', val || DEFAULT_PARENT_STYLE.imageBackgrounColor),
                    },
                    {
                      label: 'Active border color',
                      value: parentStyle.activeBorderColor,
                      onChange: (val) => updateParentStyle('activeBorderColor', val || DEFAULT_PARENT_STYLE.activeBorderColor),
                    },
                    {
                      label: 'In active border color',
                      value: parentStyle.inActiveBorderColor,
                      onChange: (val) => updateParentStyle('inActiveBorderColor', val || DEFAULT_PARENT_STYLE.inActiveBorderColor),
                    },
                    {
                      label: 'Parent title color',
                      value: parentStyle.parentTitleColor,
                      onChange: (val) => updateParentStyle('parentTitleColor', val || DEFAULT_PARENT_STYLE.parentTitleColor),
                    },
                    {
                      label: 'Parent arrow color',
                      value: parentStyle.parentArrowColor,
                      onChange: (val) => updateParentStyle('parentArrowColor', val || DEFAULT_PARENT_STYLE.parentArrowColor),
                    },
                  ]}
                />
              </PanelBody>

              <PanelBody title="Child Layout & Settings" initialOpen={false}>
                <SelectControl
                  label="Child Image resize mode"
                  value={childStyle.imgResizeMode}
                  options={[
                    { label: 'Contain', value: 'contain' },
                    { label: 'Cover', value: 'cover' },
                  ]}
                  onChange={(val) => updateChildStyle('imgResizeMode', val)}
                />
                <ToggleControl
                  label="Show child title"
                  checked={childStyle.showChildText}
                  onChange={(val) => updateChildStyle('showChildText', val)}
                />
                <ToggleControl
                  label="Show child title on image"
                  checked={childStyle.showChildTxtOnImg}
                  onChange={(val) => updateChildStyle('showChildTxtOnImg', val)}
                />
                <RangeControl
                  label="Child image width"
                  value={childStyle.imageWidht}
                  min={40}
                  max={500}
                  onChange={(val) => updateChildStyle('imageWidht', val)}
                />
                <RangeControl
                  label="Child image height"
                  value={childStyle.imageHeigth}
                  min={40}
                  max={400}
                  onChange={(val) => updateChildStyle('imageHeigth', val)}
                />
                <RangeControl
                  label="Child aspect ratio"
                  value={childStyle.aspectRatio}
                  min={0.1}
                  max={3}
                  step={0.1}
                  onChange={(val) => updateChildStyle('aspectRatio', val)}
                />
                <RangeControl
                  label="Horizontal padding"
                  value={childStyle.horizontalPadding}
                  min={0}
                  max={40}
                  onChange={(val) => updateChildStyle('horizontalPadding', val)}
                />
                <RangeControl
                  label="Vertical padding"
                  value={childStyle.verticalPadding}
                  min={0}
                  max={40}
                  onChange={(val) => updateChildStyle('verticalPadding', val)}
                />
                <RangeControl
                  label="Child gap"
                  value={childStyle.gap}
                  min={0}
                  max={40}
                  onChange={(val) => updateChildStyle('gap', val)}
                />
                <RangeControl
                  label="Child horizontal gap"
                  value={childStyle.horizontalGap}
                  min={0}
                  max={40}
                  onChange={(val) => updateChildStyle('horizontalGap', val)}
                />
                <RangeControl
                  label="Child vertical gap"
                  value={childStyle.verticalGap}
                  min={0}
                  max={40}
                  onChange={(val) => updateChildStyle('verticalGap', val)}
                />
                <ColorSettingsPanel
                  title="Child Colors"
                  colorSettings={[
                    {
                      label: 'Background color',
                      value: childStyle.backgroundColor,
                      onChange: (val) => updateChildStyle('backgroundColor', val || DEFAULT_CHILD_STYLE.backgroundColor),
                    },
                    {
                      label: 'Card background color',
                      value: childStyle.cardBackgroundColor,
                      onChange: (val) => updateChildStyle('cardBackgroundColor', val || DEFAULT_CHILD_STYLE.cardBackgroundColor),
                    },
                    {
                      label: 'Child image background color',
                      value: childStyle.childImageBackgrounColor,
                      onChange: (val) => updateChildStyle('childImageBackgrounColor', val || DEFAULT_CHILD_STYLE.childImageBackgrounColor),
                    },
                    {
                      label: 'Active border color',
                      value: childStyle.activeBorderColor,
                      onChange: (val) => updateChildStyle('activeBorderColor', val || DEFAULT_CHILD_STYLE.activeBorderColor),
                    },
                    {
                      label: 'Text color',
                      value: childStyle.textColor,
                      onChange: (val) => updateChildStyle('textColor', val || DEFAULT_CHILD_STYLE.textColor),
                    },
                  ]}
                />
              </PanelBody>

              <PanelBody title="Top Level Action" initialOpen={false}>
                <ActionBuilder
                  label="Action"
                  value={action}
                  onChange={(next) => setAttributes({ action: next })}
                />
              </PanelBody>
            </div>
          </InspectorControls>

          <div {...blockProps}>
            {parentStyle.parentCategoryTitle ? (
              <h3
                className="appbuilder-expandalbe-categories__section-title"
                style={{ color: parentStyle.parentTitleColor }}
              >
                {parentStyle.parentCategoryTitle}
              </h3>
            ) : null}

            <div
              className={`appbuilder-expandalbe-categories__container mode-${parentStyle.listView}`}
              style={{
                gap: `${parentStyle.verticalPadding}px`,
              }}
            >
              <InnerBlocks
                allowedBlocks={[EXPANDALBE_CATEGORIES_ITEM_BLOCK]}
                template={[
                  [
                    EXPANDALBE_CATEGORIES_ITEM_BLOCK,
                    { title: 'T-shirts For Men', fontColor: '#fff', fontSize: 10 },
                    [
                      [EXPANDALBE_SUB_CATEGORIES_ITEM_BLOCK, { title: 'Full Sleeves', fontColor: '#fff', fontSize: 10 }],
                      [EXPANDALBE_SUB_CATEGORIES_ITEM_BLOCK, { title: 'SOLID', fontColor: '#fff', fontSize: 10 }],
                    ],
                  ],
                  [
                    EXPANDALBE_CATEGORIES_ITEM_BLOCK,
                    { title: 'Hoodies For Men', fontColor: '#fff', fontSize: 10 },
                    [
                      [EXPANDALBE_SUB_CATEGORIES_ITEM_BLOCK, { title: 'Zipper Hoodies', fontColor: '#fff', fontSize: 10 }],
                      [EXPANDALBE_SUB_CATEGORIES_ITEM_BLOCK, { title: 'Pullover Hoodies', fontColor: '#fff', fontSize: 10 }],
                    ],
                  ],
                ]}
                templateLock={false}
                renderAppender={InnerBlocks.ButtonBlockAppender}
              />
            </div>

            <div style={{ marginTop: '14px', textAlign: 'center' }}>
              <Button
                variant="secondary"
                onClick={handleAddParentCategory}
                style={{
                  width: '100%',
                  justifyContent: 'center',
                  border: '1px dashed #94a3b8',
                  padding: '10px 16px',
                  borderRadius: '8px',
                  fontSize: '13px',
                  fontWeight: 600,
                  color: '#2563eb',
                  backgroundColor: '#f1f5f9',
                }}
              >
                + Add Parent Category
              </Button>
            </div>
          </div>
        </>
      );
    },

    save: ({ attributes }) => {
      const parentStyle = getParentContainerStyle(attributes);
      const childStyle = getChildContainerStyle(attributes);
      const action = attributes?.action ?? {};

      const blockProps = useBlockProps.save({
        className: `appbuilder-expandalbe-categories mode-${parentStyle.listView}`,
        'data-parent-container-style': JSON.stringify(parentStyle),
        'data-child-container-style': JSON.stringify(childStyle),
        'data-action': JSON.stringify(action),
      });

      return (
        <div {...blockProps}>
          {parentStyle.parentCategoryTitle ? (
            <h3
              className="appbuilder-expandalbe-categories__section-title"
              style={{ color: parentStyle.parentTitleColor }}
            >
              {parentStyle.parentCategoryTitle}
            </h3>
          ) : null}
          <div className={`appbuilder-expandalbe-categories__container mode-${parentStyle.listView}`}>
            <InnerBlocks.Content />
          </div>
        </div>
      );
    },
  });
}

export function registerExpandalbeCategories() {
  registerExpandalbeSubCategoriesItem();
  registerExpandalbeCategoriesItem();
  registerExpandalbeCategoriesParent();
}
