// @ts-nocheck
import { registerBlockType } from 'gutenberg-block-kit/wp/blocks';
import {
  useBlockProps,
  InnerBlocks,
  InspectorControls,
} from 'gutenberg-block-kit/wp/block-editor';
import { PanelBody, TextControl, TextareaControl } from 'gutenberg-block-kit/wp/components';
import { ActionBuilder } from 'gutenberg-block-kit/actions';
import { contentTabStyle } from '../inspector-shared';
import {
  STANDARD_FAQS_BLOCK,
  STANDARD_FAQ_ITEM_BLOCK,
  RIYASAT_CATEGORY,
} from '../constants';

const DEFAULT_HEADING = 'Frequently Asked Questions';
const DEFAULT_QUESTION = 'What is your return policy?';
const DEFAULT_ANSWER = 'You can return any unused item within 30 days of purchase.';

function FaqIcon() {
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
        d="M12 2C6.48 2 2 6.03 2 11c0 2.31.98 4.42 2.6 6.02V22l4.16-2.28c1 .26 2.07.4 3.24.4 5.52 0 10-4.03 10-9S17.52 2 12 2zm.15 14.2h-1.8v-1.8h1.8v1.8zm2.2-6.64c-.26.4-.7.78-1.32 1.16-.52.32-.84.58-.95.79-.12.2-.18.5-.18.88h-1.7c0-.56.08-1.02.23-1.36.15-.35.5-.7 1.06-1.06.52-.34.87-.61 1.04-.8.18-.2.27-.43.27-.72 0-.34-.11-.6-.34-.79-.23-.2-.56-.3-.98-.3-.46 0-.83.13-1.1.39-.27.26-.43.62-.46 1.08H8.2c.04-.9.36-1.62.97-2.17.61-.54 1.42-.82 2.45-.82.98 0 1.76.24 2.34.72.58.48.87 1.13.87 1.95 0 .44-.13.84-.39 1.24z"
      />
    </svg>
  );
}

function registerFaqItem() {
  registerBlockType(STANDARD_FAQ_ITEM_BLOCK, {
    apiVersion: 3,
    title: 'FAQ Item',
    description: 'A single FAQ row with question and answer.',
    category: RIYASAT_CATEGORY,
    parent: [STANDARD_FAQS_BLOCK],
    icon: 'editor-help',
    supports: { html: false, reusable: false },
    attributes: {
      question: { type: 'string', default: DEFAULT_QUESTION },
      answer: { type: 'string', default: DEFAULT_ANSWER },
    },

    edit: ({ attributes, setAttributes }) => {
      const { question, answer } = attributes;
      const blockProps = useBlockProps({ className: 'riyasat-faq-item-editor' });

      return (
        <>
          <InspectorControls group="content">
            <div style={contentTabStyle}>
              <PanelBody title="FAQ Item" initialOpen={true}>
                <TextControl
                  label="Question"
                  value={question}
                  onChange={(value) => setAttributes({ question: value })}
                />
                <TextareaControl
                  label="Answer"
                  rows={4}
                  value={answer}
                  onChange={(value) => setAttributes({ answer: value })}
                />
              </PanelBody>
            </div>
          </InspectorControls>

          <div {...blockProps}>
            {question ? <h4 className="riyasat-faq-item__question">{question}</h4> : null}
            {answer ? <p className="riyasat-faq-item__answer">{answer}</p> : null}
          </div>
        </>
      );
    },

    save: ({ attributes }) => {
      const { question, answer } = attributes;
      const blockProps = useBlockProps.save({
        className: 'riyasat-faq-item',
      });

      return (
        <div {...blockProps}>
          {question ? <h4 className="riyasat-faq-item__question">{question}</h4> : null}
          {answer ? <p className="riyasat-faq-item__answer">{answer}</p> : null}
        </div>
      );
    },
  });
}

function registerFaqsParent() {
  registerBlockType(STANDARD_FAQS_BLOCK, {
    apiVersion: 3,
    title: 'FAQs',
    description: 'Frequently asked questions section.',
    category: RIYASAT_CATEGORY,
    icon: FaqIcon,
    supports: { html: false, align: ['wide', 'full'] },
    attributes: {
      heading: { type: 'string', default: DEFAULT_HEADING },
      action: { type: 'object', default: {} },
    },

    edit: ({ attributes, setAttributes }) => {
      const { heading, action } = attributes;
      const blockProps = useBlockProps({ className: 'riyasat-faqs-editor' });

      return (
        <>
          <InspectorControls group="content">
            <div style={contentTabStyle}>
              <PanelBody title="FAQs" initialOpen={true}>
                <TextControl
                  label="Heading"
                  value={heading}
                  onChange={(value) => setAttributes({ heading: value })}
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
            {heading ? <h3 className="riyasat-faqs__heading">{heading}</h3> : null}
            <InnerBlocks
              allowedBlocks={[STANDARD_FAQ_ITEM_BLOCK]}
              template={[
                [STANDARD_FAQ_ITEM_BLOCK, {}],
                [STANDARD_FAQ_ITEM_BLOCK, {}],
              ]}
              templateLock={false}
              renderAppender={InnerBlocks.ButtonBlockAppender}
            />
          </div>
        </>
      );
    },

    save: ({ attributes }) => {
      const { heading, action } = attributes;
      const blockProps = useBlockProps.save({
        className: 'riyasat-faqs',
        'data-action': JSON.stringify(action ?? {}),
      });

      return (
        <div {...blockProps}>
          {heading ? <h3 className="riyasat-faqs__heading">{heading}</h3> : null}
          <InnerBlocks.Content />
        </div>
      );
    },
  });
}

export function registerStandardFaqs() {
  registerFaqItem();
  registerFaqsParent();
}
