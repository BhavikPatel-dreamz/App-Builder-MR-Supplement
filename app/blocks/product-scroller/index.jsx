// @ts-nocheck
import { useState } from 'gutenberg-block-kit/wp/element';
import { registerBlockType, createBlock, unregisterBlockType } from 'gutenberg-block-kit/wp/blocks';
import {
  useBlockProps,
  InnerBlocks,
  InspectorControls,
  RichText,
} from 'gutenberg-block-kit/wp/block-editor';
import {
  PanelBody,
  TextControl,
  ToggleControl,
  SelectControl,
  RangeControl,
  Button,
} from 'gutenberg-block-kit/wp/components';
import { useSelect, useDispatch } from 'gutenberg-block-kit/wp/data';
import { ActionBuilder } from 'gutenberg-block-kit/actions';
import {
  ColorSettingsPanel,
  contentTabStyle,
  useTrackPagination,
  SliderPaginationDots,
  useChildBlocks,
  ImagePicker,
  imageAttributesFromMedia,
  ParentBlockBackButton,
} from '../inspector-shared';
import {
  PRODUCT_SCROLLER_BLOCK,
  PRODUCT_SCROLLER_ITEM_BLOCK,
  APPBUILDER_CATEGORY,
} from '../constants';

const DEFAULT_BACKGROUND = '#f8fafc';
const DEFAULT_TITLE = 'Best Sellers';
const DEFAULT_BUTTON_TEXT = 'Shop All';
const DEFAULT_ACTIVE_DOT = '#0f172a';
const DEFAULT_INACTIVE_DOT = '#cbd5e1';
const DEFAULT_PADDING = 30;
const DEFAULT_MARGIN = 0;
const DEFAULT_GAP = 16;
const DEFAULT_CARD_RADIUS = 12;

function ProductScrollerIcon() {
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
        d="M3 5h5v14H3V5zm6 0h6v14H9V5zm7 0h5v14h-5V5z"
      />
    </svg>
  );
}

function HeartIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  );
}

// App Bridge v4 Shopify product picker. Returns array of { id, handle, title, imageUrl, price, compareAtPrice, badgeText }
async function pickProducts(initialProducts = []) {
  const picker =
    typeof window !== 'undefined' ? window.shopify?.resourcePicker : null;
  if (!picker) return null;
  try {
    const selection = await picker({
      type: 'product',
      multiple: true,
      selectionIds: Array.isArray(initialProducts)
        ? initialProducts.map((p) => ({ id: p.id }))
        : [],
    });
    if (!selection || !Array.isArray(selection)) return null;
    return selection.map((prod) => {
      const variant = prod.variants?.[0] || {};
      return {
        id: prod.id,
        handle: prod.handle,
        title: prod.title,
        imageUrl: prod.images?.[0]?.originalSrc || prod.images?.[0]?.src || '',
        price: variant.price ? `$${variant.price}` : '$29.00',
        compareAtPrice: variant.compareAtPrice ? `$${variant.compareAtPrice}` : '',
        badgeText: variant.compareAtPrice ? 'SALE' : '',
        rating: '4.8',
      };
    });
  } catch (err) {
    console.error('ResourcePicker error:', err);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Child: core/product-scroller-item
// ---------------------------------------------------------------------------
function registerProductScrollerItem() {
  try {
    unregisterBlockType(PRODUCT_SCROLLER_ITEM_BLOCK);
  } catch {
    // safe fallback
  }

  registerBlockType(PRODUCT_SCROLLER_ITEM_BLOCK, {
    apiVersion: 3,
    title: 'Product Scroller Item',
    description: 'Group of Shopify products added via default product picker.',
    category: APPBUILDER_CATEGORY,
    parent: [PRODUCT_SCROLLER_BLOCK],
    icon: 'products',
    supports: { html: false, reusable: false },
    attributes: {
      products: { type: 'array', default: [] },
    },

    edit: ({ attributes, setAttributes, clientId }) => {
      const { products } = attributes;
      const [editingProductIdx, setEditingProductIdx] = useState(0);

      const blockProps = useBlockProps({
        className: 'appbuilder-product-scroller-item-editor',
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

      const handlePickProducts = async () => {
        const picked = await pickProducts(products);
        if (picked) {
          setAttributes({ products: picked });
        }
      };

      const handleRemoveProduct = (index) => {
        const updated = (products || []).filter((_, i) => i !== index);
        setAttributes({ products: updated });
        if (editingProductIdx >= updated.length) {
          setEditingProductIdx(Math.max(0, updated.length - 1));
        }
      };

      const handleAddDemoProduct = () => {
        const demo = {
          id: `gid://shopify/Product/${Date.now()}`,
          handle: `demo-product-${Date.now()}`,
          title: 'Premium Organic Cotton Tee',
          imageUrl: 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=600',
          price: '$34.00',
          compareAtPrice: '$45.00',
          badgeText: 'HOT',
          rating: '4.9',
        };
        const updated = [...(products || []), demo];
        setAttributes({ products: updated });
        setEditingProductIdx(updated.length - 1);
      };

      const updateProductAt = (index, field, val) => {
        const updated = (products || []).map((p, i) =>
          i === index ? { ...p, [field]: val } : p,
        );
        setAttributes({ products: updated });
      };

      const hasProducts = Array.isArray(products) && products.length > 0;
      const selectedProduct = hasProducts ? products[editingProductIdx] : null;

      return (
        <>
          <InspectorControls group="content">
            <div style={contentTabStyle}>
              <ParentBlockBackButton clientId={clientId} />
              <PanelBody title="Product Selection" initialOpen={true}>
                <Button
                  variant="primary"
                  onClick={handlePickProducts}
                  style={{ width: '100%', justifyContent: 'center', marginBottom: '8px' }}
                >
                  {hasProducts ? 'Change Products Selection' : 'Select Shopify Products'}
                </Button>

                <Button
                  variant="tertiary"
                  onClick={handleAddDemoProduct}
                  style={{ width: '100%', justifyContent: 'center', marginBottom: '12px' }}
                >
                  + Add Demo Product
                </Button>

                {hasProducts ? (
                  <div>
                    <p style={{ fontSize: '12px', fontWeight: 600, color: '#334155', margin: '0 0 8px' }}>
                      Selected Products ({products.length}):
                    </p>
                    {products.map((prod, idx) => (
                      <div
                        key={prod.id || idx}
                        onClick={() => setEditingProductIdx(idx)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '8px',
                          marginBottom: '6px',
                          background: editingProductIdx === idx ? '#f0f7fc' : '#ffffff',
                          border: editingProductIdx === idx ? '2px solid #007cba' : '1px solid #e2e8f0',
                          borderRadius: '8px',
                          cursor: 'pointer',
                          boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
                        }}
                      >
                        <div style={{ overflow: 'hidden' }}>
                          <span style={{ fontSize: '12px', fontWeight: 700, display: 'block', color: '#0f172a' }}>
                            {prod.title}
                          </span>
                          <span style={{ fontSize: '11px', color: '#64748b', display: 'block' }}>
                            {prod.price || '$29.00'} • {prod.handle}
                          </span>
                        </div>
                        <Button
                          variant="link"
                          isDestructive
                          compact
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRemoveProduct(idx);
                          }}
                        >
                          ✕
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : null}
              </PanelBody>

              {selectedProduct ? (
                <PanelBody title={`Edit Product #${editingProductIdx + 1}`} initialOpen={true}>
                  <TextControl
                    label="Product Title"
                    value={selectedProduct.title ?? ''}
                    onChange={(val) => updateProductAt(editingProductIdx, 'title', val)}
                  />
                  <TextControl
                    label="Price"
                    value={selectedProduct.price ?? ''}
                    onChange={(val) => updateProductAt(editingProductIdx, 'price', val)}
                  />
                  <TextControl
                    label="Compare-at Price (Discount)"
                    value={selectedProduct.compareAtPrice ?? ''}
                    onChange={(val) => updateProductAt(editingProductIdx, 'compareAtPrice', val)}
                  />
                  <TextControl
                    label="Badge Text (e.g. SALE, HOT)"
                    value={selectedProduct.badgeText ?? ''}
                    onChange={(val) => updateProductAt(editingProductIdx, 'badgeText', val)}
                  />
                  <TextControl
                    label="Rating (e.g. 4.9)"
                    value={selectedProduct.rating ?? '4.8'}
                    onChange={(val) => updateProductAt(editingProductIdx, 'rating', val)}
                  />
                  <ImagePicker
                    imageUrl={selectedProduct.imageUrl}
                    onSelect={(media) => {
                      const attrs = imageAttributesFromMedia(media);
                      if (attrs?.imageUrl) {
                        updateProductAt(editingProductIdx, 'imageUrl', attrs.imageUrl);
                      }
                    }}
                    onClear={() => updateProductAt(editingProductIdx, 'imageUrl', '')}
                  />
                </PanelBody>
              ) : null}
            </div>
          </InspectorControls>

          <div {...blockProps}>
            <div className="appbuilder-product-scroller-item__track">
              {hasProducts ? (
                products.map((product, i) => (
                  <div key={product.id || i} className="appbuilder-product-scroller__card">
                    <div className="appbuilder-product-scroller__card-media">
                      {product.imageUrl ? (
                        <img
                          className="appbuilder-product-scroller__card-image"
                          src={product.imageUrl}
                          alt={product.title}
                        />
                      ) : (
                        <div className="appbuilder-product-scroller__card-placeholder-img" />
                      )}

                      {product.badgeText ? (
                        <span className="appbuilder-product-scroller__badge">{product.badgeText}</span>
                      ) : null}

                      <button type="button" className="appbuilder-product-scroller__wishlist-btn" title="Add to Wishlist">
                        <HeartIcon />
                      </button>
                    </div>

                    <div className="appbuilder-product-scroller__card-body">
                      <p className="appbuilder-product-scroller__card-title">{product.title}</p>

                      <div className="appbuilder-product-scroller__card-price-row">
                        <span className="appbuilder-product-scroller__card-price">{product.price || '$29.00'}</span>
                        {product.compareAtPrice ? (
                          <span className="appbuilder-product-scroller__card-compare-price">{product.compareAtPrice}</span>
                        ) : null}
                      </div>

                      <div className="appbuilder-product-scroller__card-rating">
                        <span style={{ color: '#f59e0b', fontSize: '11px' }}>★★★★★</span>
                        <span style={{ fontSize: '11px', color: '#64748b', marginLeft: '4px' }}>{product.rating || '4.8'}</span>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div
                  className="appbuilder-product-scroller__card appbuilder-product-scroller__card--placeholder"
                  onClick={handlePickProducts}
                  style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px', textAlign: 'center' }}
                >
                  <span style={{ fontSize: '13px', fontWeight: 600, color: '#007cba' }}>
                    + Select Shopify Products
                  </span>
                </div>
              )}
            </div>
          </div>
        </>
      );
    },

    save: ({ attributes }) => {
      const { products } = attributes;
      const blockProps = useBlockProps.save({
        className: 'appbuilder-product-scroller-item',
        'data-products': JSON.stringify(products ?? []),
      });

      return (
        <div {...blockProps}>
          {(products || []).map((product) => (
            <div
              key={product.id || product.handle}
              className="appbuilder-product-scroller__card"
              data-product-id={product.id}
              data-product-handle={product.handle}
              data-product-title={product.title}
              data-product-price={product.price}
              data-product-compare-price={product.compareAtPrice}
              data-product-badge={product.badgeText}
              data-product-rating={product.rating}
            >
              <div className="appbuilder-product-scroller__card-media">
                {product.imageUrl ? (
                  <img
                    src={product.imageUrl}
                    alt={product.title || ''}
                    className="appbuilder-product-scroller__card-image"
                  />
                ) : (
                  <div className="appbuilder-product-scroller__card-placeholder-img" />
                )}
                {product.badgeText ? (
                  <span className="appbuilder-product-scroller__badge">{product.badgeText}</span>
                ) : null}
                <button type="button" className="appbuilder-product-scroller__wishlist-btn">
                  <HeartIcon />
                </button>
              </div>

              <div className="appbuilder-product-scroller__card-body">
                <p className="appbuilder-product-scroller__card-title">{product.title}</p>
                <div className="appbuilder-product-scroller__card-price-row">
                  <span className="appbuilder-product-scroller__card-price">{product.price || '$29.00'}</span>
                  {product.compareAtPrice ? (
                    <span className="appbuilder-product-scroller__card-compare-price">{product.compareAtPrice}</span>
                  ) : null}
                </div>
                {product.rating ? (
                  <div className="appbuilder-product-scroller__card-rating">
                    <span style={{ color: '#f59e0b', fontSize: '11px' }}>★★★★★</span>
                    <span style={{ fontSize: '11px', color: '#64748b', marginLeft: '4px' }}>{product.rating}</span>
                  </div>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      );
    },
  });
}

// ---------------------------------------------------------------------------
// Parent: core/product-scroller
// ---------------------------------------------------------------------------
export function registerProductScroller() {
  registerProductScrollerItem();

  try {
    unregisterBlockType(PRODUCT_SCROLLER_BLOCK);
  } catch {
    // safe fallback
  }

  registerBlockType(PRODUCT_SCROLLER_BLOCK, {
    apiVersion: 3,
    title: 'Product Scroller',
    description: 'E-commerce style product scroller block with title, price, rating, wishlist, padding, margin, and professional styling.',
    category: APPBUILDER_CATEGORY,
    icon: ProductScrollerIcon,
    keywords: ['products', 'scroller', 'shop', 'best sellers'],
    supports: { html: false, align: ['wide', 'full'] },
    attributes: {
      title: { type: 'string', default: DEFAULT_TITLE },
      subTitle: { type: 'string', default: 'NEW SEASON ARRIVALS' },
      showTitle: { type: 'boolean', default: true },
      showButton: { type: 'boolean', default: true },
      buttonText: { type: 'string', default: DEFAULT_BUTTON_TEXT },
      backgroundColor: { type: 'string', default: DEFAULT_BACKGROUND },
      showPagination: { type: 'boolean', default: true },
      dotPosition: { type: 'string', default: 'center' },
      activeDotColor: { type: 'string', default: DEFAULT_ACTIVE_DOT },
      inActiveDotColor: { type: 'string', default: DEFAULT_INACTIVE_DOT },
      padding: { type: 'number', default: DEFAULT_PADDING },
      advancePaddingControl: {
        type: 'object',
        default: { top: 0, right: 0, bottom: 0, left: 0 },
      },
      margin: { type: 'number', default: DEFAULT_MARGIN },
      gap: { type: 'number', default: DEFAULT_GAP },
      cardBorderRadius: { type: 'number', default: DEFAULT_CARD_RADIUS },
      aspectRatio: { type: 'string', default: '3/4' },
      showSaleBadge: { type: 'boolean', default: true },
      showWishlist: { type: 'boolean', default: true },
      showCardTitle: { type: 'boolean', default: true },
      showCardPrice: { type: 'boolean', default: true },
      showCardRating: { type: 'boolean', default: true },
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
        showPagination,
        dotPosition = 'center',
        activeDotColor,
        inActiveDotColor,
        padding,
        advancePaddingControl = {},
        margin,
        gap,
        cardBorderRadius,
        aspectRatio,
        showSaleBadge,
        showWishlist,
        showCardTitle,
        showCardPrice,
        showCardRating,
        action,
      } = attributes;

      const [selectedItemIndex, setSelectedItemIndex] = useState(0);
      const [activeIndex, setActiveIndex] = useState(0);

      const { childBlocks, childCount, insertBlock, removeBlock } =
        useChildBlocks(clientId);
      const { selectBlock, moveBlocksUp, moveBlocksDown } = useDispatch('core/block-editor');

      const { trackRef, goToIndex } = useTrackPagination(activeIndex, setActiveIndex);

      const ratioVal = aspectRatio || '3/4';
      const padVal = Number.isFinite(Number(padding)) ? Number(padding) : DEFAULT_PADDING;
      const marVal = Number.isFinite(Number(margin)) ? Number(margin) : DEFAULT_MARGIN;
      const gapVal = Number.isFinite(Number(gap)) ? Number(gap) : DEFAULT_GAP;
      const cardRadiusVal = Number.isFinite(Number(cardBorderRadius)) ? Number(cardBorderRadius) : DEFAULT_CARD_RADIUS;

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

      const blockProps = useBlockProps({
        className: `appbuilder-product-scroller-editor ${!(showCardTitle ?? true) ? 'hide-card-title' : ''} ${!(showCardPrice ?? true) ? 'hide-card-price' : ''} ${!(showCardRating ?? true) ? 'hide-card-rating' : ''} ${!(showSaleBadge ?? true) ? 'hide-sale-badge' : ''} ${!(showWishlist ?? true) ? 'hide-wishlist' : ''}`,
        style: {
          '--appbuilder-product-card-aspect-ratio': ratioVal,
          '--appbuilder-product-scroller-padding': effectivePadding,
          '--appbuilder-product-scroller-margin': effectiveMargin,
          '--appbuilder-product-scroller-gap': `${gapVal}px`,
          '--appbuilder-product-scroller-card-radius': `${cardRadiusVal}px`,
          '--appbuilder-product-scroller-pagination-active': activeDotColor || DEFAULT_ACTIVE_DOT,
          '--appbuilder-product-scroller-pagination-inactive': inActiveDotColor || DEFAULT_INACTIVE_DOT,
        },
      });

      const handleAddItem = () => {
        const newBlock = createBlock(PRODUCT_SCROLLER_ITEM_BLOCK, {
          products: [
            {
              id: `gid://shopify/Product/${Date.now()}`,
              handle: 'featured-item',
              title: 'Featured Collection Product',
              imageUrl: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600',
              price: '$39.00',
              compareAtPrice: '$49.00',
              badgeText: 'SALE',
              rating: '4.9',
            },
          ],
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
                      label="Main Title"
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

              <PanelBody title="Spacing & Layout Controls" initialOpen={true}>
                <RangeControl
                  label="Block Padding (px)"
                  value={padVal}
                  onChange={(val) => setAttributes({ padding: val })}
                  min={0}
                  max={100}
                  step={2}
                />
                <RangeControl
                  label="Block Margin (px)"
                  value={marVal}
                  onChange={(val) => setAttributes({ margin: val })}
                  min={0}
                  max={100}
                  step={2}
                />
                <RangeControl
                  label="Card Gap (px)"
                  value={gapVal}
                  onChange={(val) => setAttributes({ gap: val })}
                  min={8}
                  max={40}
                  step={2}
                />
                <RangeControl
                  label="Card Border Radius (px)"
                  value={cardRadiusVal}
                  onChange={(val) => setAttributes({ cardBorderRadius: val })}
                  min={0}
                  max={30}
                  step={1}
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

              <PanelBody title="Card Text & Visibility Controls" initialOpen={false}>
                <ToggleControl
                  label="Show Card Title"
                  checked={showCardTitle ?? true}
                  onChange={(val) => setAttributes({ showCardTitle: val })}
                />
                <ToggleControl
                  label="Show Card Price"
                  checked={showCardPrice ?? true}
                  onChange={(val) => setAttributes({ showCardPrice: val })}
                />
                <ToggleControl
                  label="Show Card Rating"
                  checked={showCardRating ?? true}
                  onChange={(val) => setAttributes({ showCardRating: val })}
                />
                <ToggleControl
                  label="Show Sale Badges"
                  checked={showSaleBadge ?? true}
                  onChange={(val) => setAttributes({ showSaleBadge: val })}
                />
                <ToggleControl
                  label="Show Wishlist Button"
                  checked={showWishlist ?? true}
                  onChange={(val) => setAttributes({ showWishlist: val })}
                />
                <ToggleControl
                  label="Show Pagination"
                  checked={showPagination ?? true}
                  onChange={(val) => setAttributes({ showPagination: val })}
                />
                {(showPagination ?? true) ? (
                  <SelectControl
                    label="Dot Indicator Position"
                    value={dotPosition || 'center'}
                    options={[
                      { label: 'Left', value: 'left' },
                      { label: 'Center', value: 'center' },
                      { label: 'Right', value: 'right' },
                    ]}
                    onChange={(val) => setAttributes({ dotPosition: val })}
                  />
                ) : null}
                <SelectControl
                  label="Card Aspect Ratio"
                  value={ratioVal}
                  options={[
                    { label: 'Portrait 3:4 (Fashion Standard)', value: '3/4' },
                    { label: 'Portrait 4:5', value: '4/5' },
                    { label: 'Square 1:1', value: '1/1' },
                  ]}
                  onChange={(val) => setAttributes({ aspectRatio: val })}
                />
              </PanelBody>

              <PanelBody title={`Product Scroller Items (${childCount})`} initialOpen={true}>
                <Button
                  variant="primary"
                  onClick={handleAddItem}
                  style={{ width: '100%', marginBottom: '12px', justifyContent: 'center' }}
                >
                  + Add Product Group
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
                      Item {index + 1} ({child.attributes?.products?.length || 0} Products)
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
                  {
                    label: 'Active Pagination Dot Color',
                    value: activeDotColor || DEFAULT_ACTIVE_DOT,
                    onChange: updateColorAttribute('activeDotColor', DEFAULT_ACTIVE_DOT),
                  },
                  {
                    label: 'Inactive Pagination Dot Color',
                    value: inActiveDotColor || DEFAULT_INACTIVE_DOT,
                    onChange: updateColorAttribute('inActiveDotColor', DEFAULT_INACTIVE_DOT),
                  },
                ]}
              />
            </PanelBody>
          </InspectorControls>

          <div {...blockProps}>
            <div
              className="appbuilder-product-scroller"
              style={{
                background: backgroundColor || DEFAULT_BACKGROUND,
                padding: effectivePadding,
                margin: effectiveMargin,
              }}
            >
              {(showTitle ?? true) || (showButton ?? true) ? (
                <div className="appbuilder-product-scroller__heading">
                  {(showTitle ?? true) ? (
                    <div>
                      {subTitle ? (
                        <span className="appbuilder-product-scroller__subtitle">{subTitle}</span>
                      ) : null}
                      <RichText
                        tagName="h3"
                        className="appbuilder-product-scroller__title"
                        value={title ?? DEFAULT_TITLE}
                        onChange={(val) => setAttributes({ title: val })}
                        placeholder="Enter Title..."
                        allowedFormats={[]}
                      />
                    </div>
                  ) : <div />}

                  {(showButton ?? true) && buttonText ? (
                    <div className="appbuilder-product-scroller__button-wrap">
                      <span className="appbuilder-product-scroller__button">{buttonText}</span>
                    </div>
                  ) : null}
                </div>
              ) : null}

              <div className="appbuilder-product-scroller__track" ref={trackRef}>
                <InnerBlocks
                  allowedBlocks={[PRODUCT_SCROLLER_ITEM_BLOCK]}
                  renderAppender={InnerBlocks.ButtonBlockAppender}
                  template={[
                    [
                      PRODUCT_SCROLLER_ITEM_BLOCK,
                      {
                        products: [
                          {
                            id: 'gid://shopify/Product/1',
                            handle: 'cotton-t-shirt',
                            title: 'Built for Performance Tee',
                            imageUrl: 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=600',
                            price: '$29.00',
                            compareAtPrice: '$39.00',
                            badgeText: 'SALE',
                            rating: '4.9',
                          },
                          {
                            id: 'gid://shopify/Product/2',
                            handle: 'denim-jacket',
                            title: 'Easy & Breezy Shorts',
                            imageUrl: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=600',
                            price: '$45.00',
                            badgeText: 'NEW',
                            rating: '4.8',
                          },
                        ],
                      },
                    ],
                  ]}
                />
              </div>

              {(showPagination ?? true) ? (
                <SliderPaginationDots
                  count={Math.max(1, childCount)}
                  activeIndex={activeIndex}
                  onSelect={goToIndex}
                  className={`appbuilder-product-scroller__pagination appbuilder-product-scroller__pagination--${dotPosition || 'center'}`}
                  dotClassName="appbuilder-product-scroller__pagination-dot"
                  ariaLabelPrefix="Go to item"
                />
              ) : null}
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
        showPagination,
        dotPosition = 'center',
        activeDotColor,
        inActiveDotColor,
        padding,
        advancePaddingControl = {},
        margin,
        gap,
        cardBorderRadius,
        aspectRatio,
        showSaleBadge,
        showWishlist,
        showCardTitle,
        showCardPrice,
        showCardRating,
        action,
      } = attributes;

      const bg = backgroundColor || DEFAULT_BACKGROUND;
      const ratioVal = aspectRatio || '3/4';
      const padVal = Number.isFinite(Number(padding)) ? Number(padding) : DEFAULT_PADDING;
      const marVal = Number.isFinite(Number(margin)) ? Number(margin) : DEFAULT_MARGIN;
      const gapVal = Number.isFinite(Number(gap)) ? Number(gap) : DEFAULT_GAP;
      const cardRadiusVal = Number.isFinite(Number(cardBorderRadius)) ? Number(cardBorderRadius) : DEFAULT_CARD_RADIUS;

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
        className: `appbuilder-product-scroller ${!(showCardTitle ?? true) ? 'hide-card-title' : ''} ${!(showCardPrice ?? true) ? 'hide-card-price' : ''} ${!(showCardRating ?? true) ? 'hide-card-rating' : ''} ${!(showSaleBadge ?? true) ? 'hide-sale-badge' : ''} ${!(showWishlist ?? true) ? 'hide-wishlist' : ''}`,
        'data-title': title ?? '',
        'data-subtitle': subTitle ?? '',
        'data-show-title': String(showTitle ?? true),
        'data-show-button': String(showButton ?? true),
        'data-button-text': buttonText ?? '',
        'data-background-color': bg,
        'data-show-pagination': String(showPagination ?? true),
        'data-dot-position': dotPosition || 'center',
        'data-active-dot-color': activeDotColor || DEFAULT_ACTIVE_DOT,
        'data-inactive-dot-color': inActiveDotColor || DEFAULT_INACTIVE_DOT,
        'data-padding': String(padVal),
        'data-margin': String(marVal),
        'data-gap': String(gapVal),
        'data-card-border-radius': String(cardRadiusVal),
        'data-advance-padding': JSON.stringify(advancePaddingControl ?? {}),
        'data-aspect-ratio': ratioVal,
        'data-show-sale-badge': String(showSaleBadge ?? true),
        'data-show-wishlist': String(showWishlist ?? true),
        'data-show-card-title': String(showCardTitle ?? true),
        'data-show-card-price': String(showCardPrice ?? true),
        'data-show-card-rating': String(showCardRating ?? true),
        'data-action': JSON.stringify(action ?? {}),
        style: {
          background: bg,
          padding: effectivePadding,
          margin: effectiveMargin,
          '--appbuilder-product-card-aspect-ratio': ratioVal,
          '--appbuilder-product-scroller-padding': effectivePadding,
          '--appbuilder-product-scroller-margin': effectiveMargin,
          '--appbuilder-product-scroller-gap': `${gapVal}px`,
          '--appbuilder-product-scroller-card-radius': `${cardRadiusVal}px`,
          '--appbuilder-product-scroller-pagination-active': activeDotColor || DEFAULT_ACTIVE_DOT,
          '--appbuilder-product-scroller-pagination-inactive': inActiveDotColor || DEFAULT_INACTIVE_DOT,
        },
      });

      return (
        <div {...blockProps}>
          {(showTitle ?? true) || (showButton ?? true) ? (
            <div className="appbuilder-product-scroller__heading">
              {(showTitle ?? true) ? (
                <div>
                  {subTitle ? (
                    <span className="appbuilder-product-scroller__subtitle">{subTitle}</span>
                  ) : null}
                  {title ? (
                    <h3 className="appbuilder-product-scroller__title">{title}</h3>
                  ) : null}
                </div>
              ) : <div />}

              {(showButton ?? true) && buttonText ? (
                <div className="appbuilder-product-scroller__button-wrap">
                  <span className="appbuilder-product-scroller__button">{buttonText}</span>
                </div>
              ) : null}
            </div>
          ) : null}

          <div className="appbuilder-product-scroller__track">
            <InnerBlocks.Content />
          </div>

          {(showPagination ?? true) ? (
            <div className={`appbuilder-product-scroller__pagination appbuilder-product-scroller__pagination--${dotPosition || 'center'}`} aria-hidden="true" />
          ) : null}
        </div>
      );
    },
  });
}
