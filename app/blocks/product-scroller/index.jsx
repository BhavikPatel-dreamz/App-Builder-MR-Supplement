// @ts-nocheck
// Product scroller — a single block (no InnerBlocks) bound to a Shopify
// collection. The storefront/mobile app renders the collection's products; the
// block only stores the collection ref + presentation. Authored against the
// kit's shared @wordpress runtime; registered from ../index.ts.
import { registerBlockType } from 'gutenberg-block-kit/wp/blocks';
import {
  useBlockProps,
  InspectorControls,
  PanelColorSettings,
} from 'gutenberg-block-kit/wp/block-editor';
import { useState, useEffect } from 'gutenberg-block-kit/wp/element';
import { PanelBody, TextControl, ToggleControl, Button } from 'gutenberg-block-kit/wp/components';
import { contentTabStyle, useTrackPagination, SliderPaginationDots } from '../inspector-shared';
import { ActionBuilder } from 'gutenberg-block-kit/actions';
import { PRODUCT_SCROLLER_BLOCK, RIYASAT_CATEGORY } from '../constants';

const PLACEHOLDER_COUNT = 4;
const COLLECTION_PRODUCT_LIMIT = 12;

function ProductScrollerPlaceholderCards({ count = PLACEHOLDER_COUNT }) {
  return Array.from({ length: count }).map((_, index) => (
    <div key={index} className="riyasat-product-scroller__card">
      <div className="riyasat-product-scroller__card-image" />
      <div className="riyasat-product-scroller__card-body">
        <div className="riyasat-product-scroller__card-line" />
        <div className="riyasat-product-scroller__card-line riyasat-product-scroller__card-line--short" />
      </div>
    </div>
  ));
}

function ProductScrollerProductCards({ products }) {
  return products.map((product) => (
    <div key={product.id} className="riyasat-product-scroller__card">
      {product.imageUrl ? (
        <img
          className="riyasat-product-scroller__card-image riyasat-product-scroller__card-image--photo"
          src={product.imageUrl}
          alt={product.imageAlt || product.title}
          loading="lazy"
        />
      ) : (
        <div className="riyasat-product-scroller__card-image" />
      )}
      <div className="riyasat-product-scroller__card-body">
        <p className="riyasat-product-scroller__card-title">{product.title}</p>
        {product.price ? (
          <p className="riyasat-product-scroller__card-price">{product.price}</p>
        ) : (
          <div className="riyasat-product-scroller__card-line riyasat-product-scroller__card-line--short" />
        )}
      </div>
    </div>
  ));
}

const DEFAULT_BACKGROUND = '#f5f5f5';

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

// App Bridge v4 collection picker. Returns { collectionId, handle, title } or
// null if cancelled / unavailable.
async function pickCollection() {
  const picker =
    typeof window !== 'undefined' ? window.shopify?.resourcePicker : null;
  if (!picker) return null;
  const selection = await picker({ type: 'collection', multiple: false });
  const collection = selection?.[0];
  if (!collection) return null;
  return {
    collectionId: collection.id,
    handle: collection.handle,
    title: collection.title,
  };
}

export function registerProductScroller() {
  registerBlockType(PRODUCT_SCROLLER_BLOCK, {
    apiVersion: 3,
    title: 'Product Scroller',
    description:
      'Horizontally scrolling products from a Shopify collection, with a heading and CTA.',
    category: RIYASAT_CATEGORY,
    icon: ProductScrollerIcon,
    keywords: ['products', 'collection', 'scroller', 'best sellers'],
    supports: { html: false, align: ['wide', 'full'] },
    attributes: {
      title: { type: 'string', default: '' },
      subTitle: { type: 'string', default: '' },
      backgroundColor: { type: 'string', default: DEFAULT_BACKGROUND },
      buttonText: { type: 'string', default: '' },
      collection: { type: 'object', default: {} },
      action: { type: 'object', default: {} },
      showPagination: { type: 'boolean', default: true },
    },

    edit: ({ attributes, setAttributes }) => {
      const {
        title,
        subTitle,
        backgroundColor,
        buttonText,
        collection,
        action,
        showPagination,
      } = attributes;
      const blockProps = useBlockProps({
        className: 'riyasat-product-scroller-editor',
      });
      const hasCollection = collection && collection.collectionId;
      const [products, setProducts] = useState([]);
      const [productsLoading, setProductsLoading] = useState(false);

      useEffect(() => {
        if (!hasCollection) {
          setProducts([]);
          setProductsLoading(false);
          return undefined;
        }

        let cancelled = false;
        setProductsLoading(true);

        const params = new URLSearchParams({
          collectionId: String(collection.collectionId),
          limit: String(COLLECTION_PRODUCT_LIMIT),
        });

        fetch(`/api/cms/collection-products?${params.toString()}`)
          .then((response) => response.json())
          .then((data) => {
            if (cancelled) return;
            if (data.error) {
              setProducts([]);
              return;
            }
            setProducts(Array.isArray(data.products) ? data.products : []);
          })
          .catch(() => {
            if (!cancelled) setProducts([]);
          })
          .finally(() => {
            if (!cancelled) setProductsLoading(false);
          });

        return () => {
          cancelled = true;
        };
      }, [hasCollection, collection?.collectionId]);

      async function onPickCollection() {
        const picked = await pickCollection();
        if (picked) setAttributes({ collection: picked });
      }

      const showRealProducts = hasCollection && !productsLoading && products.length > 0;
      const visibleItemCount = showRealProducts ? products.length : PLACEHOLDER_COUNT;
      const [activeIndex, setActiveIndex] = useState(0);
      const { trackRef, goToIndex } = useTrackPagination(activeIndex, setActiveIndex);

      useEffect(() => {
        if (visibleItemCount <= 0) {
          setActiveIndex(0);
          return;
        }
        if (activeIndex > visibleItemCount - 1) setActiveIndex(visibleItemCount - 1);
      }, [activeIndex, visibleItemCount]);

      return (
        <>
          <InspectorControls group="content">
            <div style={contentTabStyle}>
              <PanelBody title="Heading" initialOpen={true}>
                <TextControl
                  label="Main Title"
                  value={title}
                  onChange={(value) => setAttributes({ title: value })}
                />
                <TextControl
                  label="Sub Title"
                  value={subTitle}
                  onChange={(value) => setAttributes({ subTitle: value })}
                />
              </PanelBody>

              <PanelBody title="Collection" initialOpen={true}>
                {hasCollection ? (
                  <p style={{ margin: '0 0 8px' }}>
                    Selected: <strong>{collection.title}</strong>
                    <br />
                    <span style={{ color: '#666', fontSize: '12px' }}>
                      {collection.handle}
                    </span>
                  </p>
                ) : (
                  <p style={{ margin: '0 0 8px', color: '#666' }}>
                    No collection selected.
                  </p>
                )}
                <Button
                  variant="secondary"
                  onClick={onPickCollection}
                  style={{ width: '100%', justifyContent: 'center' }}
                >
                  {hasCollection ? 'Change Collection' : 'Select Collection'}
                </Button>
                {hasCollection ? (
                  <Button
                    variant="link"
                    isDestructive
                    onClick={() => setAttributes({ collection: {} })}
                    style={{ marginTop: '4px' }}
                  >
                    Clear Collection
                  </Button>
                ) : null}
              </PanelBody>

              <PanelBody title="Button" initialOpen={false}>
                <TextControl
                  label="Button text"
                  value={buttonText}
                  onChange={(value) => setAttributes({ buttonText: value })}
                />
                <ActionBuilder
                  label="Button action"
                  value={action}
                  onChange={(next) => setAttributes({ action: next })}
                />
              </PanelBody>
            </div>
          </InspectorControls>

          <InspectorControls>
            <PanelBody title="Settings" initialOpen={true}>
              <ToggleControl
                label="Show pagination"
                checked={showPagination}
                onChange={(value) => setAttributes({ showPagination: value })}
              />
              <PanelColorSettings
                title="Colors"
                colorSettings={[
                  {
                    label: 'Background color',
                    value: backgroundColor,
                    onChange: (value) =>
                      setAttributes({ backgroundColor: value || DEFAULT_BACKGROUND }),
                  },
                ]}
              />
            </PanelBody>
          </InspectorControls>

          <div {...blockProps}>
            <div
              className="riyasat-product-scroller"
              style={{ background: backgroundColor }}
            >
              <div className="riyasat-product-scroller__heading">
                {title ? (
                  <h3 className="riyasat-product-scroller__title">{title}</h3>
                ) : null}
                {subTitle ? (
                  <p className="riyasat-product-scroller__subtitle">{subTitle}</p>
                ) : null}
              </div>

              <div className="riyasat-product-scroller__track" ref={trackRef}>
                {showRealProducts ? (
                  <ProductScrollerProductCards products={products} />
                ) : (
                  <ProductScrollerPlaceholderCards />
                )}
              </div>

              {showPagination ? (
                <SliderPaginationDots
                  count={visibleItemCount}
                  activeIndex={activeIndex}
                  onSelect={goToIndex}
                  className="riyasat-product-scroller__pagination"
                  dotClassName="riyasat-product-scroller__pagination-dot"
                  ariaLabelPrefix="Go to product"
                />
              ) : null}

              {buttonText ? (
                <div className="riyasat-product-scroller__button-wrap">
                  <span className="riyasat-product-scroller__button">{buttonText}</span>
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
        backgroundColor,
        buttonText,
        collection,
        action,
        showPagination,
      } = attributes;
      const blockProps = useBlockProps.save({
        className: 'riyasat-product-scroller',
        'data-background-color': backgroundColor,
        'data-collection': JSON.stringify(collection ?? {}),
        'data-action': JSON.stringify(action ?? {}),
        'data-show-pagination': showPagination ? 'true' : 'false',
        style: { background: backgroundColor },
      });
      return (
        <div {...blockProps}>
          <div className="riyasat-product-scroller__heading">
                  {title ? (
              <h3 className="riyasat-product-scroller__title">{title}</h3>
            ) : null}
            {subTitle ? (
              <p className="riyasat-product-scroller__subtitle">{subTitle}</p>
            ) : null}
          </div>
          {showPagination ? (
            <div className="riyasat-product-scroller__pagination" aria-hidden="true" />
          ) : null}
          {buttonText ? (
            <div className="riyasat-product-scroller__button-wrap">
              <span className="riyasat-product-scroller__button">{buttonText}</span>
            </div>
          ) : null}
        </div>
      );
    },
  });
}
