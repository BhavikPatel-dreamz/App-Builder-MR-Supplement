// @ts-nocheck
// Standard Search Bar — single block (standard/search-bar).
import { useEffect, useState } from 'gutenberg-block-kit/wp/element';
import { registerBlockType } from 'gutenberg-block-kit/wp/blocks';
import {
  useBlockProps,
  InspectorControls,
  PanelColorSettings,
  MediaUpload,
  MediaUploadCheck,
} from 'gutenberg-block-kit/wp/block-editor';
import { PanelBody, TextControl, Button } from 'gutenberg-block-kit/wp/components';
import { ActionBuilder } from 'gutenberg-block-kit/actions';
import { contentTabStyle } from '../inspector-shared';
import { STANDARD_SEARCH_BAR_BLOCK, RIYASAT_CATEGORY } from '../constants';

const DEFAULT_BACKGROUND_COLOR = '#ffffff';
const DEFAULT_BORDER_COLOR = '#00000';
const DEFAULT_INPUT_BACKGROUND_COLOR = '#FFFFFF';
const PLACEHOLDER_ROTATE_MS = 2500;

const DUMMY_ICON_URLS = new Set([
  'https://dummy.png',
  'https://dummyimage.png',
  'https://dummyImage.png',
]);

const DEFAULT_PLACEHOLDERS = [
  { text: 'Search for Lehenga Cholis' },
  { text: 'Search for साड़ी' },
  { text: 'Search for Men Sherwani' },
];

function defaultPlaceholder() {
  return { text: '' };
}

function resolveIconUrl(icon) {
  const value = (icon || '').trim();
  if (!value || DUMMY_ICON_URLS.has(value)) {
    return '';
  }
  return value;
}

function getPlaceholderTexts(placeholders) {
  if (!Array.isArray(placeholders)) return [];
  return placeholders.map((item) => item?.text?.trim()).filter(Boolean);
}

function SearchBarBlockIcon() {
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
        d="M10 4a6 6 0 1 1 0 12 6 6 0 0 1 0-12zm0 2a4 4 0 1 0 0 8 4 4 0 0 0 0-8zm8.32 13.68-4.3-4.3a8.04 8.04 0 0 0 1.42-1.42l4.3 4.3-1.42 1.42z"
      />
    </svg>
  );
}

function SearchBarGlyph({ className, style, onClick }) {
  return (
    <svg
      className={className}
      style={style}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width="20"
      height="20"
      aria-hidden="true"
      focusable="false"
      onClick={onClick}
      onKeyDown={(event) => {
        if (onClick && (event.key === 'Enter' || event.key === ' ')) onClick();
      }}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      <path
        fill="currentColor"
        d="M10 4a6 6 0 1 1 0 12 6 6 0 0 1 0-12zm0 2a4 4 0 1 0 0 8 4 4 0 0 0 0-8zm8.32 13.68-4.3-4.3a8.04 8.04 0 0 0 1.42-1.42l4.3 4.3-1.42 1.42z"
      />
    </svg>
  );
}

function SearchBarIconPreview({ iconUrl, className, style, onClick }) {
  const [failed, setFailed] = useState(false);
  const resolvedIcon = resolveIconUrl(iconUrl);

  useEffect(() => {
    setFailed(false);
  }, [resolvedIcon]);

  if (!resolvedIcon || failed) {
    return (
      <SearchBarGlyph
        className={className}
        style={{ ...style, color: '#6b7280', flexShrink: 0 }}
        onClick={onClick}
      />
    );
  }

  return (
    <img
      src={resolvedIcon}
      alt=""
      className={className}
      style={style}
      onClick={onClick}
      onError={() => setFailed(true)}
    />
  );
}

function SearchBarIconPicker({ icon, onSelect, onClear }) {
  const resolvedIcon = resolveIconUrl(icon);

  return (
    <MediaUploadCheck>
      <MediaUpload
        onSelect={(media) => onSelect(media?.url ?? '')}
        allowedTypes={['image']}
        render={({ open }) => (
          <div>
            <div
              onClick={open}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') open();
              }}
              role="button"
              tabIndex={0}
              style={{
                marginBottom: '8px',
                borderRadius: '6px',
                overflow: 'hidden',
                cursor: 'pointer',
                border: '1px solid #ddd',
                minHeight: '80px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: '#f9fafb',
              }}
            >
              {resolvedIcon ? (
                <SearchBarIconPreview
                  iconUrl={resolvedIcon}
                  style={{
                    width: '48px',
                    height: '48px',
                    objectFit: 'contain',
                    display: 'block',
                  }}
                />
              ) : (
                <SearchBarGlyph style={{ width: '32px', height: '32px', color: '#6b7280' }} />
              )}
            </div>
            <Button onClick={open} variant="secondary" style={{ width: '100%' }}>
              {resolvedIcon ? 'Change icon' : 'Add icon'}
            </Button>
            {resolvedIcon && onClear ? (
              <Button onClick={onClear} variant="link" isDestructive style={{ marginTop: '4px' }}>
                Remove icon
              </Button>
            ) : null}
          </div>
        )}
      />
    </MediaUploadCheck>
  );
}

function RotatingPlaceholder({ placeholders, className, style }) {
  const texts = getPlaceholderTexts(placeholders);
  const [activeIndex, setActiveIndex] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    setActiveIndex(0);
    setVisible(true);
  }, [texts.join('|')]);

  useEffect(() => {
    if (texts.length <= 1) return undefined;

    const rotateTimer = setInterval(() => {
      setVisible(false);
      window.setTimeout(() => {
        setActiveIndex((current) => (current + 1) % texts.length);
        setVisible(true);
      }, 180);
    }, PLACEHOLDER_ROTATE_MS);

    return () => clearInterval(rotateTimer);
  }, [texts]);

  const text = texts.length ? texts[activeIndex % texts.length] : 'Search…';

  return (
    <span
      className={className}
      style={{
        ...style,
        opacity: visible ? 1 : 0,
        transition: 'opacity 0.18s ease',
      }}
    >
      {text}
    </span>
  );
}

export function registerStandardSearchBar() {
  registerBlockType(STANDARD_SEARCH_BAR_BLOCK, {
    apiVersion: 3,
    title: 'Search Bar',
    description: 'Search input with icon, rotating placeholders, colors and action.',
    category: RIYASAT_CATEGORY,
    icon: SearchBarBlockIcon,
    keywords: ['search', 'bar', 'input', 'find'],
    supports: { html: false, align: ['wide', 'full'] },
    attributes: {
      backgroundColor: { type: 'string', default: DEFAULT_BACKGROUND_COLOR },
      borderColor: { type: 'string', default: DEFAULT_BORDER_COLOR },
      inputBackgroundColor: { type: 'string', default: DEFAULT_INPUT_BACKGROUND_COLOR },
      icon: { type: 'string', default: '' },
      placeholders: { type: 'array', default: DEFAULT_PLACEHOLDERS },
      action: { type: 'object', default: {} },
    },

    edit: ({ attributes, setAttributes }) => {
      const {
        backgroundColor,
        borderColor,
        inputBackgroundColor,
        icon,
        placeholders,
        action,
      } = attributes;

      const placeholderItems = Array.isArray(placeholders) ? placeholders : [];
      const resolvedIcon = resolveIconUrl(icon);

      useEffect(() => {
        if (icon && !resolvedIcon) {
          setAttributes({ icon: '' });
        }
      }, [icon, resolvedIcon, setAttributes]);

      function updatePlaceholder(index, text) {
        const next = [...placeholderItems];
        next[index] = { ...(next[index] || defaultPlaceholder()), text };
        setAttributes({ placeholders: next });
      }

      function removePlaceholder(index) {
        setAttributes({
          placeholders: placeholderItems.filter((_, itemIndex) => itemIndex !== index),
        });
      }

      function addPlaceholder() {
        setAttributes({ placeholders: [...placeholderItems, defaultPlaceholder()] });
      }

      const blockProps = useBlockProps({
        className: 'riyasat-search-bar-editor',
      });

      const previewStyle = {
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        padding: '10px 12px',
        borderRadius: '999px',
        border: `1px solid ${borderColor || DEFAULT_BORDER_COLOR}`,
        backgroundColor: backgroundColor || DEFAULT_BACKGROUND_COLOR,
      };

      const inputStyle = {
        flex: 1,
        border: 'none',
        outline: 'none',
        background: inputBackgroundColor || DEFAULT_INPUT_BACKGROUND_COLOR,
        borderRadius: '999px',
        padding: '8px 12px',
        fontSize: '14px',
        color: '#6b7280',
        minHeight: '36px',
        display: 'flex',
        alignItems: 'center',
        overflow: 'hidden',
      };

      return (
        <>
          <InspectorControls group="content">
            <div style={contentTabStyle}>
              <PanelBody title="Search Bar" initialOpen={true}>
                <SearchBarIconPicker
                  icon={icon}
                  onSelect={(url) => setAttributes({ icon: url })}
                  onClear={() => setAttributes({ icon: '' })}
                />
                <ActionBuilder
                  label="Action"
                  value={action ?? {}}
                  onChange={(next) => setAttributes({ action: next })}
                />
              </PanelBody>

              <PanelBody title="Placeholders" initialOpen={true}>
                {placeholderItems.map((item, index) => (
                  <div
                    key={`placeholder-${index}`}
                    style={{
                      border: '1px solid #e5e7eb',
                      borderRadius: '8px',
                      padding: '8px',
                      marginBottom: '10px',
                    }}
                  >
                    <TextControl
                      label={`Placeholder ${index + 1}`}
                      value={item?.text ?? ''}
                      onChange={(value) => updatePlaceholder(index, value)}
                    />
                    {placeholderItems.length > 1 ? (
                      <Button
                        variant="link"
                        isDestructive
                        onClick={() => removePlaceholder(index)}
                      >
                        Remove
                      </Button>
                    ) : null}
                  </div>
                ))}
                <Button
                  variant="secondary"
                  onClick={addPlaceholder}
                  style={{ width: '100%', justifyContent: 'center' }}
                >
                  Add placeholder
                </Button>
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
                {
                  label: 'Border color',
                  value: borderColor || DEFAULT_BORDER_COLOR,
                  onChange: (value) =>
                    setAttributes({
                      borderColor: value || DEFAULT_BORDER_COLOR,
                    }),
                },
                {
                  label: 'Input background color',
                  value: inputBackgroundColor || DEFAULT_INPUT_BACKGROUND_COLOR,
                  onChange: (value) =>
                    setAttributes({
                      inputBackgroundColor: value || DEFAULT_INPUT_BACKGROUND_COLOR,
                    }),
                },
              ]}
            />
          </InspectorControls>

          <div {...blockProps}>
            <MediaUploadCheck>
              <MediaUpload
                onSelect={(media) => setAttributes({ icon: media?.url ?? '' })}
                allowedTypes={['image']}
                render={({ open }) => (
                  <div className="riyasat-search-bar" style={previewStyle}>
                    <SearchBarIconPreview
                      iconUrl={icon}
                      className="riyasat-search-bar__icon"
                      style={{
                        width: '20px',
                        height: '20px',
                        objectFit: 'contain',
                        flexShrink: 0,
                        cursor: 'pointer',
                      }}
                      onClick={open}
                    />
                    <div className="riyasat-search-bar__input" style={inputStyle}>
                      <RotatingPlaceholder placeholders={placeholderItems} />
                    </div>
                  </div>
                )}
              />
            </MediaUploadCheck>
          </div>
        </>
      );
    },

    save: ({ attributes }) => {
      const {
        backgroundColor,
        borderColor,
        inputBackgroundColor,
        icon,
        placeholders,
        action,
      } = attributes;

      const placeholderItems = Array.isArray(placeholders) ? placeholders : [];
      const placeholderTexts = getPlaceholderTexts(placeholderItems);
      const resolvedIcon = resolveIconUrl(icon);
      const blockProps = useBlockProps.save({
        className: 'riyasat-search-bar',
        'data-background-color': backgroundColor || DEFAULT_BACKGROUND_COLOR,
        'data-border-color': borderColor || DEFAULT_BORDER_COLOR,
        'data-input-background-color':
          inputBackgroundColor || DEFAULT_INPUT_BACKGROUND_COLOR,
        'data-icon': resolvedIcon,
        'data-placeholders': JSON.stringify(placeholderItems),
        'data-action': JSON.stringify(action ?? {}),
        style: {
          backgroundColor: backgroundColor || DEFAULT_BACKGROUND_COLOR,
          borderColor: borderColor || DEFAULT_BORDER_COLOR,
        },
      });

      return (
        <div {...blockProps}>
          {resolvedIcon ? (
            <img src={resolvedIcon} alt="" className="riyasat-search-bar__icon" />
          ) : (
            <span className="riyasat-search-bar__icon riyasat-search-bar__icon--default" aria-hidden="true" />
          )}
          <div
            className="riyasat-search-bar__input"
            style={{
              backgroundColor: inputBackgroundColor || DEFAULT_INPUT_BACKGROUND_COLOR,
            }}
          >
            <span className="riyasat-search-bar__placeholder">
              {placeholderTexts[0] || 'Search…'}
            </span>
          </div>
        </div>
      );
    },
  });
}
