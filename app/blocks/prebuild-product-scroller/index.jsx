// @ts-nocheck
import { useState, useEffect, useCallback, useMemo } from 'gutenberg-block-kit/wp/element';
import { registerBlockType, unregisterBlockType } from 'gutenberg-block-kit/wp/blocks';
import {
  useBlockProps,
  InspectorControls,
  RichText,
} from 'gutenberg-block-kit/wp/block-editor';
import {
  PanelBody,
  TextControl,
  ToggleControl,
  SelectControl,
  Button,
} from 'gutenberg-block-kit/wp/components';
import { ActionBuilder } from 'gutenberg-block-kit/actions';
import {
  ColorSettingsPanel,
  contentTabStyle,
  useTrackPagination,
} from '../inspector-shared';
import {
  PREBUILD_PRODUCT_SCROLLER_BLOCK,
  APPBUILDER_CATEGORY,
} from '../constants';

const DEFAULT_BACKGROUND = '#f5f5f5';
const DEFAULT_TITLE = 'Most Loved By Our Customers';
const DEFAULT_SUBTITLE = 'NEW SEASON ARRIVALS';
const DEFAULT_BUTTON_TEXT = 'VIEW ALL';
const DEFAULT_ACTIVE_DOT = '#0f172a';
const DEFAULT_INACTIVE_DOT = '#cbd5e1';

function PrebuildProductScrollerIcon() {
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
        d="M4 4h16v16H4V4zm2 2v12h12V6H6zm2 2h8v5H8V8zm0 6h5v2H8v-2z"
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

// App Bridge v4 collection picker. Returns { collectionId, handle, title } or null
async function pickCollection() {
  const picker =
    typeof window !== 'undefined' ? window.shopify?.resourcePicker : null;
  if (!picker) return null;
  try {
    const selection = await picker({ type: 'collection', multiple: false });
    const collection = selection?.[0];
    if (!collection) return null;
    return {
      collectionId: collection.id,
      handle: collection.handle,
      title: collection.title,
    };
  } catch (err) {
    console.error('ResourcePicker collection error:', err);
    return null;
  }
}

// Demo fallback products for loading / preview state
const DEMO_PRODUCTS = [
  {
    id: 'gid://shopify/Product/101',
    handle: 'classic-cotton-tee',
    title: 'Classic Organic Cotton Tee',
    imageUrl: 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=600',
    price: '$29.00',
    compareAtPrice: '$39.00',
    badgeText: 'SALE',
    rating: '4.9',
  },
  {
    id: 'gid://shopify/Product/102',
    handle: 'flex-denim-shorts',
    title: 'Flex Denim Comfort Shorts',
    imageUrl: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=600',
    price: '$45.00',
    compareAtPrice: '',
    badgeText: 'NEW',
    rating: '4.8',
  },
  {
    id: 'gid://shopify/Product/103',
    handle: 'breathe-performance-hoodie',
    title: 'Breathe Performance Hoodie',
    imageUrl: 'https://images.unsplash.com/photo-1556905055-8f358a7a47b2?w=600',
    price: '$68.00',
    compareAtPrice: '$85.00',
    badgeText: 'HOT',
    rating: '5.0',
  },
  {
    id: 'gid://shopify/Product/104',
    handle: 'urban-runner-sneakers',
    title: 'Urban Runner Pro Sneakers',
    imageUrl: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600',
    price: '$110.00',
    compareAtPrice: '',
    badgeText: '',
    rating: '4.7',
  },
];

function ProductCard({ product, showWishlist = true, showSaleBadge = true }) {
  const isSale = Boolean(product.compareAtPrice);
  return (
    <div className="appbuilder-prebuild-product-scroller__card">
      <div className="appbuilder-prebuild-product-scroller__card-media">
        {product.imageUrl ? (
          <img
            className="appbuilder-prebuild-product-scroller__card-image"
            src={product.imageUrl}
            alt={product.imageAlt || product.title}
            loading="lazy"
          />
        ) : (
          <div className="appbuilder-prebuild-product-scroller__card-placeholder-img" />
        )}
        {showSaleBadge && (product.badgeText || isSale) ? (
          <span className="appbuilder-prebuild-product-scroller__badge">
            {product.badgeText || 'SALE'}
          </span>
        ) : null}
        {showWishlist ? (
          <span className="appbuilder-prebuild-product-scroller__wishlist-btn" role="button" aria-label="Add to Wishlist">
            <HeartIcon />
          </span>
        ) : null}
      </div>

      <div className="appbuilder-prebuild-product-scroller__card-body">
        <p className="appbuilder-prebuild-product-scroller__card-title">{product.title}</p>
        <div className="appbuilder-prebuild-product-scroller__card-price-row">
          <span className="appbuilder-prebuild-product-scroller__card-price">{product.price || '$29.00'}</span>
          {product.compareAtPrice ? (
            <span className="appbuilder-prebuild-product-scroller__card-compare-price">{product.compareAtPrice}</span>
          ) : null}
        </div>
        <div className="appbuilder-prebuild-product-scroller__card-rating">
          <span style={{ color: '#f59e0b', fontSize: '11px' }}>★★★★★</span>
          <span style={{ fontSize: '11px', color: '#64748b', marginLeft: '4px' }}>{product.rating || '4.8'}</span>
        </div>
      </div>
    </div>
  );
}

function ProductSkeletonCards({ count = 4 }) {
  return Array.from({ length: count }).map((_, index) => (
    <div key={index} className="appbuilder-prebuild-product-scroller__card appbuilder-prebuild-product-scroller__card--skeleton">
      <div className="appbuilder-prebuild-product-scroller__card-media appbuilder-prebuild-product-scroller__skeleton-pulse" />
      <div className="appbuilder-prebuild-product-scroller__card-body" style={{ gap: '8px' }}>
        <div className="appbuilder-prebuild-product-scroller__skeleton-pulse" style={{ height: '14px', width: '80%', borderRadius: '4px' }} />
        <div className="appbuilder-prebuild-product-scroller__skeleton-pulse" style={{ height: '12px', width: '40%', borderRadius: '4px' }} />
      </div>
    </div>
  ));
}

export function registerPrebuildProductScroller() {
  try {
    unregisterBlockType(PREBUILD_PRODUCT_SCROLLER_BLOCK);
  } catch {
    // safe fallback
  }

  registerBlockType(PREBUILD_PRODUCT_SCROLLER_BLOCK, {
    apiVersion: 3,
    title: 'Prebuild Product Scroller',
    description: 'Dynamic collection-driven product scroller and grid merchandiser component.',
    category: APPBUILDER_CATEGORY,
    icon: PrebuildProductScrollerIcon,
    keywords: ['product', 'scroller', 'collection', 'grid', 'merchandiser'],
    supports: { html: false, align: ['wide', 'full'] },
    attributes: {
      title: { type: 'string', default: DEFAULT_TITLE },
      subTitle: { type: 'string', default: DEFAULT_SUBTITLE },
      showTitle: { type: 'boolean', default: true },
      showButton: { type: 'boolean', default: true },
      buttonText: { type: 'string', default: DEFAULT_BUTTON_TEXT },
      backgroundColor: { type: 'string', default: DEFAULT_BACKGROUND },
      showPagination: { type: 'boolean', default: true },
      layoutStyle: { type: 'string', default: 'scroll' },
      numberOfProduct: { type: 'number', default: 10 },
      loadAllProduct: { type: 'boolean', default: true },
      activeDotColor: { type: 'string', default: DEFAULT_ACTIVE_DOT },
      inActiveDotColor: { type: 'string', default: DEFAULT_INACTIVE_DOT },
      aspectRatio: { type: 'string', default: '3/4' },
      showSaleBadge: { type: 'boolean', default: true },
      showWishlist: { type: 'boolean', default: true },
      showCardTitle: { type: 'boolean', default: true },
      showCardPrice: { type: 'boolean', default: true },
      showCardRating: { type: 'boolean', default: true },
      collection: {
        type: 'object',
        default: {
          collectionId: 'gid://shopify/Collection/422567658',
          handle: 'best-sellers',
          title: 'Best Sellers',
        },
      },
      action: { type: 'object', default: {} },
    },

    edit: ({ attributes, setAttributes }) => {
      const {
        title,
        subTitle,
        showTitle,
        showButton,
        buttonText,
        backgroundColor,
        showPagination,
        layoutStyle,
        numberOfProduct,
        loadAllProduct,
        activeDotColor,
        inActiveDotColor,
        aspectRatio,
        showSaleBadge,
        showWishlist,
        showCardTitle,
        showCardPrice,
        showCardRating,
        collection,
        action,
      } = attributes;

      const hasCollection = Boolean(collection && collection.collectionId);
      const [products, setProducts] = useState([]);
      const [loading, setLoading] = useState(false);
      const [error, setError] = useState(null);
      const [activeIndex, setActiveIndex] = useState(0);

      const limit = loadAllProduct ? 100 : Math.max(1, Number(numberOfProduct) || 10);

      useEffect(() => {
        if (!hasCollection) {
          setProducts([]);
          setLoading(false);
          setError(null);
          return undefined;
        }

        let cancelled = false;
        setLoading(true);
        setError(null);

        const params = new URLSearchParams({
          collectionId: String(collection.collectionId),
          limit: String(limit),
        });

        fetch(`/api/cms/collection-products?${params.toString()}`)
          .then((res) => res.json())
          .then((data) => {
            if (cancelled) return;
            if (data.error) {
              setError(data.error);
              setProducts(DEMO_PRODUCTS.slice(0, limit));
            } else if (Array.isArray(data.products) && data.products.length > 0) {
              setProducts(data.products);
            } else {
              setProducts(DEMO_PRODUCTS.slice(0, limit));
            }
          })
          .catch((err) => {
            if (!cancelled) {
              setError(err?.message || 'Failed to fetch collection products');
              setProducts(DEMO_PRODUCTS.slice(0, limit));
            }
          })
          .finally(() => {
            if (!cancelled) setLoading(false);
          });

        return () => {
          cancelled = true;
        };
      }, [hasCollection, collection?.collectionId, limit, loadAllProduct]);

      const onPickCollection = async () => {
        const picked = await pickCollection();
        if (picked) setAttributes({ collection: picked });
      };

      const displayProducts = useMemo(() => {
        if (products.length > 0) {
          return loadAllProduct ? products : products.slice(0, limit);
        }
        return DEMO_PRODUCTS.slice(0, limit);
      }, [products, loadAllProduct, limit]);

      const isScroll = (layoutStyle || 'scroll') === 'scroll';
      const visibleCount = displayProducts.length;
      const ratioVal = aspectRatio || '3/4';

      const { trackRef, goToIndex } = useTrackPagination(activeIndex, setActiveIndex);

      useEffect(() => {
        if (visibleCount <= 0) {
          setActiveIndex(0);
          return;
        }
        if (activeIndex > visibleCount - 1) setActiveIndex(visibleCount - 1);
      }, [activeIndex, visibleCount]);

      const updateColorAttribute = (key, fallback) => (nextColor) => {
        if (nextColor === undefined || nextColor === null || nextColor === '') {
          return;
        }
        setAttributes({ [key]: nextColor });
      };

      const blockProps = useBlockProps({
        className: `appbuilder-prebuild-product-scroller-editor appbuilder-prebuild-product-scroller--${layoutStyle || 'scroll'} ${!(showCardTitle ?? true) ? 'hide-card-title' : ''} ${!(showCardPrice ?? true) ? 'hide-card-price' : ''} ${!(showCardRating ?? true) ? 'hide-card-rating' : ''} ${!(showSaleBadge ?? true) ? 'hide-sale-badge' : ''} ${!(showWishlist ?? true) ? 'hide-wishlist' : ''}`,
        style: {
          '--appbuilder-product-card-aspect-ratio': ratioVal,
        },
      });

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
                      value={subTitle ?? DEFAULT_SUBTITLE}
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

              <PanelBody title="Card Text & Visibility Controls" initialOpen={true}>
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

              <PanelBody title="Collection Selection" initialOpen={true}>
                {hasCollection ? (
                  <div style={{ marginBottom: '10px', background: '#f8fafc', padding: '10px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                    <p style={{ margin: '0 0 4px', fontSize: '13px', fontWeight: 700, color: '#0f172a' }}>
                      Selected: {collection.title}
                    </p>
                    <p style={{ margin: 0, fontSize: '11px', color: '#64748b' }}>
                      Handle: {collection.handle}
                    </p>
                  </div>
                ) : (
                  <p style={{ margin: '0 0 10px', fontSize: '12px', color: '#64748b' }}>
                    No collection selected. Select a collection to load products dynamically.
                  </p>
                )}
                <Button
                  variant="primary"
                  onClick={onPickCollection}
                  style={{ width: '100%', justifyContent: 'center' }}
                >
                  {hasCollection ? 'Change Collection' : 'Select Shopify Collection'}
                </Button>
                {hasCollection ? (
                  <Button
                    variant="link"
                    isDestructive
                    onClick={() => setAttributes({ collection: {} })}
                    style={{ marginTop: '8px' }}
                  >
                    Clear Collection
                  </Button>
                ) : null}
              </PanelBody>

              <PanelBody title="Layout & Quantity" initialOpen={true}>
                <SelectControl
                  label="Layout Style"
                  value={layoutStyle || 'scroll'}
                  options={[
                    { label: 'Horizontal Scroll Carousel', value: 'scroll' },
                    { label: 'Responsive Grid', value: 'grid' },
                  ]}
                  onChange={(val) => setAttributes({ layoutStyle: val })}
                />
                <ToggleControl
                  label="Load All Products"
                  checked={loadAllProduct ?? true}
                  onChange={(val) => setAttributes({ loadAllProduct: val })}
                />
                {!(loadAllProduct ?? true) ? (
                  <TextControl
                    label="Number of Products"
                    type="number"
                    value={String(numberOfProduct ?? 10)}
                    onChange={(val) => {
                      const num = parseInt(val, 10);
                      setAttributes({ numberOfProduct: isNaN(num) || num < 1 ? 1 : num });
                    }}
                  />
                ) : null}
                {isScroll ? (
                  <ToggleControl
                    label="Show Pagination"
                    checked={showPagination ?? true}
                    onChange={(val) => setAttributes({ showPagination: val })}
                  />
                ) : null}
              </PanelBody>
            </div>
          </InspectorControls>

          <InspectorControls>
            <PanelBody title="Color Settings" initialOpen={true}>
              <ColorSettingsPanel
                title="Theme Colors"
                colorSettings={[
                  {
                    label: 'Background Color',
                    value: backgroundColor || DEFAULT_BACKGROUND,
                    onChange: updateColorAttribute('backgroundColor', DEFAULT_BACKGROUND),
                  },
                  {
                    label: 'Active Dot Color',
                    value: activeDotColor || DEFAULT_ACTIVE_DOT,
                    onChange: updateColorAttribute('activeDotColor', DEFAULT_ACTIVE_DOT),
                  },
                  {
                    label: 'Inactive Dot Color',
                    value: inActiveDotColor || DEFAULT_INACTIVE_DOT,
                    onChange: updateColorAttribute('inActiveDotColor', DEFAULT_INACTIVE_DOT),
                  },
                ]}
              />
            </PanelBody>
          </InspectorControls>

          <div {...blockProps}>
            <div
              className="appbuilder-prebuild-product-scroller"
              style={{ background: backgroundColor || DEFAULT_BACKGROUND }}
            >
              {(showTitle ?? true) || (showButton ?? true) ? (
                <div className="appbuilder-prebuild-product-scroller__heading">
                  {(showTitle ?? true) ? (
                    <div>
                      {subTitle ? (
                        <span className="appbuilder-prebuild-product-scroller__subtitle">{subTitle}</span>
                      ) : null}
                      <RichText
                        tagName="h3"
                        className="appbuilder-prebuild-product-scroller__title"
                        value={title ?? DEFAULT_TITLE}
                        onChange={(val) => setAttributes({ title: val })}
                        placeholder="Enter Title..."
                        allowedFormats={[]}
                      />
                    </div>
                  ) : <div />}

                  {(showButton ?? true) && buttonText ? (
                    <div className="appbuilder-prebuild-product-scroller__button-wrap">
                      <span className="appbuilder-prebuild-product-scroller__button">{buttonText}</span>
                    </div>
                  ) : null}
                </div>
              ) : null}

              {loading ? (
                <div className="appbuilder-prebuild-product-scroller__track">
                  <ProductSkeletonCards count={limit} />
                </div>
              ) : (
                <div
                  className={`appbuilder-prebuild-product-scroller__track ${!isScroll ? 'appbuilder-prebuild-product-scroller__track--grid' : ''}`}
                  ref={isScroll ? trackRef : null}
                >
                  {displayProducts.map((prod, i) => (
                    <ProductCard
                      key={prod.id || i}
                      product={prod}
                      showWishlist={showWishlist ?? true}
                      showSaleBadge={showSaleBadge ?? true}
                    />
                  ))}
                </div>
              )}

              {isScroll && (showPagination ?? true) && visibleCount > 1 ? (
                <div className="appbuilder-prebuild-product-scroller__pagination">
                  {Array.from({ length: visibleCount }).map((_, idx) => (
                    <span
                      key={idx}
                      className={`appbuilder-prebuild-product-scroller__dot ${idx === activeIndex ? 'is-active' : ''}`}
                      style={{
                        backgroundColor: idx === activeIndex ? (activeDotColor || DEFAULT_ACTIVE_DOT) : (inActiveDotColor || DEFAULT_INACTIVE_DOT),
                      }}
                      onClick={() => goToIndex(idx)}
                      role="button"
                      tabIndex={0}
                      aria-label={`Go to slide ${idx + 1}`}
                    />
                  ))}
                </div>
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
        layoutStyle,
        numberOfProduct,
        loadAllProduct,
        activeDotColor,
        inActiveDotColor,
        aspectRatio,
        showSaleBadge,
        showWishlist,
        showCardTitle,
        showCardPrice,
        showCardRating,
        collection,
        action,
      } = attributes;

      const bg = backgroundColor || DEFAULT_BACKGROUND;
      const ratioVal = aspectRatio || '3/4';

      const blockProps = useBlockProps.save({
        className: `appbuilder-prebuild-product-scroller appbuilder-prebuild-product-scroller--${layoutStyle || 'scroll'} ${!(showCardTitle ?? true) ? 'hide-card-title' : ''} ${!(showCardPrice ?? true) ? 'hide-card-price' : ''} ${!(showCardRating ?? true) ? 'hide-card-rating' : ''} ${!(showSaleBadge ?? true) ? 'hide-sale-badge' : ''} ${!(showWishlist ?? true) ? 'hide-wishlist' : ''}`,
        'data-title': title ?? '',
        'data-subtitle': subTitle ?? '',
        'data-show-title': String(showTitle ?? true),
        'data-show-button': String(showButton ?? true),
        'data-button-text': buttonText ?? '',
        'data-background-color': bg,
        'data-show-pagination': String(showPagination ?? true),
        'data-layout-style': layoutStyle || 'scroll',
        'data-number-of-product': String(numberOfProduct ?? 10),
        'data-load-all-product': String(loadAllProduct ?? true),
        'data-active-dot-color': activeDotColor || DEFAULT_ACTIVE_DOT,
        'data-inactive-dot-color': inActiveDotColor || DEFAULT_INACTIVE_DOT,
        'data-aspect-ratio': ratioVal,
        'data-show-sale-badge': String(showSaleBadge ?? true),
        'data-show-wishlist': String(showWishlist ?? true),
        'data-show-card-title': String(showCardTitle ?? true),
        'data-show-card-price': String(showCardPrice ?? true),
        'data-show-card-rating': String(showCardRating ?? true),
        'data-collection': JSON.stringify(collection ?? {}),
        'data-action': JSON.stringify(action ?? {}),
        style: {
          background: bg,
          '--appbuilder-product-card-aspect-ratio': ratioVal,
        },
      });

      return (
        <div {...blockProps}>
          {(showTitle ?? true) || (showButton ?? true) ? (
            <div className="appbuilder-prebuild-product-scroller__heading">
              {(showTitle ?? true) ? (
                <div>
                  {subTitle ? (
                    <span className="appbuilder-prebuild-product-scroller__subtitle">{subTitle}</span>
                  ) : null}
                  {title ? (
                    <h3 className="appbuilder-prebuild-product-scroller__title">{title}</h3>
                  ) : null}
                </div>
              ) : <div />}

              {(showButton ?? true) && buttonText ? (
                <div className="appbuilder-prebuild-product-scroller__button-wrap">
                  <span className="appbuilder-prebuild-product-scroller__button">{buttonText}</span>
                </div>
              ) : null}
            </div>
          ) : null}

          <div className="appbuilder-prebuild-product-scroller__track" />

          {layoutStyle === 'scroll' && (showPagination ?? true) ? (
            <div className="appbuilder-prebuild-product-scroller__pagination" aria-hidden="true" />
          ) : null}
        </div>
      );
    },
  });
}
