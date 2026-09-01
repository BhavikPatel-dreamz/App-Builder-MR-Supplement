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
  RangeControl,
  Button,
} from 'gutenberg-block-kit/wp/components';
import { ActionBuilder } from 'gutenberg-block-kit/actions';
import {
  ColorSettingsPanel,
  contentTabStyle,
  useTrackPagination,
  ImagePicker,
  getImageUrl,
} from '../inspector-shared';
import {
  PRODUCT_SCROLLER_WITH_BACKGROUND_IMAGE_BLOCK,
  APPBUILDER_CATEGORY,
} from '../constants';

const DEFAULT_MAIN_BG = '#8e8e8c';
const DEFAULT_ACTIVE_DOT = '#FFFFFF';
const DEFAULT_INACTIVE_DOT = '#000000';

function ProductScrollerBgIcon() {
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
        d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V5h14v14zM7 10h3v5H7v-5zm4 0h3v5h-3v-5zm4 0h3v5h-3v-5z"
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

const DEMO_PRODUCTS = [
  {
    id: 'gid://shopify/Product/201',
    handle: 'luxurious-silk-scarf',
    title: 'Luxurious Pure Silk Scarf',
    imageUrl: 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=600',
    price: '$89.00',
    compareAtPrice: '$110.00',
    badgeText: 'POPULAR',
    rating: '4.9',
  },
  {
    id: 'gid://shopify/Product/202',
    handle: 'minimalist-leather-watch',
    title: 'Minimalist Artisan Leather Watch',
    imageUrl: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600',
    price: '$165.00',
    compareAtPrice: '',
    badgeText: 'NEW',
    rating: '4.8',
  },
  {
    id: 'gid://shopify/Product/203',
    handle: 'velvet-shoulder-bag',
    title: 'Quilted Velvet Evening Shoulder Bag',
    imageUrl: 'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=600',
    price: '$120.00',
    compareAtPrice: '$150.00',
    badgeText: 'SALE',
    rating: '5.0',
  },
  {
    id: 'gid://shopify/Product/204',
    handle: 'amber-scented-candle',
    title: 'Handcrafted Amber Scented Candle',
    imageUrl: 'https://images.unsplash.com/photo-1603006905003-be475563bc59?w=600',
    price: '$34.00',
    compareAtPrice: '',
    badgeText: '',
    rating: '4.7',
  },
];

function ProductCard({ product, borderRadius = 10 }) {
  const isSale = Boolean(product.compareAtPrice);
  const cardRadius = `${borderRadius}px`;
  return (
    <div
      className="appbuilder-ps-bg__card"
      style={{ borderRadius: cardRadius }}
    >
      <div
        className="appbuilder-ps-bg__card-media"
        style={{ borderRadius: cardRadius }}
      >
        {product.imageUrl ? (
          <img
            className="appbuilder-ps-bg__card-image"
            src={product.imageUrl}
            alt={product.imageAlt || product.title}
            loading="lazy"
            style={{ borderRadius: cardRadius }}
          />
        ) : (
          <div className="appbuilder-ps-bg__card-placeholder-img" style={{ borderRadius: cardRadius }} />
        )}
        {(product.badgeText || isSale) ? (
          <span className="appbuilder-ps-bg__badge">
            {product.badgeText || 'SALE'}
          </span>
        ) : null}
        <span className="appbuilder-ps-bg__wishlist-btn" role="button" aria-label="Add to Wishlist">
          <HeartIcon />
        </span>
      </div>

      <div className="appbuilder-ps-bg__card-body">
        <p className="appbuilder-ps-bg__card-title">{product.title}</p>
        <div className="appbuilder-ps-bg__card-price-row">
          <span className="appbuilder-ps-bg__card-price">{product.price || '$49.00'}</span>
          {product.compareAtPrice ? (
            <span className="appbuilder-ps-bg__card-compare-price">{product.compareAtPrice}</span>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function ProductSkeletonCards({ count = 4, borderRadius = 10 }) {
  return Array.from({ length: count }).map((_, index) => (
    <div
      key={index}
      className="appbuilder-ps-bg__card appbuilder-ps-bg__card--skeleton"
      style={{ borderRadius: `${borderRadius}px` }}
    >
      <div
        className="appbuilder-ps-bg__card-media appbuilder-ps-bg__skeleton-pulse"
        style={{ borderRadius: `${borderRadius}px` }}
      />
      <div className="appbuilder-ps-bg__card-body" style={{ gap: '6px' }}>
        <div className="appbuilder-ps-bg__skeleton-pulse" style={{ height: '12px', width: '80%', borderRadius: '4px' }} />
        <div className="appbuilder-ps-bg__skeleton-pulse" style={{ height: '11px', width: '40%', borderRadius: '4px' }} />
      </div>
    </div>
  ));
}

export function registerProductScrollerWithBackgroundImage() {
  try {
    unregisterBlockType(PRODUCT_SCROLLER_WITH_BACKGROUND_IMAGE_BLOCK);
  } catch {
    // safe fallback
  }

  registerBlockType(PRODUCT_SCROLLER_WITH_BACKGROUND_IMAGE_BLOCK, {
    apiVersion: 3,
    title: 'Product Scroller with Background Image',
    description: 'Promotional Shopify product carousel layered over a configurable background image.',
    category: APPBUILDER_CATEGORY,
    icon: ProductScrollerBgIcon,
    keywords: ['product', 'scroller', 'background', 'image', 'collection', 'carousel'],
    supports: { html: false, align: ['wide', 'full'] },
    attributes: {
      scrollerProductCardSettings: {
        type: 'object',
        default: {
          collection: {
            collectionId: 'gid://shopify/Collection/422567658',
            handle: 'best-sellers',
            title: 'Best Sellers',
          },
          borderRadius: 10,
          productLimit: 10,
        },
      },
      scrollerProductSettings: {
        type: 'object',
        default: {
          scrollerHeight: 400,
          gap: 10,
          alignment: 'bottom',
          padding: 10,
          advancePaddingControl: {
            top: 0,
            right: 0,
            bottom: 0,
            left: 0,
          },
        },
      },
      backgroundImageSettings: {
        type: 'object',
        default: {
          imageUrl: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=1200',
          alignment: 'top',
          action: {},
          title: 'Best Sellers',
          titleAlignment: 'left',
          backgroundHeightMode: 'auto',
          backgroundHeight: 500,
          overlayOpacity: 30,
        },
      },
      mainContainerSettings: {
        type: 'object',
        default: {
          backgroundColor: DEFAULT_MAIN_BG,
          blockHeight: 800,
        },
      },
      paginationOptions: {
        type: 'object',
        default: {
          paginationType: 'dotIndicator',
          activeDotColor: DEFAULT_ACTIVE_DOT,
          inActiveDotColor: DEFAULT_INACTIVE_DOT,
          displayPagination: true,
        },
      },
      action: {
        type: 'object',
        default: {},
      },
    },

    edit: ({ attributes, setAttributes }) => {
      const {
        scrollerProductCardSettings = {},
        scrollerProductSettings = {},
        backgroundImageSettings = {},
        mainContainerSettings = {},
        paginationOptions = {},
        action = {},
      } = attributes;

      const {
        collection = {},
        borderRadius = 10,
        productLimit = 10,
      } = scrollerProductCardSettings;

      const {
        scrollerHeight = 400,
        gap = 10,
        alignment: scrollerAlignment = 'bottom',
        padding: basicPadding = 10,
        advancePaddingControl = {},
      } = scrollerProductSettings;

      const {
        imageUrl: bgImageUrl = '',
        alignment: bgAlignment = 'top',
        action: bgAction = {},
        title: bgTitle = 'Best Sellers',
        titleAlignment = 'left',
        backgroundHeightMode = 'auto',
        backgroundHeight = 500,
        overlayOpacity = 30,
      } = backgroundImageSettings;

      const {
        backgroundColor = DEFAULT_MAIN_BG,
        blockHeight = 800,
      } = mainContainerSettings;

      const {
        paginationType = 'dotIndicator',
        activeDotColor = DEFAULT_ACTIVE_DOT,
        inActiveDotColor = DEFAULT_INACTIVE_DOT,
        displayPagination = true,
        position: dotPosition = 'center',
      } = paginationOptions || {};

      const hasCollection = Boolean(collection && collection.collectionId);
      const [products, setProducts] = useState([]);
      const [loading, setLoading] = useState(false);
      const [activeIndex, setActiveIndex] = useState(0);

      const limit = Math.max(1, Number(productLimit) || 10);

      useEffect(() => {
        if (!hasCollection) {
          setProducts([]);
          setLoading(false);
          return undefined;
        }

        let cancelled = false;
        setLoading(true);

        const params = new URLSearchParams({
          collectionId: String(collection.collectionId),
          limit: String(limit),
        });

        fetch(`/api/cms/collection-products?${params.toString()}`)
          .then((res) => res.json())
          .then((data) => {
            if (cancelled) return;
            if (data.products && Array.isArray(data.products) && data.products.length > 0) {
              setProducts(data.products);
            } else {
              setProducts(DEMO_PRODUCTS.slice(0, limit));
            }
          })
          .catch(() => {
            if (!cancelled) setProducts(DEMO_PRODUCTS.slice(0, limit));
          })
          .finally(() => {
            if (!cancelled) setLoading(false);
          });

        return () => {
          cancelled = true;
        };
      }, [hasCollection, collection?.collectionId, limit]);

      const onPickCollection = async () => {
        const picked = await pickCollection();
        if (picked) {
          setAttributes({
            scrollerProductCardSettings: {
              ...scrollerProductCardSettings,
              collection: picked,
            },
          });
        }
      };

      const displayProducts = useMemo(() => {
        if (products.length > 0) {
          return products.slice(0, limit);
        }
        return DEMO_PRODUCTS.slice(0, limit);
      }, [products, limit]);

      const visibleCount = displayProducts.length;

      const { trackRef, goToIndex } = useTrackPagination(activeIndex, setActiveIndex);

      useEffect(() => {
        if (visibleCount <= 0) {
          setActiveIndex(0);
          return;
        }
        if (activeIndex > visibleCount - 1) setActiveIndex(visibleCount - 1);
      }, [activeIndex, visibleCount]);

      const advTop = advancePaddingControl?.top;
      const advRight = advancePaddingControl?.right;
      const advBottom = advancePaddingControl?.bottom;
      const advLeft = advancePaddingControl?.left;

      const hasAdvPadding =
        advTop !== undefined && advTop !== 0 ||
        advRight !== undefined && advRight !== 0 ||
        advBottom !== undefined && advBottom !== 0 ||
        advLeft !== undefined && advLeft !== 0;

      const effectivePaddingStyle = hasAdvPadding
        ? `${advTop ?? 0}px ${advRight ?? 0}px ${advBottom ?? 0}px ${advLeft ?? 0}px`
        : `${basicPadding ?? 10}px`;

      const blockProps = useBlockProps({
        className: 'appbuilder-ps-bg-editor',
      });

      const getBgObjectPosition = () => {
        if (bgAlignment === 'center') return 'center center';
        if (bgAlignment === 'bottom') return 'center bottom';
        return 'center top';
      };

      const bgImageStyle = {
        objectPosition: getBgObjectPosition(),
        ...(backgroundHeightMode === 'custom' ? { height: `${backgroundHeight || 500}px` } : {}),
      };

      return (
        <>
          <InspectorControls group="content">
            <div style={contentTabStyle}>
              <PanelBody title="Product Card Settings" initialOpen={true}>
                {hasCollection ? (
                  <div style={{ marginBottom: '10px', background: '#f8fafc', padding: '10px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                    <p style={{ margin: '0 0 4px', fontSize: '13px', fontWeight: 700, color: '#0f172a' }}>
                      Collection: {collection.title}
                    </p>
                    <p style={{ margin: 0, fontSize: '11px', color: '#64748b' }}>
                      Handle: {collection.handle}
                    </p>
                  </div>
                ) : (
                  <p style={{ margin: '0 0 10px', fontSize: '12px', color: '#64748b' }}>
                    No Shopify collection selected.
                  </p>
                )}
                <Button
                  variant="primary"
                  onClick={onPickCollection}
                  style={{ width: '100%', justifyContent: 'center' }}
                >
                  {hasCollection ? 'Change Collection' : 'Select Shopify Collection'}
                </Button>
                <div style={{ marginTop: '12px' }}>
                  <TextControl
                    label="Border Radius (px)"
                    type="number"
                    value={String(borderRadius ?? 10)}
                    onChange={(val) => {
                      const num = parseInt(val, 10);
                      setAttributes({
                        scrollerProductCardSettings: {
                          ...scrollerProductCardSettings,
                          borderRadius: isNaN(num) ? 0 : num,
                        },
                      });
                    }}
                  />
                  <TextControl
                    label="Product Limit"
                    type="number"
                    value={String(productLimit ?? 10)}
                    onChange={(val) => {
                      const num = parseInt(val, 10);
                      setAttributes({
                        scrollerProductCardSettings: {
                          ...scrollerProductCardSettings,
                          productLimit: isNaN(num) || num < 1 ? 1 : num,
                        },
                      });
                    }}
                  />
                </div>
              </PanelBody>

              <PanelBody title="Product Scroller Settings" initialOpen={true}>
                <TextControl
                  label="Scroller Height (px)"
                  type="number"
                  value={String(scrollerHeight ?? 400)}
                  onChange={(val) => {
                    const num = parseInt(val, 10);
                    setAttributes({
                      scrollerProductSettings: {
                        ...scrollerProductSettings,
                        scrollerHeight: isNaN(num) ? 100 : num,
                      },
                    });
                  }}
                />
                <TextControl
                  label="Gap Between Cards (px)"
                  type="number"
                  value={String(gap ?? 10)}
                  onChange={(val) => {
                    const num = parseInt(val, 10);
                    setAttributes({
                      scrollerProductSettings: {
                        ...scrollerProductSettings,
                        gap: isNaN(num) ? 0 : num,
                      },
                    });
                  }}
                />
                <SelectControl
                  label="Scroller Alignment"
                  value={scrollerAlignment || 'bottom'}
                  options={[
                    { label: 'Top Aligned', value: 'top' },
                    { label: 'Center Aligned', value: 'center' },
                    { label: 'Bottom Aligned', value: 'bottom' },
                  ]}
                  onChange={(val) =>
                    setAttributes({
                      scrollerProductSettings: {
                        ...scrollerProductSettings,
                        alignment: val,
                      },
                    })
                  }
                />
                <TextControl
                  label="Basic Padding (px)"
                  type="number"
                  value={String(basicPadding ?? 10)}
                  onChange={(val) => {
                    const num = parseInt(val, 10);
                    setAttributes({
                      scrollerProductSettings: {
                        ...scrollerProductSettings,
                        padding: isNaN(num) ? 0 : num,
                      },
                    });
                  }}
                />
                <p style={{ margin: '10px 0 4px', fontSize: '12px', fontWeight: 700, color: '#334155' }}>
                  Advanced Padding (Overrides basic padding when set)
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <TextControl
                    label="Top (px)"
                    type="number"
                    value={String(advTop ?? 0)}
                    onChange={(val) => {
                      const num = parseInt(val, 10);
                      setAttributes({
                        scrollerProductSettings: {
                          ...scrollerProductSettings,
                          advancePaddingControl: {
                            ...advancePaddingControl,
                            top: isNaN(num) ? 0 : num,
                          },
                        },
                      });
                    }}
                  />
                  <TextControl
                    label="Right (px)"
                    type="number"
                    value={String(advRight ?? 0)}
                    onChange={(val) => {
                      const num = parseInt(val, 10);
                      setAttributes({
                        scrollerProductSettings: {
                          ...scrollerProductSettings,
                          advancePaddingControl: {
                            ...advancePaddingControl,
                            right: isNaN(num) ? 0 : num,
                          },
                        },
                      });
                    }}
                  />
                  <TextControl
                    label="Bottom (px)"
                    type="number"
                    value={String(advBottom ?? 0)}
                    onChange={(val) => {
                      const num = parseInt(val, 10);
                      setAttributes({
                        scrollerProductSettings: {
                          ...scrollerProductSettings,
                          advancePaddingControl: {
                            ...advancePaddingControl,
                            bottom: isNaN(num) ? 0 : num,
                          },
                        },
                      });
                    }}
                  />
                  <TextControl
                    label="Left (px)"
                    type="number"
                    value={String(advLeft ?? 0)}
                    onChange={(val) => {
                      const num = parseInt(val, 10);
                      setAttributes({
                        scrollerProductSettings: {
                          ...scrollerProductSettings,
                          advancePaddingControl: {
                            ...advancePaddingControl,
                            left: isNaN(num) ? 0 : num,
                          },
                        },
                      });
                    }}
                  />
                </div>
              </PanelBody>

              <PanelBody title="Background Image Settings" initialOpen={true}>
                <ImagePicker
                  imageUrl={bgImageUrl}
                  onSelect={(media) =>
                    setAttributes({
                      backgroundImageSettings: {
                        ...backgroundImageSettings,
                        imageUrl: getImageUrl(media),
                      },
                    })
                  }
                  onClear={() =>
                    setAttributes({
                      backgroundImageSettings: {
                        ...backgroundImageSettings,
                        imageUrl: '',
                      },
                    })
                  }
                  addLabel="Select Background Image"
                  changeLabel="Change Background Image"
                />
                <div style={{ marginTop: '12px' }}>
                  <TextControl
                    label="Section Title"
                    value={bgTitle ?? 'Best Sellers'}
                    onChange={(val) =>
                      setAttributes({
                        backgroundImageSettings: {
                          ...backgroundImageSettings,
                          title: val,
                        },
                      })
                    }
                  />
                  <SelectControl
                    label="Title Alignment"
                    value={titleAlignment || 'left'}
                    options={[
                      { label: 'Left', value: 'left' },
                      { label: 'Center', value: 'center' },
                      { label: 'Right', value: 'right' },
                    ]}
                    onChange={(val) =>
                      setAttributes({
                        backgroundImageSettings: {
                          ...backgroundImageSettings,
                          titleAlignment: val,
                        },
                      })
                    }
                  />
                  <SelectControl
                    label="Background Alignment"
                    value={bgAlignment || 'top'}
                    options={[
                      { label: 'Top', value: 'top' },
                      { label: 'Center', value: 'center' },
                      { label: 'Bottom', value: 'bottom' },
                    ]}
                    onChange={(val) =>
                      setAttributes({
                        backgroundImageSettings: {
                          ...backgroundImageSettings,
                          alignment: val,
                        },
                      })
                    }
                  />
                  <SelectControl
                    label="Background Height Mode"
                    value={backgroundHeightMode || 'auto'}
                    options={[
                      { label: 'Full Section Cover (Auto)', value: 'auto' },
                      { label: 'Custom Height (px)', value: 'custom' },
                    ]}
                    onChange={(val) =>
                      setAttributes({
                        backgroundImageSettings: {
                          ...backgroundImageSettings,
                          backgroundHeightMode: val,
                        },
                      })
                    }
                  />
                  {backgroundHeightMode === 'custom' ? (
                    <TextControl
                      label="Background Image Height (px)"
                      type="number"
                      value={String(backgroundHeight ?? 500)}
                      onChange={(val) => {
                        const num = parseInt(val, 10);
                        setAttributes({
                          backgroundImageSettings: {
                            ...backgroundImageSettings,
                            backgroundHeight: isNaN(num) ? 200 : num,
                          },
                        });
                      }}
                    />
                  ) : null}
                  <RangeControl
                    label="Dark Overlay Intensity (%)"
                    value={overlayOpacity ?? 30}
                    onChange={(val) =>
                      setAttributes({
                        backgroundImageSettings: {
                          ...backgroundImageSettings,
                          overlayOpacity: val,
                        },
                      })
                    }
                    min={0}
                    max={90}
                  />
                  <ActionBuilder
                    label="Background Image Action"
                    value={bgAction ?? {}}
                    onChange={(next) =>
                      setAttributes({
                        backgroundImageSettings: {
                          ...backgroundImageSettings,
                          action: next,
                        },
                      })
                    }
                  />
                </div>
              </PanelBody>

              <PanelBody title="Main Container Settings" initialOpen={true}>
                <TextControl
                  label="Block Height (px)"
                  type="number"
                  value={String(blockHeight ?? 800)}
                  onChange={(val) => {
                    const num = parseInt(val, 10);
                    setAttributes({
                      mainContainerSettings: {
                        ...mainContainerSettings,
                        blockHeight: isNaN(num) ? 300 : num,
                      },
                    });
                  }}
                />
              </PanelBody>

              <PanelBody title="Pagination Settings" initialOpen={true}>
                <ToggleControl
                  label="Display Pagination"
                  checked={displayPagination ?? true}
                  onChange={(val) =>
                    setAttributes({
                      paginationOptions: {
                        ...paginationOptions,
                        displayPagination: val,
                      },
                    })
                  }
                />
                <SelectControl
                  label="Dot Indicator Position"
                  value={dotPosition || 'center'}
                  options={[
                    { label: 'Left', value: 'left' },
                    { label: 'Center', value: 'center' },
                    { label: 'Right', value: 'right' },
                  ]}
                  onChange={(val) =>
                    setAttributes({
                      paginationOptions: {
                        ...paginationOptions,
                        position: val,
                      },
                    })
                  }
                />
              </PanelBody>

              <PanelBody title="Block Action" initialOpen={false}>
                <ActionBuilder
                  label="Block Action"
                  value={action ?? {}}
                  onChange={(next) => setAttributes({ action: next })}
                />
              </PanelBody>
            </div>
          </InspectorControls>

          <InspectorControls>
            <PanelBody title="Color Settings" initialOpen={true}>
              <ColorSettingsPanel
                title="Theme Colors"
                colorSettings={[
                  {
                    label: 'Main Container Background Color',
                    value: backgroundColor || DEFAULT_MAIN_BG,
                    onChange: (nextColor) => {
                      if (nextColor === undefined || nextColor === null || nextColor === '') {
                        return;
                      }
                      setAttributes({
                        mainContainerSettings: {
                          ...mainContainerSettings,
                          backgroundColor: nextColor,
                        },
                      });
                    },
                  },
                  {
                    label: 'Active Dot Color',
                    value: activeDotColor || DEFAULT_ACTIVE_DOT,
                    onChange: (nextColor) => {
                      if (nextColor === undefined || nextColor === null || nextColor === '') {
                        return;
                      }
                      setAttributes({
                        paginationOptions: {
                          ...paginationOptions,
                          activeDotColor: nextColor,
                        },
                      });
                    },
                  },
                  {
                    label: 'Inactive Dot Color',
                    value: inActiveDotColor || DEFAULT_INACTIVE_DOT,
                    onChange: (nextColor) => {
                      if (nextColor === undefined || nextColor === null || nextColor === '') {
                        return;
                      }
                      setAttributes({
                        paginationOptions: {
                          ...paginationOptions,
                          inActiveDotColor: nextColor,
                        },
                      });
                    },
                  },
                ]}
              />
            </PanelBody>
          </InspectorControls>

          <div {...blockProps}>
            <div
              className="appbuilder-ps-bg"
              style={{
                backgroundColor: backgroundColor || DEFAULT_MAIN_BG,
                minHeight: `${blockHeight || 800}px`,
              }}
            >
              {/* Background Image Layer */}
              {bgImageUrl ? (
                <img
                  className="appbuilder-ps-bg__image"
                  src={bgImageUrl}
                  alt={bgTitle || 'Background'}
                  style={bgImageStyle}
                />
              ) : null}

              {/* Dark Overlay Layer for Text & Card POP */}
              {bgImageUrl ? (
                <div
                  className="appbuilder-ps-bg__overlay"
                  style={{
                    backgroundColor: `rgba(0, 0, 0, ${(overlayOpacity ?? 30) / 100})`,
                  }}
                />
              ) : null}

              {/* Overlay Content Container */}
              <div
                className={`appbuilder-ps-bg__content-wrap appbuilder-ps-bg__content-wrap--${scrollerAlignment || 'bottom'}`}
                style={{
                  padding: effectivePaddingStyle,
                }}
              >
                {bgTitle ? (
                  <RichText
                    tagName="h2"
                    className={`appbuilder-ps-bg__title appbuilder-ps-bg__title--${titleAlignment || 'left'}`}
                    value={bgTitle}
                    onChange={(val) =>
                      setAttributes({
                        backgroundImageSettings: {
                          ...backgroundImageSettings,
                          title: val,
                        },
                      })
                    }
                    placeholder="Enter Title..."
                    allowedFormats={[]}
                  />
                ) : null}

                <div
                  className="appbuilder-ps-bg__scroller-container"
                  style={{
                    height: `${scrollerHeight || 400}px`,
                  }}
                >
                  {loading ? (
                    <div className="appbuilder-ps-bg__track" style={{ gap: `${gap || 10}px` }}>
                      <ProductSkeletonCards count={limit} borderRadius={borderRadius} />
                    </div>
                  ) : (
                    <div
                      className="appbuilder-ps-bg__track"
                      ref={trackRef}
                      style={{ gap: `${gap || 10}px` }}
                    >
                      {displayProducts.map((prod, i) => (
                        <ProductCard
                          key={prod.id || i}
                          product={prod}
                          borderRadius={borderRadius}
                        />
                      ))}
                    </div>
                  )}

                  {(displayPagination ?? true) && visibleCount > 1 ? (
                    <div className={`appbuilder-ps-bg__pagination appbuilder-ps-bg__pagination--${dotPosition || 'center'}`}>
                      {Array.from({ length: visibleCount }).map((_, idx) => (
                        <span
                          key={idx}
                          className={`appbuilder-ps-bg__dot ${idx === activeIndex ? 'is-active' : ''}`}
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
            </div>
          </div>
        </>
      );
    },

    save: ({ attributes }) => {
      const {
        scrollerProductCardSettings = {},
        scrollerProductSettings = {},
        backgroundImageSettings = {},
        mainContainerSettings = {},
        paginationOptions = {},
        action = {},
      } = attributes;

      const {
        collection = {},
        borderRadius = 10,
        productLimit = 10,
      } = scrollerProductCardSettings;

      const {
        scrollerHeight = 400,
        gap = 10,
        alignment: scrollerAlignment = 'bottom',
        padding: basicPadding = 10,
        advancePaddingControl = {},
      } = scrollerProductSettings;

      const {
        imageUrl: bgImageUrl = '',
        alignment: bgAlignment = 'top',
        action: bgAction = {},
        title: bgTitle = 'Best Sellers',
        titleAlignment = 'left',
        backgroundHeightMode = 'auto',
        backgroundHeight = 500,
        overlayOpacity = 30,
      } = backgroundImageSettings;

      const {
        backgroundColor = DEFAULT_MAIN_BG,
        blockHeight = 800,
      } = mainContainerSettings;

      const {
        paginationType = 'dotIndicator',
        activeDotColor = DEFAULT_ACTIVE_DOT,
        inActiveDotColor = DEFAULT_INACTIVE_DOT,
        displayPagination = true,
      } = paginationOptions;

      const blockProps = useBlockProps.save({
        className: 'appbuilder-ps-bg',
        'data-scroller-product-card-settings': JSON.stringify(scrollerProductCardSettings),
        'data-scroller-product-settings': JSON.stringify(scrollerProductSettings),
        'data-background-image-settings': JSON.stringify(backgroundImageSettings),
        'data-main-container-settings': JSON.stringify(mainContainerSettings),
        'data-pagination-options': JSON.stringify(paginationOptions),
        'data-action': JSON.stringify(action ?? {}),
        style: {
          backgroundColor: backgroundColor || DEFAULT_MAIN_BG,
          minHeight: `${blockHeight || 800}px`,
        },
      });

      const getBgObjectPosition = () => {
        if (bgAlignment === 'center') return 'center center';
        if (bgAlignment === 'bottom') return 'center bottom';
        return 'center top';
      };

      const bgImageStyle = {
        objectPosition: getBgObjectPosition(),
        ...(backgroundHeightMode === 'custom' ? { height: `${backgroundHeight || 500}px` } : {}),
      };

      return (
        <div {...blockProps}>
          {bgImageUrl ? (
            <img
              className="appbuilder-ps-bg__image"
              src={bgImageUrl}
              alt={bgTitle || 'Background'}
              style={bgImageStyle}
            />
          ) : null}

          {bgImageUrl ? (
            <div
              className="appbuilder-ps-bg__overlay"
              style={{
                backgroundColor: `rgba(0, 0, 0, ${(overlayOpacity ?? 30) / 100})`,
              }}
            />
          ) : null}

          <div
            className={`appbuilder-ps-bg__content-wrap appbuilder-ps-bg__content-wrap--${scrollerAlignment || 'bottom'}`}
          >
            {bgTitle ? (
              <h2 className={`appbuilder-ps-bg__title appbuilder-ps-bg__title--${titleAlignment || 'left'}`}>{bgTitle}</h2>
            ) : null}

            <div
              className="appbuilder-ps-bg__scroller-container"
              style={{
                height: `${scrollerHeight || 400}px`,
              }}
            >
              <div className="appbuilder-ps-bg__track" style={{ gap: `${gap || 10}px` }} />

              {(displayPagination ?? true) ? (
                <div className={`appbuilder-ps-bg__pagination appbuilder-ps-bg__pagination--${paginationOptions?.position || 'center'}`} aria-hidden="true" />
              ) : null}
            </div>
          </div>
        </div>
      );
    },
  });
}
