// @ts-nocheck
// Selected Products — single block (standard/selected-products).
import { registerBlockType } from 'gutenberg-block-kit/wp/blocks';
import {
  useBlockProps,
  InspectorControls,
} from 'gutenberg-block-kit/wp/block-editor';
import { PanelBody, Button, TextControl } from 'gutenberg-block-kit/wp/components';
import { ActionBuilder } from '../../lib/gutenberg-actions';
import { ColorSettingsPanel, contentTabStyle, EditorSectionLabel } from '../inspector-shared';
import { STANDARD_SELECTED_PRODUCTS_BLOCK, APPBUILDER_CATEGORY } from '../constants';

const DEFAULT_BACKGROUND = '#FFFFFF';

async function pickProducts() {
  const picker = typeof window !== 'undefined' ? window.shopify?.resourcePicker : null;
  if (!picker) return null;
  const selection = await picker({ type: 'product', multiple: true });
  if (!Array.isArray(selection) || selection.length === 0) return null;
  return selection.map((product) => ({
    productId: product?.id ? String(product.id) : '',
    productHandle: product?.handle ? String(product.handle) : '',
    action: {},
  }));
}

function mergeProducts(existing, picked) {
  const byId = new Map();
  [...existing, ...picked].forEach((item) => {
    const key = String(item?.productId || item?.productHandle || '');
    if (!key) return;
    if (!byId.has(key)) byId.set(key, item);
  });
  return Array.from(byId.values());
}

export function registerStandardSelectedProducts() {
  registerBlockType(STANDARD_SELECTED_PRODUCTS_BLOCK, {
    apiVersion: 3,
    title: 'Selected Products',
    description: 'Select multiple individual products across collections.',
    category: APPBUILDER_CATEGORY,
    icon: 'products',
    supports: { html: false, align: ['wide', 'full'] },
    attributes: {
      title: { type: 'string', default: '' },
      subTitle: { type: 'string', default: '' },
      backgroundColor: { type: 'string', default: DEFAULT_BACKGROUND },
      products: { type: 'array', default: [] },
      action: { type: 'object', default: {} },
    },

    edit: ({ attributes, setAttributes }) => {
      const { title, subTitle, backgroundColor, products, action } = attributes;
      const productList = Array.isArray(products) ? products : [];
      const blockProps = useBlockProps({
        className: 'appbuilder-standard-selected-products-editor',
      });

      async function onPickProducts() {
        const picked = await pickProducts();
        if (!picked) return;
        setAttributes({ products: mergeProducts(productList, picked) });
      }

      function onRemove(index) {
        setAttributes({ products: productList.filter((_, i) => i !== index) });
      }

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
              <PanelBody title="Selected Products" initialOpen={true}>
                <Button
                  variant="secondary"
                  onClick={onPickProducts}
                  style={{ width: '100%', justifyContent: 'center' }}
                >
                  {productList.length > 0 ? 'Add/Change Products' : 'Select Products'}
                </Button>
                {productList.length > 0 ? (
                  <div style={{ marginTop: '10px' }}>
                    {productList.map((product, index) => (
                      <div
                        key={`${product.productId}-${index}`}
                        style={{
                          border: '1px solid #e5e7eb',
                          borderRadius: '6px',
                          padding: '8px',
                          marginBottom: '8px',
                        }}
                      >
                        <div style={{ fontSize: '12px', color: '#374151' }}>
                          <strong>ID:</strong> {product.productId || '-'}
                        </div>
                        <div style={{ fontSize: '12px', color: '#6b7280' }}>
                          <strong>Handle:</strong> {product.productHandle || '-'}
                        </div>
                        <Button variant="link" isDestructive onClick={() => onRemove(index)}>
                          Remove
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : null}
                <ActionBuilder
                  label="Section action"
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
              className="appbuilder-standard-selected-products"
              style={{ background: backgroundColor }}
            >
              {(title || subTitle) && (
                <div className="appbuilder-standard-selected-products__heading">
                  {title ? (
                    <h3 className="appbuilder-standard-selected-products__title">{title}</h3>
                  ) : null}
                  {subTitle ? (
                    <p className="appbuilder-standard-selected-products__subtitle">{subTitle}</p>
                  ) : null}
                </div>
              )}
              {productList.length > 0 ? (
                <div className="appbuilder-standard-selected-products__grid">
                  {productList.map((product, index) => (
                    <div
                      key={`${product.productId}-${index}-preview`}
                      className="appbuilder-standard-selected-products__card"
                    >
                      <div className="appbuilder-standard-selected-products__card-id">
                        {product.productId || '-'}
                      </div>
                      <div className="appbuilder-standard-selected-products__card-handle">
                        {product.productHandle || 'product'}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <EditorSectionLabel name="Selected Products" />
              )}
            </div>
          </div>
        </>
      );
    },

    save: ({ attributes }) => {
      const { title, subTitle, backgroundColor, products, action } = attributes;
      const blockProps = useBlockProps.save({
        className: 'appbuilder-standard-selected-products',
        'data-title': title || '',
        'data-sub-title': subTitle || '',
        'data-background-color': backgroundColor || DEFAULT_BACKGROUND,
        'data-products': JSON.stringify(Array.isArray(products) ? products : []),
        'data-action': JSON.stringify(action ?? {}),
        style: { background: backgroundColor || DEFAULT_BACKGROUND },
      });
      return (
        <div {...blockProps}>
          {(title || subTitle) && (
            <div className="appbuilder-standard-selected-products__heading">
              {title ? (
                <h3 className="appbuilder-standard-selected-products__title">{title}</h3>
              ) : null}
              {subTitle ? (
                <p className="appbuilder-standard-selected-products__subtitle">{subTitle}</p>
              ) : null}
            </div>
          )}
        </div>
      );
    },
  });
}
