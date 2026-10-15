// @ts-nocheck
import { registerBlockType } from "gutenberg-block-kit/wp/blocks";
import {
  useBlockProps,
  InnerBlocks,
  InspectorControls,
  PanelColorSettings,
} from "gutenberg-block-kit/wp/block-editor";
import {
  PanelBody,
  TextControl,
  TextareaControl,
  ToggleControl,
  Button,
} from "gutenberg-block-kit/wp/components";
import { useSelect } from "gutenberg-block-kit/wp/data";
import {
  ImagePicker,
  imageAttributesFromMedia,
} from "../inspector-shared";
import {
  GOAL_STEPS_BLOCK,
  GOAL_STEP_BLOCK,
  GOAL_STEP_SECTION_BLOCK,
  APPBUILDER_CATEGORY,
} from "../constants";

const DEFAULT_BG = "#FFFFFF";
const DEFAULT_TITLE = "BUILD";
const DEFAULT_DESCRIPTION =
  "If building lean muscle without too much bulk is your goal, check out the following products. These have been meticulously hand picked by our experts to best support your goal.";
const DEFAULT_BUTTON = "Shop by Goal";
const DEFAULT_HIGHLIGHT = "#8BC53F";
const DEFAULT_HIGHLIGHT_TEXT = "LEAN MUSCLE";
const DEFAULT_STEP_BG = "#ED1C24";
const DEFAULT_SECTION_TITLE_COLOR = "#111111";
const DEFAULT_BENEFIT_COLOR = "#5F6873";

function toNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

async function pickProducts() {
  const picker = typeof window !== "undefined" ? window.shopify?.resourcePicker : null;
  if (!picker) return null;
  const selection = await picker({ type: "product", multiple: true });
  if (!Array.isArray(selection) || selection.length === 0) return null;
  return selection.map((product) => {
    const image =
      product?.images?.[0]?.originalSrc ||
      product?.images?.[0]?.src ||
      product?.images?.[0]?.url ||
      product?.featuredImage?.url ||
      product?.image?.originalSrc ||
      product?.image?.url ||
      "";
    return {
      productId: product?.id ? String(product.id) : "",
      productHandle: product?.handle ? String(product.handle) : "",
      title: product?.title ? String(product.title) : "",
      imageUrl: image ? String(image) : "",
    };
  });
}

function mergeProducts(existing, picked) {
  const byId = new Map();
  [...existing, ...picked].forEach((item) => {
    const key = String(item?.productId || item?.productHandle || "");
    if (!key) return;
    if (!byId.has(key)) byId.set(key, item);
  });
  return Array.from(byId.values());
}

const SECTION_TEMPLATE = [
  [
    GOAL_STEP_SECTION_BLOCK,
    {
      title: "MULTIVITAMINS",
      titleTextColor: DEFAULT_SECTION_TITLE_COLOR,
      benefitTextColor: DEFAULT_BENEFIT_COLOR,
      benefits: [
        "Add vitamins, minerals and other micronutrients",
        "Nutritional insurance for your muscle building goals",
        "May help prevent nutritional deficiencies",
        "Must have supplements for overall health",
      ],
      products: [],
    },
  ],
  [
    GOAL_STEP_SECTION_BLOCK,
    {
      title: "WHEY PROTEIN POWDERS",
      titleTextColor: DEFAULT_SECTION_TITLE_COLOR,
      benefitTextColor: DEFAULT_BENEFIT_COLOR,
      benefits: [
        "High protein supports muscle building",
        "As a guide: 1Kg will last 10 days",
        "Low in unwanted fats and carbs",
        "A must have supplement to support lean muscle building",
      ],
      products: [],
    },
  ],
];

const STEP_DEFAULTS = {
  title: "ESSENTIAL",
  infoSubTitle: "To build lean muscle select one supplement from ESSENTIAL row.",
  subTitle: "CHOOSE ONE ESSENTIAL SUPPLEMENT FROM EACH CATEGORY",
  backgroundImageUrl: "",
  stepNumberBackgroundColor: "#1E9BE9",
  primaryColor: "#1E9BE9",
  secondaryColor: "#fff",
  titleTextColor: "#fff",
  infoSubTitleColor: "#fff",
  subTitleTextColor: "#fff",
};

function registerGoalStepSection() {
  registerBlockType(GOAL_STEP_SECTION_BLOCK, {
    apiVersion: 3,
    title: "Goal Step Section",
    category: APPBUILDER_CATEGORY,
    parent: [GOAL_STEP_BLOCK],
    icon: "products",
    supports: { html: false, reusable: false },
    usesContext: ["stepNumberBackgroundColor", "primaryColor"],
    attributes: {
      title: { type: "string", default: "MULTIVITAMINS" },
      titleTextColor: { type: "string", default: DEFAULT_SECTION_TITLE_COLOR },
      benefitTextColor: { type: "string", default: DEFAULT_BENEFIT_COLOR },
      benefits: { type: "array", default: [], items: { type: "string" } },
      products: { type: "array", default: [], items: { type: "object" } },
    },
    edit: ({ attributes, setAttributes, context }) => {
      const { title, titleTextColor, benefitTextColor, benefits, products } = attributes;
      const productList = Array.isArray(products) ? products : [];
      const benefitList = Array.isArray(benefits) ? benefits : [];
      const accent =
        context?.stepNumberBackgroundColor || context?.primaryColor || "#1E9BE9";
      const blockProps = useBlockProps({
        className: "appbuilder-goal-step-section-editor",
        style: { ["--appbuilder-goal-step-accent"]: accent },
      });

      async function onPickProducts() {
        const picked = await pickProducts();
        if (!picked) return;
        setAttributes({ products: mergeProducts(productList, picked) });
      }

      function setBenefitAt(index, value) {
        const next = [...benefitList];
        next[index] = value;
        setAttributes({ benefits: next });
      }

      return (
        <>
          <InspectorControls>
            <PanelBody title="Section" initialOpen>
              <TextControl
                label="Title"
                value={title}
                onChange={(value) => setAttributes({ title: value })}
              />
              <p style={{ fontWeight: 600, marginBottom: 6 }}>Benefits</p>
              {benefitList.map((line, index) => (
                <div key={index} style={{ display: "flex", gap: 6, marginBottom: 8 }}>
                  <TextControl
                    label={`Benefit ${index + 1}`}
                    value={line}
                    onChange={(value) => setBenefitAt(index, value)}
                  />
                  <Button
                    variant="tertiary"
                    isDestructive
                    onClick={() =>
                      setAttributes({
                        benefits: benefitList.filter((_, i) => i !== index),
                      })
                    }
                    style={{ marginTop: 24 }}
                  >
                    Remove
                  </Button>
                </div>
              ))}
              <Button
                variant="secondary"
                onClick={() => setAttributes({ benefits: [...benefitList, ""] })}
                style={{ width: "100%", justifyContent: "center", marginBottom: 12 }}
              >
                Add benefit
              </Button>
              <Button
                variant="secondary"
                onClick={onPickProducts}
                style={{ width: "100%", justifyContent: "center" }}
              >
                {productList.length ? "Add/Change Products" : "Select Products"}
              </Button>
              {productList.map((product, index) => (
                <div key={`${product.productId}-${index}`} style={{ marginTop: 8, fontSize: 12 }}>
                  <strong>{product.title || product.productHandle || product.productId}</strong>
                  <Button
                    variant="link"
                    isDestructive
                    onClick={() =>
                      setAttributes({
                        products: productList.filter((_, i) => i !== index),
                      })
                    }
                  >
                    Remove
                  </Button>
                </div>
              ))}
            </PanelBody>
            <PanelColorSettings
              title="Colors"
              colorSettings={[
                {
                  label: "Title text color",
                  value: titleTextColor,
                  onChange: (value) =>
                    setAttributes({
                      titleTextColor: value || DEFAULT_SECTION_TITLE_COLOR,
                    }),
                },
                {
                  label: "Benefit text color",
                  value: benefitTextColor,
                  onChange: (value) =>
                    setAttributes({
                      benefitTextColor: value || DEFAULT_BENEFIT_COLOR,
                    }),
                },
              ]}
            />
          </InspectorControls>
          <div {...blockProps}>
            {title ? (
              <h3 className="appbuilder-goal-step-section__title" style={{ color: titleTextColor }}>
                {title}
              </h3>
            ) : null}
            <ul className="appbuilder-goal-step-section__benefits">
              {benefitList.filter(Boolean).map((line, i) => (
                <li key={i} style={{ color: benefitTextColor }}>
                  <span className="appbuilder-goal-step-section__check">✓</span>
                  {line}
                </li>
              ))}
            </ul>
            <Button
              variant="link"
              onClick={() => setAttributes({ benefits: [...benefitList, ""] })}
            >
              + Add benefit
            </Button>
            {productList.length ? (
              <div className="appbuilder-goal-step-section__products">
                {productList.map((product, index) => (
                  <div key={`${product.productId}-${index}`} className="appbuilder-goal-step-section__product">
                    {product.imageUrl ? (
                      <img src={product.imageUrl} alt="" />
                    ) : (
                      <div className="appbuilder-goal-step-section__product-ph" />
                    )}
                    <strong>{product.title || product.productHandle || "Product"}</strong>
                  </div>
                ))}
              </div>
            ) : (
              <p className="appbuilder-goal-step-section__empty">No products selected yet.</p>
            )}
          </div>
        </>
      );
    },
    save: ({ attributes }) => {
      const { title, titleTextColor, benefitTextColor, benefits, products } = attributes;
      const benefitList = (Array.isArray(benefits) ? benefits : []).filter(Boolean);
      const productList = Array.isArray(products) ? products : [];
      const blockProps = useBlockProps.save({
        className: "appbuilder-goal-step-section",
        "data-title-text-color": titleTextColor,
        "data-benefit-text-color": benefitTextColor,
        "data-benefits": JSON.stringify(benefitList),
        "data-products": JSON.stringify(productList),
      });
      return (
        <div {...blockProps}>
          {title ? (
            <h3 className="appbuilder-goal-step-section__title" style={{ color: titleTextColor }}>
              {title}
            </h3>
          ) : null}
          <ul className="appbuilder-goal-step-section__benefits">
            {benefitList.map((line, i) => (
              <li key={i} style={{ color: benefitTextColor }}>
                <span className="appbuilder-goal-step-section__check">✓</span>
                {line}
              </li>
            ))}
          </ul>
          {productList.length ? (
            <div className="appbuilder-goal-step-section__products">
              {productList.map((product, index) => (
                <div
                  key={`${product.productId || product.productHandle || index}`}
                  className="appbuilder-goal-step-section__product"
                  data-product-id={product.productId || ""}
                  data-product-handle={product.productHandle || ""}
                >
                  {product.imageUrl ? <img src={product.imageUrl} alt="" /> : null}
                  <strong>{product.title || product.productHandle || ""}</strong>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      );
    },
  });
}

function registerGoalStep() {
  registerBlockType(GOAL_STEP_BLOCK, {
    apiVersion: 3,
    title: "Goal Step",
    category: APPBUILDER_CATEGORY,
    parent: [GOAL_STEPS_BLOCK],
    icon: "flag",
    supports: { html: false, reusable: false },
    providesContext: {
      stepNumberBackgroundColor: "stepNumberBackgroundColor",
      primaryColor: "primaryColor",
    },
    attributes: {
      title: { type: "string", default: STEP_DEFAULTS.title },
      infoSubTitle: { type: "string", default: STEP_DEFAULTS.infoSubTitle },
      subTitle: { type: "string", default: STEP_DEFAULTS.subTitle },
      backgroundImageUrl: { type: "string", default: "" },
      stepNumberBackgroundColor: { type: "string", default: STEP_DEFAULTS.stepNumberBackgroundColor },
      primaryColor: { type: "string", default: STEP_DEFAULTS.primaryColor },
      secondaryColor: { type: "string", default: STEP_DEFAULTS.secondaryColor },
      titleTextColor: { type: "string", default: STEP_DEFAULTS.titleTextColor },
      infoSubTitleColor: { type: "string", default: STEP_DEFAULTS.infoSubTitleColor },
      subTitleTextColor: { type: "string", default: STEP_DEFAULTS.subTitleTextColor },
    },
    edit: ({ attributes, setAttributes, clientId }) => {
      const {
        title,
        infoSubTitle,
        subTitle,
        backgroundImageUrl,
        stepNumberBackgroundColor,
        primaryColor,
        secondaryColor,
        titleTextColor,
        infoSubTitleColor,
        subTitleTextColor,
      } = attributes;
      const { index, total } = useSelect(
        (select) => {
          const root = select("core/block-editor").getBlockRootClientId(clientId);
          const siblings = select("core/block-editor").getBlockOrder(root) || [];
          return {
            index: Math.max(siblings.indexOf(clientId), 0),
            total: Math.max(siblings.length, 1),
          };
        },
        [clientId],
      );
      const accent = stepNumberBackgroundColor || primaryColor || DEFAULT_STEP_BG;
      const blockProps = useBlockProps({
        className: "appbuilder-goal-step-editor",
        style: { ["--appbuilder-goal-step-accent"]: accent },
      });

      return (
        <>
          <InspectorControls>
            <PanelBody title="Step" initialOpen>
              <TextControl
                label="Title"
                value={title}
                onChange={(value) => setAttributes({ title: value })}
              />
              <TextControl
                label="Info SubTitle"
                value={infoSubTitle}
                onChange={(value) => setAttributes({ infoSubTitle: value })}
              />
              <TextControl
                label="SubTitle"
                value={subTitle}
                onChange={(value) => setAttributes({ subTitle: value })}
              />
              <ImagePicker
                addLabel="Add background image"
                changeLabel="Change background image"
                imageUrl={backgroundImageUrl}
                onSelect={(media) =>
                  setAttributes({
                    backgroundImageUrl: media?.url || media?.[0]?.url || "",
                  })
                }
                onClear={() => setAttributes({ backgroundImageUrl: "" })}
              />
            </PanelBody>
            <PanelColorSettings
              title="Colors"
              colorSettings={[
                {
                  label: "Step number background",
                  value: stepNumberBackgroundColor,
                  onChange: (value) =>
                    setAttributes({
                      stepNumberBackgroundColor: value || DEFAULT_STEP_BG,
                    }),
                },
                {
                  label: "Primary color",
                  value: primaryColor,
                  onChange: (value) =>
                    setAttributes({ primaryColor: value || DEFAULT_STEP_BG }),
                },
                {
                  label: "Secondary color",
                  value: secondaryColor,
                  onChange: (value) =>
                    setAttributes({ secondaryColor: value || "#fff" }),
                },
                {
                  label: "Title text color",
                  value: titleTextColor,
                  onChange: (value) =>
                    setAttributes({ titleTextColor: value || "#fff" }),
                },
                {
                  label: "Info subtitle color",
                  value: infoSubTitleColor,
                  onChange: (value) =>
                    setAttributes({ infoSubTitleColor: value || "#fff" }),
                },
                {
                  label: "Subtitle text color",
                  value: subTitleTextColor,
                  onChange: (value) =>
                    setAttributes({ subTitleTextColor: value || "#fff" }),
                },
              ]}
            />
          </InspectorControls>
          <div {...blockProps}>
            <div className="appbuilder-goal-step__row">
              <div className="appbuilder-goal-step__rail">
                <span className="appbuilder-goal-step__num">{index + 1}</span>
              </div>
              <div className="appbuilder-goal-step__copy">
                {title ? (
                  <span className="appbuilder-goal-step__pill">{title}</span>
                ) : null}
                {infoSubTitle ? (
                  <p
                    className="appbuilder-goal-step__info"
                    style={{
                      color:
                        infoSubTitleColor && !/^#fff(fff)?$/i.test(infoSubTitleColor)
                          ? infoSubTitleColor
                          : "#5F6873",
                    }}
                  >
                    {infoSubTitle}
                  </p>
                ) : null}
              </div>
              <span className="appbuilder-goal-step__watermark" aria-hidden="true">
                {index + 1}
              </span>
            </div>
            {backgroundImageUrl || subTitle ? (
              <div
                className="appbuilder-goal-step__banner"
                style={{ color: titleTextColor || "#fff" }}
              >
                {backgroundImageUrl ? (
                  <img
                    src={backgroundImageUrl}
                    alt=""
                    className="appbuilder-goal-step__banner-img"
                  />
                ) : null}
                <div className="appbuilder-goal-step__banner-inner">
                  <div className="appbuilder-goal-step__kicker">
                    STEP {index + 1} OF {total}
                  </div>
                  {subTitle ? (
                    <p style={{ margin: 0, fontSize: 13, color: subTitleTextColor || "#fff" }}>
                      {subTitle}
                    </p>
                  ) : null}
                </div>
              </div>
            ) : null}
            <InnerBlocks
              allowedBlocks={[GOAL_STEP_SECTION_BLOCK]}
              template={SECTION_TEMPLATE}
              templateLock={false}
              renderAppender={InnerBlocks.ButtonBlockAppender}
            />
          </div>
        </>
      );
    },
    save: ({ attributes }) => {
      const {
        title,
        infoSubTitle,
        subTitle,
        backgroundImageUrl,
        stepNumberBackgroundColor,
        primaryColor,
        secondaryColor,
        titleTextColor,
        infoSubTitleColor,
        subTitleTextColor,
      } = attributes;
      const blockProps = useBlockProps.save({
        className: "appbuilder-goal-step",
        style: { ["--appbuilder-goal-step-accent"]: stepNumberBackgroundColor || primaryColor || DEFAULT_STEP_BG },
        "data-background-image-url": backgroundImageUrl,
        "data-step-number-background-color": stepNumberBackgroundColor,
        "data-primary-color": primaryColor,
        "data-secondary-color": secondaryColor,
        "data-title-text-color": titleTextColor,
        "data-info-sub-title-color": infoSubTitleColor,
        "data-sub-title-text-color": subTitleTextColor,
      });
      return (
        <div {...blockProps}>
          <div className="appbuilder-goal-step__row">
            <div className="appbuilder-goal-step__rail">
              <span className="appbuilder-goal-step__num" />
            </div>
            <div className="appbuilder-goal-step__copy">
              {title ? (
                <span className="appbuilder-goal-step__pill">{title}</span>
              ) : null}
              {infoSubTitle ? (
                <p className="appbuilder-goal-step__info">{infoSubTitle}</p>
              ) : null}
            </div>
            <span className="appbuilder-goal-step__watermark" aria-hidden="true" />
          </div>
          {backgroundImageUrl ? (
            <img className="appbuilder-goal-step__bg" src={backgroundImageUrl} alt="" />
          ) : null}
          {subTitle ? <p className="appbuilder-goal-step__subtitle">{subTitle}</p> : null}
          <InnerBlocks.Content />
        </div>
      );
    },
  });
}

function registerGoalStepsParent() {
  registerBlockType(GOAL_STEPS_BLOCK, {
    apiVersion: 3,
    title: "Goal Steps",
    category: APPBUILDER_CATEGORY,
    icon: "editor-ol",
    supports: { html: false, align: ["wide", "full"] },
    attributes: {
      backgroundColor: { type: "string", default: DEFAULT_BG },
      title: { type: "string", default: DEFAULT_TITLE },
      description: { type: "string", default: DEFAULT_DESCRIPTION },
      titleTextColor: { type: "string", default: "#FFFFFF" },
      descriptionTextColor: { type: "string", default: "#FFFFFF" },
      titleFontSize: { type: "number", default: 48 },
      descriptionFontSize: { type: "number", default: 24 },
      showStepsDot: { type: "boolean", default: true },
      buttonText: { type: "string", default: DEFAULT_BUTTON },
      buttonTextColor: { type: "string", default: "#fff" },
      buttonFontSize: { type: "number", default: 10 },
      hightLightTextColot: { type: "string", default: DEFAULT_HIGHLIGHT },
      highlightText: { type: "string", default: DEFAULT_HIGHLIGHT_TEXT },
      highlightFontSize: { type: "number", default: 48 },
      imageUrl: { type: "string", default: "" },
    },
    edit: ({ attributes, setAttributes }) => {
      const {
        backgroundColor,
        title,
        description,
        titleTextColor,
        descriptionTextColor,
        titleFontSize,
        descriptionFontSize,
        showStepsDot,
        buttonText,
        buttonTextColor,
        buttonFontSize,
        hightLightTextColot,
        highlightText,
        highlightFontSize,
        imageUrl,
      } = attributes;
      const highlight = hightLightTextColot || DEFAULT_HIGHLIGHT;
      const titleSize = toNumber(titleFontSize, 48);
      const descSize = toNumber(descriptionFontSize, 24);
      const buttonSize = toNumber(buttonFontSize, 10);
      const highlightSize = toNumber(highlightFontSize, titleSize);
      const blockProps = useBlockProps({
        className: `appbuilder-goal-steps-editor${showStepsDot ? " is-showing-dots" : ""}`,
      });

      return (
        <>
          <InspectorControls>
            <PanelBody title="Header" initialOpen>
              <TextControl
                label="Title"
                value={title}
                onChange={(value) => setAttributes({ title: value })}
              />
              <TextControl
                label="Title Font Size"
                type="number"
                min={0}
                value={titleSize}
                onChange={(value) =>
                  setAttributes({ titleFontSize: toNumber(value, 48) })
                }
              />
              <TextControl
                label="Highlight Text"
                value={highlightText}
                onChange={(value) => setAttributes({ highlightText: value })}
              />
              <TextControl
                label="Highlight Font Size"
                type="number"
                min={0}
                value={highlightSize}
                onChange={(value) =>
                  setAttributes({ highlightFontSize: toNumber(value, 48) })
                }
              />
              <TextareaControl
                label="Description"
                rows={4}
                value={description}
                onChange={(value) => setAttributes({ description: value })}
              />
              <TextControl
                label="Description Font Size"
                type="number"
                min={0}
                value={descSize}
                onChange={(value) =>
                  setAttributes({ descriptionFontSize: toNumber(value, 24) })
                }
              />
              <TextControl
                label="Button Text"
                value={buttonText}
                onChange={(value) => setAttributes({ buttonText: value })}
              />
              <TextControl
                label="Button Font Size"
                type="number"
                min={0}
                value={buttonSize}
                onChange={(value) =>
                  setAttributes({ buttonFontSize: toNumber(value, 10) })
                }
              />
              <ToggleControl
                label="Show Steps Dot"
                checked={!!showStepsDot}
                onChange={(value) => setAttributes({ showStepsDot: value })}
              />
              <ImagePicker
                imageUrl={imageUrl}
                onSelect={(media) =>
                  setAttributes({ imageUrl: imageAttributesFromMedia(media).imageUrl })
                }
                onClear={() => setAttributes({ imageUrl: "" })}
              />
            </PanelBody>
            <PanelColorSettings
              title="Colors"
              colorSettings={[
                {
                  label: "Background color",
                  value: backgroundColor,
                  onChange: (value) =>
                    setAttributes({ backgroundColor: value || DEFAULT_BG }),
                },
                {
                  label: "Title text color",
                  value: titleTextColor,
                  onChange: (value) =>
                    setAttributes({ titleTextColor: value || "#FFFFFF" }),
                },
                {
                  label: "Description text color",
                  value: descriptionTextColor,
                  onChange: (value) =>
                    setAttributes({ descriptionTextColor: value || "#FFFFFF" }),
                },
                {
                  label: "Button text color",
                  value: buttonTextColor,
                  onChange: (value) =>
                    setAttributes({ buttonTextColor: value || "#fff" }),
                },
                {
                  label: "Highlight text color",
                  value: hightLightTextColot,
                  onChange: (value) =>
                    setAttributes({ hightLightTextColot: value || DEFAULT_HIGHLIGHT }),
                },
              ]}
            />
          </InspectorControls>
          <div {...blockProps}>
            <div
              style={{
                position: "relative",
                background: "#14202b",
                color: titleTextColor || "#fff",
                borderRadius: 16,
                overflow: "hidden",
                padding: "28px 24px 40px",
                textAlign: "center",
                marginBottom: 12,
              }}
            >
              {imageUrl ? (
                <img
                  src={imageUrl}
                  alt=""
                  style={{
                    position: "absolute",
                    inset: 0,
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                    opacity: 0.25,
                  }}
                />
              ) : null}
              <div style={{ position: "relative" }}>
                {buttonText ? (
                  <span
                    style={{
                      display: "inline-block",
                      border: "1px solid rgba(255,255,255,0.4)",
                      borderRadius: 999,
                      padding: "4px 12px",
                      fontSize: buttonSize,
                      color: buttonTextColor || "#fff",
                      marginBottom: 12,
                      textTransform: "uppercase",
                    }}
                  >
                    {buttonText}
                  </span>
                ) : null}
                {title || highlightText ? (
                  <h2
                    style={{
                      margin: "0 0 8px",
                      fontSize: titleSize,
                      color: titleTextColor || "#fff",
                      fontWeight: 800,
                    }}
                  >
                    {title}
                    {title && highlightText ? " " : null}
                    {highlightText ? (
                      <span style={{ color: highlight, fontSize: highlightSize }}>
                        {highlightText}
                      </span>
                    ) : null}
                  </h2>
                ) : null}
                <div
                  style={{
                    width: 48,
                    height: 3,
                    background: highlight,
                    margin: "0 auto 14px",
                  }}
                />
                {description ? (
                  <p
                    style={{
                      margin: 0,
                      fontSize: descSize,
                      color: descriptionTextColor || "#fff",
                      lineHeight: 1.45,
                      maxWidth: 720,
                      marginLeft: "auto",
                      marginRight: "auto",
                    }}
                  >
                    {description}
                  </p>
                ) : null}
              </div>
            </div>
            <div className="appbuilder-goal-steps__list">
            <InnerBlocks
              allowedBlocks={[GOAL_STEP_BLOCK]}
              template={[
                [GOAL_STEP_BLOCK, { ...STEP_DEFAULTS, title: "ESSENTIAL" }],
                [
                  GOAL_STEP_BLOCK,
                  {
                    ...STEP_DEFAULTS,
                    title: "RECOMMENDED",
                    stepNumberBackgroundColor: "#E86B2A",
                    primaryColor: "#E86B2A",
                    infoSubTitle:
                      "Boost your lean muscle building goals by choosing one additional supplement from each RECOMMENDED row.",
                  },
                ],
                [
                  GOAL_STEP_BLOCK,
                  {
                    ...STEP_DEFAULTS,
                    title: "ADVANCED",
                    stepNumberBackgroundColor: "#ED1C24",
                    primaryColor: "#ED1C24",
                    infoSubTitle:
                      "Experienced trainers building lean muscle add one additional item from each ADVANCED row.",
                  },
                ],
              ]}
              templateLock={false}
              renderAppender={InnerBlocks.ButtonBlockAppender}
            />
            </div>
          </div>
        </>
      );
    },
    save: ({ attributes }) => {
      const {
        backgroundColor,
        title,
        description,
        titleTextColor,
        descriptionTextColor,
        titleFontSize,
        descriptionFontSize,
        showStepsDot,
        buttonText,
        buttonTextColor,
        buttonFontSize,
        hightLightTextColot,
        highlightText,
        highlightFontSize,
        imageUrl,
      } = attributes;
      const blockProps = useBlockProps.save({
        className: `appbuilder-goal-steps${showStepsDot ? " is-showing-dots" : ""}`,
        "data-background-color": backgroundColor,
        "data-title-text-color": titleTextColor,
        "data-description-text-color": descriptionTextColor,
        "data-title-font-size": String(titleFontSize ?? 48),
        "data-description-font-size": String(descriptionFontSize ?? 24),
        "data-show-steps-dot": showStepsDot ? "true" : "false",
        "data-button-text-color": buttonTextColor,
        "data-button-font-size": String(buttonFontSize ?? 10),
        "data-highlight-text-color": hightLightTextColot,
        "data-highlight-text": highlightText || "",
        "data-highlight-font-size": String(highlightFontSize ?? 48),
        "data-image-url": imageUrl,
        style: { background: backgroundColor || DEFAULT_BG },
      });
      return (
        <div {...blockProps}>
          {imageUrl ? (
            <img className="appbuilder-goal-steps__image" src={imageUrl} alt="" />
          ) : null}
          {buttonText ? (
            <span className="appbuilder-goal-steps__button">{buttonText}</span>
          ) : null}
          {title || highlightText ? (
            <h2 className="appbuilder-goal-steps__title">
              {title}
              {title && highlightText ? " " : null}
              {highlightText ? (
                <span
                  className="appbuilder-goal-steps__highlight"
                  style={{
                    color: hightLightTextColot || DEFAULT_HIGHLIGHT,
                    fontSize: toNumber(highlightFontSize, 48),
                  }}
                >
                  {highlightText}
                </span>
              ) : null}
            </h2>
          ) : null}
          {description ? (
            <p className="appbuilder-goal-steps__description">{description}</p>
          ) : null}
          <div className="appbuilder-goal-steps__list">
            <InnerBlocks.Content />
          </div>
        </div>
      );
    },
  });
}

export function registerGoalSteps() {
  registerGoalStepSection();
  registerGoalStep();
  registerGoalStepsParent();
}
