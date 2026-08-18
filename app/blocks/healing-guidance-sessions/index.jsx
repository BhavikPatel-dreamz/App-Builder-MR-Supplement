// @ts-nocheck
// Healing/Guidance Sessions — parent (standard/healing-guidance-sessions) +
// child session (standard/healing-guidance-session).
import { registerBlockType } from 'gutenberg-block-kit/wp/blocks';
import {
  useBlockProps,
  InnerBlocks,
  InspectorControls,
  PanelColorSettings,
  MediaUpload,
  MediaUploadCheck,
} from 'gutenberg-block-kit/wp/block-editor';
import {
  PanelBody,
  TextControl,
  TextareaControl,
  Button,
} from 'gutenberg-block-kit/wp/components';
import { ActionBuilder } from 'gutenberg-block-kit/actions';
import {
  contentTabStyle,
  imageAttributesFromMedia,
  clearImageAttributes,
} from '../inspector-shared';
import {
  STANDARD_HEALING_GUIDANCE_SESSIONS_BLOCK,
  STANDARD_HEALING_GUIDANCE_SESSION_BLOCK,
  RIYASAT_CATEGORY,
} from '../constants';

const DEFAULT_BACKGROUND_COLOR = '#ffffff';
const DEFAULT_DURATION = '30 mins';
const DEFAULT_TITLE = 'Spiritual Call Session';
const DEFAULT_DESCRIPTION =
  'A focused, Intuitive One-on-One Call designed to offer quick clarity, guidance, and direction when you need it most.';
const DEFAULT_TAGS = ['Clarity', 'Guidance', 'Inner Calm'];
const DEFAULT_HEALER_NAME = 'Healer Vai Babani';
const DEFAULT_PRICE = '₹1,555';
const DEFAULT_SESSION_SUPPORTS_TITLE = 'The Spiritual Call Session supports you in';
const DEFAULT_SESSION_SUPPORTS = [
  'Gaining clarity around specific questions or situations',
  'Understanding energetic or emotional patterns at play',
  'Receiving intuitive guidance for decisions and life transitions',
  'Finding calm, reassurance, and inner alignment',
  'Reconnecting with your intuition and higher wisdom',
];

function HealingSessionsIcon() {
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
        d="M12 2a7 7 0 0 1 7 7c0 4.5-3.5 8.2-7 11-3.5-2.8-7-6.5-7-11a7 7 0 0 1 7-7zm0 2a5 5 0 0 0-5 5c0 3.2 2.6 6.1 5 8.2 2.4-2.1 5-5 5-8.2a5 5 0 0 0-5-5zm0 3.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5z"
      />
    </svg>
  );
}

function asStringArray(value, fallback = []) {
  return Array.isArray(value) ? value : fallback;
}

function StringRepeater({
  label,
  items,
  onChange,
  addLabel = 'Add item',
  itemLabelPrefix = 'Item',
}) {
  const list = asStringArray(items);

  function updateItem(index, nextValue) {
    const next = [...list];
    next[index] = nextValue;
    onChange(next);
  }

  function removeItem(index) {
    onChange(list.filter((_, itemIndex) => itemIndex !== index));
  }

  function addItem() {
    onChange([...list, '']);
  }

  return (
    <div style={{ marginBottom: '12px' }}>
      <p style={{ margin: '0 0 8px', fontWeight: 600 }}>{label}</p>
      {list.map((item, index) => (
        <div
          key={`${label}-${index}`}
          style={{
            border: '1px solid #e5e7eb',
            borderRadius: '8px',
            padding: '8px',
            marginBottom: '8px',
          }}
        >
          <TextControl
            label={`${itemLabelPrefix} ${index + 1}`}
            value={item ?? ''}
            onChange={(value) => updateItem(index, value)}
          />
          <Button variant="link" isDestructive onClick={() => removeItem(index)}>
            Remove
          </Button>
        </div>
      ))}
      <Button
        variant="secondary"
        onClick={addItem}
        style={{ width: '100%', justifyContent: 'center' }}
      >
        {addLabel}
      </Button>
    </div>
  );
}

function registerHealingGuidanceSession() {
  registerBlockType(STANDARD_HEALING_GUIDANCE_SESSION_BLOCK, {
    apiVersion: 3,
    title: 'Healing Guidance Session',
    description: 'A single healing/guidance session card.',
    category: RIYASAT_CATEGORY,
    parent: [STANDARD_HEALING_GUIDANCE_SESSIONS_BLOCK],
    icon: 'admin-users',
    supports: { html: false, reusable: false },
    attributes: {
      image: { type: 'string', default: '' },
      imageWidth: { type: 'number', default: 0 },
      imageHeight: { type: 'number', default: 0 },
      duration: { type: 'string', default: DEFAULT_DURATION },
      title: { type: 'string', default: DEFAULT_TITLE },
      description: { type: 'string', default: DEFAULT_DESCRIPTION },
      tags: { type: 'array', default: DEFAULT_TAGS },
      healerName: { type: 'string', default: DEFAULT_HEALER_NAME },
      price: { type: 'string', default: DEFAULT_PRICE },
      sessionSupportsTitle: {
        type: 'string',
        default: DEFAULT_SESSION_SUPPORTS_TITLE,
      },
      sessionSupports: { type: 'array', default: DEFAULT_SESSION_SUPPORTS },
      action: { type: 'object', default: {} },
    },

    edit: ({ attributes, setAttributes }) => {
      const {
        image,
        duration,
        title,
        description,
        tags,
        healerName,
        price,
        sessionSupportsTitle,
        sessionSupports,
        action,
      } = attributes;

      const tagItems = asStringArray(tags, DEFAULT_TAGS);
      const supportItems = asStringArray(sessionSupports, DEFAULT_SESSION_SUPPORTS);

      const blockProps = useBlockProps({
        className: 'riyasat-healing-guidance-session-editor',
      });

      return (
        <>
          <InspectorControls group="content">
            <div style={contentTabStyle}>
              <PanelBody title="Session" initialOpen={true}>
                <MediaUploadCheck>
                  <MediaUpload
                    onSelect={(media) =>
                      setAttributes(imageAttributesFromMedia(media, 'image'))
                    }
                    allowedTypes={['image']}
                    render={({ open }) => (
                      <div style={{ marginBottom: '12px' }}>
                        {image ? (
                          <img
                            src={image}
                            alt=""
                            style={{
                              width: '100%',
                              height: '100px',
                              objectFit: 'cover',
                              borderRadius: '6px',
                              marginBottom: '8px',
                              display: 'block',
                            }}
                          />
                        ) : null}
                        <Button
                          onClick={open}
                          variant="secondary"
                          style={{ width: '100%', justifyContent: 'center' }}
                        >
                          {image ? 'Change image' : 'Add image'}
                        </Button>
                        {image ? (
                          <Button
                            onClick={() =>
                              setAttributes(clearImageAttributes('image'))
                            }
                            variant="link"
                            isDestructive
                            style={{ marginTop: '4px' }}
                          >
                            Remove image
                          </Button>
                        ) : null}
                      </div>
                    )}
                  />
                </MediaUploadCheck>

                <TextControl
                  label="Duration"
                  value={duration}
                  onChange={(value) => setAttributes({ duration: value })}
                />
                <TextControl
                  label="Title"
                  value={title}
                  onChange={(value) => setAttributes({ title: value })}
                />
                <TextareaControl
                  label="Description"
                  rows={4}
                  value={description}
                  onChange={(value) => setAttributes({ description: value })}
                />
                <StringRepeater
                  label="Tags"
                  items={tagItems}
                  onChange={(next) => setAttributes({ tags: next })}
                  addLabel="Add tag"
                  itemLabelPrefix="Tag"
                />
                <TextControl
                  label="Healer name"
                  value={healerName}
                  onChange={(value) => setAttributes({ healerName: value })}
                />
                <TextControl
                  label="Price"
                  value={price}
                  onChange={(value) => setAttributes({ price: value })}
                />
                <TextControl
                  label="Session supports title"
                  value={sessionSupportsTitle}
                  onChange={(value) =>
                    setAttributes({ sessionSupportsTitle: value })
                  }
                />
                <StringRepeater
                  label="Session supports"
                  items={supportItems}
                  onChange={(next) => setAttributes({ sessionSupports: next })}
                  addLabel="Add support"
                  itemLabelPrefix="Support"
                />
                <ActionBuilder
                  label="Action"
                  value={action ?? {}}
                  onChange={(next) => setAttributes({ action: next })}
                />
              </PanelBody>
            </div>
          </InspectorControls>

          <div {...blockProps}>
            {image ? (
              <img
                src={image}
                alt=""
                className="riyasat-healing-guidance-session-editor__image"
              />
            ) : (
              <div className="riyasat-healing-guidance-session-editor__placeholder">
                Add session image
              </div>
            )}
            <div className="riyasat-healing-guidance-session-editor__duration">
              {duration || DEFAULT_DURATION}
            </div>
            <strong className="riyasat-healing-guidance-session-editor__title">
              {title || DEFAULT_TITLE}
            </strong>
            <div className="riyasat-healing-guidance-session-editor__description">
              {(description || DEFAULT_DESCRIPTION).slice(0, 90)}
              {(description || DEFAULT_DESCRIPTION).length > 90 ? '…' : ''}
            </div>
            <div className="riyasat-healing-guidance-session-editor__tags">
              {tagItems.filter(Boolean).map((tag, index) => (
                <span
                  key={`tag-preview-${index}`}
                  className="riyasat-healing-guidance-session-editor__tag"
                >
                  {tag}
                </span>
              ))}
            </div>
            <div className="riyasat-healing-guidance-session-editor__healer">
              {healerName || DEFAULT_HEALER_NAME}
            </div>
            <div className="riyasat-healing-guidance-session-editor__price">
              {price || DEFAULT_PRICE}
            </div>
          </div>
        </>
      );
    },

    save: ({ attributes }) => {
      const {
        image,
        imageWidth,
        imageHeight,
        duration,
        title,
        description,
        tags,
        healerName,
        price,
        sessionSupportsTitle,
        sessionSupports,
        action,
      } = attributes;

      const tagItems = asStringArray(tags);
      const supportItems = asStringArray(sessionSupports);

      const blockProps = useBlockProps.save({
        className: 'riyasat-healing-guidance-session',
        'data-image-width': `${imageWidth || 0}`,
        'data-image-height': `${imageHeight || 0}`,
        'data-tags': JSON.stringify(tagItems),
        'data-session-supports': JSON.stringify(supportItems),
        'data-action': JSON.stringify(action ?? {}),
      });

      return (
        <div {...blockProps}>
          {image ? (
            <img
              src={image}
              alt=""
              className="riyasat-healing-guidance-session__image"
            />
          ) : null}
          {duration ? (
            <span className="riyasat-healing-guidance-session__duration">
              {duration}
            </span>
          ) : null}
          {title ? (
            <h3 className="riyasat-healing-guidance-session__title">{title}</h3>
          ) : null}
          {description ? (
            <p className="riyasat-healing-guidance-session__description">
              {description}
            </p>
          ) : null}
          {tagItems.length ? (
            <ul className="riyasat-healing-guidance-session__tags">
              {tagItems.map((tag, index) => (
                <li key={`tag-${index}`}>{tag}</li>
              ))}
            </ul>
          ) : null}
          {healerName ? (
            <span className="riyasat-healing-guidance-session__healer">
              {healerName}
            </span>
          ) : null}
          {price ? (
            <span className="riyasat-healing-guidance-session__price">
              {price}
            </span>
          ) : null}
          {sessionSupportsTitle ? (
            <h4 className="riyasat-healing-guidance-session__supports-title">
              {sessionSupportsTitle}
            </h4>
          ) : null}
          {supportItems.length ? (
            <ul className="riyasat-healing-guidance-session__supports">
              {supportItems.map((item, index) => (
                <li key={`support-${index}`}>{item}</li>
              ))}
            </ul>
          ) : null}
        </div>
      );
    },
  });
}

function registerHealingGuidanceSessionsParent() {
  registerBlockType(STANDARD_HEALING_GUIDANCE_SESSIONS_BLOCK, {
    apiVersion: 3,
    title: 'Healing/Guidance Sessions',
    description: 'List of healing and guidance session cards.',
    category: RIYASAT_CATEGORY,
    icon: HealingSessionsIcon,
    supports: { html: false, align: ['wide', 'full'] },
    attributes: {
      backgroundColor: { type: 'string', default: DEFAULT_BACKGROUND_COLOR },
      action: { type: 'object', default: {} },
    },

    edit: ({ attributes, setAttributes }) => {
      const { backgroundColor, action } = attributes;
      const blockProps = useBlockProps({
        className: 'riyasat-healing-guidance-sessions-editor',
        style: {
          background: backgroundColor || DEFAULT_BACKGROUND_COLOR,
          padding: '16px',
        },
      });

      return (
        <>
          <InspectorControls group="content">
            <div style={contentTabStyle}>
              <PanelBody title="Sessions" initialOpen={true}>
                <ActionBuilder
                  label="Action"
                  value={action ?? {}}
                  onChange={(next) => setAttributes({ action: next })}
                />
              </PanelBody>
            </div>
          </InspectorControls>

          <InspectorControls>
            <PanelColorSettings
              title="Colors"
              colorSettings={[
                {
                  label: 'Background color',
                  value: backgroundColor || DEFAULT_BACKGROUND_COLOR,
                  onChange: (value) =>
                    setAttributes({
                      backgroundColor: value || DEFAULT_BACKGROUND_COLOR,
                    }),
                },
              ]}
            />
          </InspectorControls>

          <div {...blockProps}>
            <div className="riyasat-healing-guidance-sessions__track">
              <InnerBlocks
                allowedBlocks={[STANDARD_HEALING_GUIDANCE_SESSION_BLOCK]}
                template={[
                  [STANDARD_HEALING_GUIDANCE_SESSION_BLOCK, {}],
                  [STANDARD_HEALING_GUIDANCE_SESSION_BLOCK, {}],
                  [STANDARD_HEALING_GUIDANCE_SESSION_BLOCK, {}],
                ]}
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
      const { backgroundColor, action } = attributes;
      const blockProps = useBlockProps.save({
        className: 'riyasat-healing-guidance-sessions',
        'data-background-color': backgroundColor || DEFAULT_BACKGROUND_COLOR,
        'data-action': JSON.stringify(action ?? {}),
        style: { background: backgroundColor || DEFAULT_BACKGROUND_COLOR },
      });

      return (
        <div {...blockProps}>
          <InnerBlocks.Content />
        </div>
      );
    },
  });
}

export function registerStandardHealingGuidanceSessions() {
  registerHealingGuidanceSession();
  registerHealingGuidanceSessionsParent();
}
