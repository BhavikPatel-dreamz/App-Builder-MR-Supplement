// @ts-nocheck
import { registerBlockType } from 'gutenberg-block-kit/wp/blocks';
import {
  useBlockProps,
  InnerBlocks,
  InspectorControls,
  MediaUpload,
  MediaUploadCheck,
} from 'gutenberg-block-kit/wp/block-editor';
import { PanelBody, Button } from 'gutenberg-block-kit/wp/components';
import { ActionBuilder } from 'gutenberg-block-kit/actions';
import {
  contentTabStyle,
  imageAttributesFromMedia,
  clearImageAttributes,
} from '../inspector-shared';
import {
  ANGEL_CARDS_BLOCK,
  ANGEL_CARD_ITEM_BLOCK,
  RIYASAT_CATEGORY,
} from '../constants';

const DEFAULT_CARD_URL =
  'https://www.woocommerce.com/wp-content/uploads/2024/06/visit-our-stores.jpg';

function AngelCardsIcon() {
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
        d="M5 3h10a2 2 0 0 1 2 2v2h2a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2v-2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zm0 2v10h10V5H5zm4 4.2L7.5 11 9 12.8l1.5-1.8L9 9.2zm4 0L11.5 11l1.5 1.8 1.5-1.8L13 9.2z"
      />
    </svg>
  );
}

function registerAngelCardItem() {
  registerBlockType(ANGEL_CARD_ITEM_BLOCK, {
    apiVersion: 3,
    title: 'Angel Card Item',
    description: 'Single angel card with front and revealed image.',
    category: RIYASAT_CATEGORY,
    parent: [ANGEL_CARDS_BLOCK],
    icon: 'format-image',
    supports: { html: false, reusable: false },
    attributes: {
      defaultCardUrl: { type: 'string', default: DEFAULT_CARD_URL },
      defaultCardWidth: { type: 'number', default: 0 },
      defaultCardHeight: { type: 'number', default: 0 },
      angelCardUrl: { type: 'string', default: DEFAULT_CARD_URL },
      angelCardWidth: { type: 'number', default: 0 },
      angelCardHeight: { type: 'number', default: 0 },
      action: { type: 'object', default: {} },
    },

    edit: ({ attributes, setAttributes }) => {
      const { defaultCardUrl, angelCardUrl, action } = attributes;
      const blockProps = useBlockProps({ className: 'riyasat-angel-card-item-editor' });

      return (
        <>
          <InspectorControls group="content">
            <div style={contentTabStyle}>
              <PanelBody title="Angel Card Item" initialOpen={true}>
                <MediaUploadCheck>
                  <MediaUpload
                    onSelect={(media) =>
                      setAttributes(imageAttributesFromMedia(media, 'defaultCardUrl'))
                    }
                    allowedTypes={['image']}
                    render={({ open }) => (
                      <div style={{ marginBottom: '12px' }}>
                        <Button onClick={open} variant="secondary" style={{ width: '100%' }}>
                          {defaultCardUrl ? 'Change default card image' : 'Add default card image'}
                        </Button>
                        {defaultCardUrl ? (
                          <Button
                            onClick={() =>
                              setAttributes(clearImageAttributes('defaultCardUrl'))
                            }
                            variant="link"
                            isDestructive
                          >
                            Remove default image
                          </Button>
                        ) : null}
                      </div>
                    )}
                  />
                </MediaUploadCheck>

                <MediaUploadCheck>
                  <MediaUpload
                    onSelect={(media) =>
                      setAttributes(imageAttributesFromMedia(media, 'angelCardUrl'))
                    }
                    allowedTypes={['image']}
                    render={({ open }) => (
                      <div style={{ marginBottom: '12px' }}>
                        <Button onClick={open} variant="secondary" style={{ width: '100%' }}>
                          {angelCardUrl ? 'Change angel card image' : 'Add angel card image'}
                        </Button>
                        {angelCardUrl ? (
                          <Button
                            onClick={() =>
                              setAttributes(clearImageAttributes('angelCardUrl'))
                            }
                            variant="link"
                            isDestructive
                          >
                            Remove angel image
                          </Button>
                        ) : null}
                      </div>
                    )}
                  />
                </MediaUploadCheck>

                <ActionBuilder
                  label="Action"
                  value={action ?? {}}
                  onChange={(next) => setAttributes({ action: next })}
                />
              </PanelBody>
            </div>
          </InspectorControls>

          <div {...blockProps}>
            <div className="riyasat-angel-card-item-editor__images">
              <div>
                <p className="riyasat-angel-card-item-editor__label">Default</p>
                {defaultCardUrl ? (
                  <img
                    src={defaultCardUrl}
                    alt=""
                    className="riyasat-angel-card-item-editor__image"
                  />
                ) : null}
              </div>
              <div>
                <p className="riyasat-angel-card-item-editor__label">Angel</p>
                {angelCardUrl ? (
                  <img
                    src={angelCardUrl}
                    alt=""
                    className="riyasat-angel-card-item-editor__image"
                  />
                ) : null}
              </div>
            </div>
          </div>
        </>
      );
    },

    save: ({ attributes }) => {
      const {
        defaultCardUrl,
        defaultCardWidth,
        defaultCardHeight,
        angelCardUrl,
        angelCardWidth,
        angelCardHeight,
        action,
      } = attributes;
      const blockProps = useBlockProps.save({
        className: 'riyasat-angel-card-item',
        'data-default-card-width': `${defaultCardWidth || 0}`,
        'data-default-card-height': `${defaultCardHeight || 0}`,
        'data-angel-card-width': `${angelCardWidth || 0}`,
        'data-angel-card-height': `${angelCardHeight || 0}`,
        'data-action': JSON.stringify(action ?? {}),
      });

      return (
        <div {...blockProps}>
          {defaultCardUrl ? (
            <img
              src={defaultCardUrl}
              alt=""
              className="riyasat-angel-card-item__default-card"
            />
          ) : null}
          {angelCardUrl ? (
            <img
              src={angelCardUrl}
              alt=""
              className="riyasat-angel-card-item__angel-card"
            />
          ) : null}
        </div>
      );
    },
  });
}

function registerAngelCardsParent() {
  registerBlockType(ANGEL_CARDS_BLOCK, {
    apiVersion: 3,
    title: 'Angel Cards',
    description: 'Angel cards section with revealable card items.',
    category: RIYASAT_CATEGORY,
    icon: AngelCardsIcon,
    supports: { html: false, align: ['wide', 'full'] },
    attributes: {
      action: { type: 'object', default: {} },
    },

    edit: ({ attributes, setAttributes }) => {
      const { action } = attributes;
      const blockProps = useBlockProps({ className: 'riyasat-angel-cards-editor' });

      return (
        <>
          <InspectorControls group="content">
            <div style={contentTabStyle}>
              <PanelBody title="Angel Cards" initialOpen={true}>
                <ActionBuilder
                  label="Action"
                  value={action ?? {}}
                  onChange={(next) => setAttributes({ action: next })}
                />
              </PanelBody>
            </div>
          </InspectorControls>

          <div {...blockProps}>
            <div className="riyasat-angel-cards__track">
              <InnerBlocks
                allowedBlocks={[ANGEL_CARD_ITEM_BLOCK]}
                template={[[ANGEL_CARD_ITEM_BLOCK, {}]]}
                templateLock={false}
                orientation="horizontal"
                renderAppender={InnerBlocks.ButtonBlockAppender}
              />
            </div>
          </div>
        </>
      );
    },

    save: ({ attributes }) => {
      const { action } = attributes;
      const blockProps = useBlockProps.save({
        className: 'riyasat-angel-cards',
        'data-action': JSON.stringify(action ?? {}),
      });

      return (
        <div {...blockProps}>
          <InnerBlocks.Content />
        </div>
      );
    },
  });
}

export function registerAngelCards() {
  registerAngelCardItem();
  registerAngelCardsParent();
}
