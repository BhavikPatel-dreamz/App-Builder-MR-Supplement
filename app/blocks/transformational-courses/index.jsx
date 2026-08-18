// @ts-nocheck
import { registerBlockType } from 'gutenberg-block-kit/wp/blocks';
import {
  useBlockProps,
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
import { contentTabStyle } from '../inspector-shared';
import { TRANSFORMATIONAL_COURSES_BLOCK, RIYASAT_CATEGORY } from '../constants';

const DEFAULT_BACKGROUND = '#F5E9FF';
const DEFAULT_BORDER = '#B05CF614';
const DEFAULT_BUTTON = '#D99A33';
const DEFAULT_BUTTON_TEXT = '#FFFFFF';

function TransformationalCoursesIcon() {
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
        d="M4 4h16a2 2 0 0 1 2 2v4h-2V6H4v12h6v2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zm9 7h9v2h-9v-2zm0 4h9v2h-9v-2zm0 4h9v2h-9v-2zm-5-8 3 1.7 3-1.7v3.4L11 16l-3-1.6V11z"
      />
    </svg>
  );
}

function defaultStat() {
  return {
    label: '',
    icon: '',
  };
}

async function pickSingleProductId() {
  const picker = typeof window !== 'undefined' ? window.shopify?.resourcePicker : null;
  if (!picker) return '';
  const selection = await picker({ type: 'product', multiple: false });
  if (!Array.isArray(selection) || selection.length === 0) return '';
  return selection?.[0]?.id ? String(selection[0].id) : '';
}

export function registerTransformationalCourses() {
  registerBlockType(TRANSFORMATIONAL_COURSES_BLOCK, {
    apiVersion: 3,
    title: 'Transformational Courses',
    description: 'Course highlight section with stats, product link and action.',
    category: RIYASAT_CATEGORY,
    icon: TransformationalCoursesIcon,
    supports: { html: false, align: ['wide', 'full'] },
    attributes: {
      title: { type: 'string', default: 'Transformational Courses' },
      description: { type: 'string', default: 'Enroll today and begin your transformation' },
      backgroundColor: { type: 'string', default: DEFAULT_BACKGROUND },
      borderColor: { type: 'string', default: DEFAULT_BORDER },
      imageUrl: { type: 'string', default: 'https://dummyImage.png' },
      courseTitle: { type: 'string', default: 'DAY 2 – The Protection (Nazar Shield)' },
      courseDescription: {
        type: 'string',
        default:
          'Seal your aura and strengthen your spiritual protection against negativity energies.',
      },
      buttonText: { type: 'string', default: 'Enroll Now' },
      buttonColor: { type: 'string', default: DEFAULT_BUTTON },
      buttonTextColor: { type: 'string', default: DEFAULT_BUTTON_TEXT },
      stats: {
        type: 'array',
        default: [
          { label: 'Aura Protection', icon: 'https://dummyImage.png' },
          { label: 'Nazar Removal', icon: 'https://dummyImage.png' },
          { label: 'Energy Cleansing', icon: 'https://dummyImage.png' },
        ],
      },
      productId: { type: 'string', default: 'gid://shopify/Product/1234567890' },
      action: { type: 'object', default: {} },
    },

    edit: ({ attributes, setAttributes }) => {
      const {
        title,
        description,
        backgroundColor,
        borderColor,
        imageUrl,
        courseTitle,
        courseDescription,
        buttonText,
        buttonColor,
        buttonTextColor,
        stats,
        productId,
        action,
      } = attributes;

      const statItems = Array.isArray(stats) ? stats : [];
      const blockProps = useBlockProps({
        className: 'riyasat-transformational-courses-editor',
        style: {
          backgroundColor: backgroundColor || DEFAULT_BACKGROUND,
          border: `1px solid ${borderColor || DEFAULT_BORDER}`,
        },
      });

      function updateStat(index, next) {
        const nextStats = [...statItems];
        nextStats[index] = { ...(nextStats[index] || defaultStat()), ...next };
        setAttributes({ stats: nextStats });
      }

      function removeStat(index) {
        setAttributes({ stats: statItems.filter((_, i) => i !== index) });
      }

      function addStat() {
        setAttributes({ stats: [...statItems, defaultStat()] });
      }

      async function onPickProduct() {
        const picked = await pickSingleProductId();
        if (!picked) return;
        setAttributes({ productId: picked });
      }

      return (
        <>
          <InspectorControls group="content">
            <div style={contentTabStyle}>
              <PanelBody title="Section" initialOpen={true}>
                <TextControl
                  label="Title"
                  value={title}
                  onChange={(value) => setAttributes({ title: value })}
                />
                <TextareaControl
                  label="Description"
                  rows={3}
                  value={description}
                  onChange={(value) => setAttributes({ description: value })}
                />
                <MediaUploadCheck>
                  <MediaUpload
                    onSelect={(media) => setAttributes({ imageUrl: media?.url || '' })}
                    allowedTypes={['image']}
                    render={({ open }) => (
                      <div style={{ marginBottom: '12px' }}>
                        <Button onClick={open} variant="secondary" style={{ width: '100%' }}>
                          {imageUrl ? 'Change image' : 'Add image'}
                        </Button>
                      </div>
                    )}
                  />
                </MediaUploadCheck>
                <TextControl
                  label="Course title"
                  value={courseTitle}
                  onChange={(value) => setAttributes({ courseTitle: value })}
                />
                <TextareaControl
                  label="Course description"
                  rows={3}
                  value={courseDescription}
                  onChange={(value) => setAttributes({ courseDescription: value })}
                />
                <TextControl
                  label="Button text"
                  value={buttonText}
                  onChange={(value) => setAttributes({ buttonText: value })}
                />
                <Button
                  variant="secondary"
                  onClick={onPickProduct}
                  style={{ width: '100%', justifyContent: 'center' }}
                >
                  {productId ? 'Change Product' : 'Select Product'}
                </Button>
                <TextControl
                  label="Product ID"
                  value={productId}
                  onChange={(value) => setAttributes({ productId: value })}
                />
                <ActionBuilder
                  label="Action"
                  value={action ?? {}}
                  onChange={(next) => setAttributes({ action: next })}
                />
              </PanelBody>

              <PanelBody title="Stats" initialOpen={false}>
                {statItems.map((stat, index) => (
                  <div
                    key={`stat-${index}`}
                    style={{
                      border: '1px solid #e5e7eb',
                      borderRadius: '8px',
                      padding: '8px',
                      marginBottom: '10px',
                    }}
                  >
                    <TextControl
                      label={`Label ${index + 1}`}
                      value={stat?.label || ''}
                      onChange={(value) => updateStat(index, { label: value })}
                    />
                    <MediaUploadCheck>
                      <MediaUpload
                        onSelect={(media) => updateStat(index, { icon: media?.url || '' })}
                        allowedTypes={['image']}
                        render={({ open }) => (
                          <div style={{ marginBottom: '8px' }}>
                            <Button onClick={open} variant="secondary">
                              {stat?.icon ? 'Change icon' : 'Add icon'}
                            </Button>
                          </div>
                        )}
                      />
                    </MediaUploadCheck>
                    {stat?.icon ? (
                      <img
                        src={stat.icon}
                        alt=""
                        style={{ width: 28, height: 28, objectFit: 'cover', display: 'block' }}
                      />
                    ) : null}
                    <Button
                      variant="link"
                      isDestructive
                      onClick={() => removeStat(index)}
                      style={{ marginTop: '4px' }}
                    >
                      Remove stat
                    </Button>
                  </div>
                ))}
                <Button variant="primary" onClick={addStat} style={{ width: '100%' }}>
                  Add stat
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
                  value: backgroundColor,
                  onChange: (value) =>
                    setAttributes({ backgroundColor: value || DEFAULT_BACKGROUND }),
                },
                {
                  label: 'Border color',
                  value: borderColor,
                  onChange: (value) => setAttributes({ borderColor: value || DEFAULT_BORDER }),
                },
                {
                  label: 'Button color',
                  value: buttonColor,
                  onChange: (value) => setAttributes({ buttonColor: value || DEFAULT_BUTTON }),
                },
                {
                  label: 'Button text color',
                  value: buttonTextColor,
                  onChange: (value) =>
                    setAttributes({ buttonTextColor: value || DEFAULT_BUTTON_TEXT }),
                },
              ]}
            />
          </InspectorControls>

          <div {...blockProps}>
            <div className="riyasat-transformational-courses">
              {title ? <h3 className="riyasat-transformational-courses__title">{title}</h3> : null}
              {description ? (
                <p className="riyasat-transformational-courses__description">{description}</p>
              ) : null}
              {imageUrl ? (
                <img
                  src={imageUrl}
                  alt=""
                  className="riyasat-transformational-courses__image"
                />
              ) : null}
              {courseTitle ? (
                <h4 className="riyasat-transformational-courses__course-title">{courseTitle}</h4>
              ) : null}
              {courseDescription ? (
                <p className="riyasat-transformational-courses__course-description">
                  {courseDescription}
                </p>
              ) : null}
              {buttonText ? (
                <span
                  className="riyasat-transformational-courses__button"
                  style={{
                    backgroundColor: buttonColor || DEFAULT_BUTTON,
                    color: buttonTextColor || DEFAULT_BUTTON_TEXT,
                  }}
                >
                  {buttonText}
                </span>
              ) : null}
              {statItems.length > 0 ? (
                <div className="riyasat-transformational-courses__stats">
                  {statItems.map((stat, index) => (
                    <div
                      key={`preview-stat-${index}`}
                      className="riyasat-transformational-courses__stat"
                    >
                      {stat?.icon ? (
                        <img src={stat.icon} alt="" className="riyasat-transformational-courses__stat-icon" />
                      ) : null}
                      {stat?.label ? (
                        <span className="riyasat-transformational-courses__stat-label">
                          {stat.label}
                        </span>
                      ) : null}
                    </div>
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
        description,
        backgroundColor,
        borderColor,
        imageUrl,
        courseTitle,
        courseDescription,
        buttonText,
        buttonColor,
        buttonTextColor,
        stats,
        productId,
        action,
      } = attributes;

      const statItems = Array.isArray(stats) ? stats : [];
      const blockProps = useBlockProps.save({
        className: 'riyasat-transformational-courses',
        'data-title': title || '',
        'data-description': description || '',
        'data-background-color': backgroundColor || DEFAULT_BACKGROUND,
        'data-border-color': borderColor || DEFAULT_BORDER,
        'data-image-url': imageUrl || '',
        'data-course-title': courseTitle || '',
        'data-course-description': courseDescription || '',
        'data-button-text': buttonText || '',
        'data-button-color': buttonColor || DEFAULT_BUTTON,
        'data-button-text-color': buttonTextColor || DEFAULT_BUTTON_TEXT,
        'data-stats': JSON.stringify(statItems),
        'data-product-id': productId || '',
        'data-action': JSON.stringify(action ?? {}),
        style: {
          backgroundColor: backgroundColor || DEFAULT_BACKGROUND,
          border: `1px solid ${borderColor || DEFAULT_BORDER}`,
        },
      });

      return (
        <div {...blockProps}>
          {title ? <h3 className="riyasat-transformational-courses__title">{title}</h3> : null}
          {description ? (
            <p className="riyasat-transformational-courses__description">{description}</p>
          ) : null}
          {imageUrl ? (
            <img src={imageUrl} alt="" className="riyasat-transformational-courses__image" />
          ) : null}
          {courseTitle ? (
            <h4 className="riyasat-transformational-courses__course-title">{courseTitle}</h4>
          ) : null}
          {courseDescription ? (
            <p className="riyasat-transformational-courses__course-description">
              {courseDescription}
            </p>
          ) : null}
          {buttonText ? (
            <span
              className="riyasat-transformational-courses__button"
              style={{
                backgroundColor: buttonColor || DEFAULT_BUTTON,
                color: buttonTextColor || DEFAULT_BUTTON_TEXT,
              }}
            >
              {buttonText}
            </span>
          ) : null}
          {statItems.length > 0 ? (
            <div className="riyasat-transformational-courses__stats">
              {statItems.map((stat, index) => (
                <div key={`saved-stat-${index}`} className="riyasat-transformational-courses__stat">
                  {stat?.icon ? (
                    <img src={stat.icon} alt="" className="riyasat-transformational-courses__stat-icon" />
                  ) : null}
                  {stat?.label ? (
                    <span className="riyasat-transformational-courses__stat-label">
                      {stat.label}
                    </span>
                  ) : null}
                </div>
              ))}
            </div>
          ) : null}
        </div>
      );
    },
  });
}
