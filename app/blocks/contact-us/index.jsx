// @ts-nocheck
import { registerBlockType } from 'gutenberg-block-kit/wp/blocks';
import { useBlockProps, InspectorControls } from 'gutenberg-block-kit/wp/block-editor';
import { PanelBody, TextControl, TextareaControl } from 'gutenberg-block-kit/wp/components';
import { ActionBuilder } from 'gutenberg-block-kit/actions';
import { contentTabStyle } from '../inspector-shared';
import { CONTACT_US_BLOCK, RIYASAT_CATEGORY } from '../constants';

const DEFAULT_EMAIL = 'support@company.com';
const DEFAULT_PHONE = '+1 234 567 8900';
const DEFAULT_WHATSAPP = '+1 234 567 8900';
const DEFAULT_BUSINESS_HOURS = 'Mon - Fri, 9:00 AM - 6:00 PM';
const DEFAULT_ADDRESS = `123 Business Street,
Suite 100,
New York, NY 10001, USA`;

function ContactUsIcon() {
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
        d="M6.6 10.8a15.3 15.3 0 0 0 6.6 6.6l2.2-2.2a1 1 0 0 1 1.02-.24c1.12.37 2.32.56 3.58.56a1 1 0 0 1 1 1V20a1 1 0 0 1-1 1C10.4 21 3 13.6 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.26.2 2.46.56 3.58a1 1 0 0 1-.24 1.02l-2.22 2.2z"
      />
    </svg>
  );
}

export function registerContactUs() {
  registerBlockType(CONTACT_US_BLOCK, {
    apiVersion: 3,
    title: 'Contact Us',
    description: 'Contact details section with action metadata.',
    category: RIYASAT_CATEGORY,
    icon: ContactUsIcon,
    supports: { html: false, align: ['wide', 'full'] },
    attributes: {
      email: { type: 'string', default: DEFAULT_EMAIL },
      phoneNumber: { type: 'string', default: DEFAULT_PHONE },
      whatsAppNumber: { type: 'string', default: DEFAULT_WHATSAPP },
      businessHours: { type: 'string', default: DEFAULT_BUSINESS_HOURS },
      officeAddress: { type: 'string', default: DEFAULT_ADDRESS },
      action: { type: 'object', default: {} },
    },

    edit: ({ attributes, setAttributes }) => {
      const {
        email,
        phoneNumber,
        whatsAppNumber,
        businessHours,
        officeAddress,
        action,
      } = attributes;
      const blockProps = useBlockProps({ className: 'riyasat-contact-us-editor' });

      return (
        <>
          <InspectorControls group="content">
            <div style={contentTabStyle}>
              <PanelBody title="Contact Us" initialOpen={true}>
                <TextControl
                  label="Email"
                  value={email}
                  onChange={(value) => setAttributes({ email: value })}
                />
                <TextControl
                  label="Phone number"
                  value={phoneNumber}
                  onChange={(value) => setAttributes({ phoneNumber: value })}
                />
                <TextControl
                  label="WhatsApp number"
                  value={whatsAppNumber}
                  onChange={(value) => setAttributes({ whatsAppNumber: value })}
                />
                <TextControl
                  label="Business hours"
                  value={businessHours}
                  onChange={(value) => setAttributes({ businessHours: value })}
                />
                <TextareaControl
                  label="Office address"
                  rows={4}
                  value={officeAddress}
                  onChange={(value) => setAttributes({ officeAddress: value })}
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
            <div className="riyasat-contact-us__row">
              <p className="riyasat-contact-us__label">Email</p>
              <p className="riyasat-contact-us__value">{email}</p>
            </div>
            <div className="riyasat-contact-us__row">
              <p className="riyasat-contact-us__label">Phone</p>
              <p className="riyasat-contact-us__value">{phoneNumber}</p>
            </div>
            <div className="riyasat-contact-us__row">
              <p className="riyasat-contact-us__label">WhatsApp</p>
              <p className="riyasat-contact-us__value">{whatsAppNumber}</p>
            </div>
            <div className="riyasat-contact-us__row">
              <p className="riyasat-contact-us__label">Hours</p>
              <p className="riyasat-contact-us__value">{businessHours}</p>
            </div>
            <div className="riyasat-contact-us__row">
              <p className="riyasat-contact-us__label">Address</p>
              <p className="riyasat-contact-us__value">{officeAddress}</p>
            </div>
          </div>
        </>
      );
    },

    save: ({ attributes }) => {
      const {
        email,
        phoneNumber,
        whatsAppNumber,
        businessHours,
        officeAddress,
        action,
      } = attributes;
      const blockProps = useBlockProps.save({
        className: 'riyasat-contact-us',
        'data-action': JSON.stringify(action ?? {}),
      });

      return (
        <div {...blockProps}>
          {email ? <p className="riyasat-contact-us__email">{email}</p> : null}
          {phoneNumber ? <p className="riyasat-contact-us__phone">{phoneNumber}</p> : null}
          {whatsAppNumber ? (
            <p className="riyasat-contact-us__whatsapp">{whatsAppNumber}</p>
          ) : null}
          {businessHours ? (
            <p className="riyasat-contact-us__business-hours">{businessHours}</p>
          ) : null}
          {officeAddress ? (
            <pre className="riyasat-contact-us__address">{officeAddress}</pre>
          ) : null}
        </div>
      );
    },
  });
}
