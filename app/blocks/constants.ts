// Plain values only — safe to import from SSR code (no @wordpress runtime).
export const APPBUILDER_CATEGORY = "appbuilder-blocks";

// Block names match the saved JSON / mobile contract.
export const IMAGE_CAROUSEL_BLOCK = "core/image-carousel";
export const IMAGE_CAROUSEL_ITEM_BLOCK = "core/image-carousel-item";

export const IMAGE_SLIDER_BLOCK = "core/image-slider";
export const IMAGE_SLIDER_ITEM_BLOCK = "core/image-slider-item";

export const PRODUCT_SCROLLER_BLOCK = "core/product-scroller";
export const PRODUCT_SCROLLER_ITEM_BLOCK = "core/product-scroller-item";

export const CATEGORIES_SCROLLER_BLOCK = "core/categories-scroller";
export const CATEGORIES_SCROLLER_ITEM_BLOCK = "core/categories-scroller-item";

export const MENU_ITEMS_BLOCK = "core/menu-items";
export const MENU_ITEM_BLOCK = "core/menu-item";
export const MENU_SUB_ITEM_BLOCK = "core/menu-sub-item";

export const STANDARD_BANNER_BLOCK = "standard/banner";
export const STANDARD_TEXT_BLOCK = "standard/text";
export const STANDARD_VIDEO_BLOCK = "standard/video";
export const STANDARD_SPACER_BLOCK = "standard/spacer";
export const STANDARD_SELECTED_PRODUCTS_BLOCK = "standard/selected-products";
export const STANDARD_SEARCH_BAR_BLOCK = "standard/search-bar";
export const STANDARD_FAQS_BLOCK = "standard/faqs";
export const STANDARD_FAQ_ITEM_BLOCK = "standard/faq-item";
export const CONTACT_US_BLOCK = "core/contact-us";

export const ADVANCED_MULTIMEDIA_SCROLLER_BLOCK = "core/advanced-multimedia-scroller";
export const ADVANCED_MULTIMEDIA_SCROLLER_ITEM_BLOCK = "core/advanced-multimedia-scroller-item";
export const HEADING_BLOCK = "core/heading";
export const IMAGE_SCROLLER_BLOCK = "core/image-scroller";
export const IMAGE_SCROLLER_ITEM_BLOCK = "core/image-scroller-item";
export const GRID_BLOCK = "core/grid";
export const GRID_ITEM_BLOCK = "core/grid-item";
export const PREBUILD_PRODUCT_SCROLLER_BLOCK = "core/prebuild-product-scroller";
export const PRODUCT_SCROLLER_WITH_BACKGROUND_IMAGE_BLOCK = "core/product-scroller-with-background-image";
export const EXPANDALBE_CATEGORIES_BLOCK = "core/expandalbe-categories";
export const EXPANDALBE_CATEGORIES_ITEM_BLOCK = "core/expandalbe-categories-item";
export const EXPANDALBE_SUB_CATEGORIES_ITEM_BLOCK = "core/expandalbe-sub-categories-item";

/**
 * Blocks kept registered + insertable. Everything else (all WP core blocks) is
 * unregistered in index.ts; the kit's myapp/* demos are dropped via
 * `disableBundledBlocks`. Add a new block's name here when you add it.
 */
export const APPBUILDER_BLOCKS = [
  IMAGE_CAROUSEL_BLOCK,
  IMAGE_CAROUSEL_ITEM_BLOCK,
  IMAGE_SLIDER_BLOCK,
  IMAGE_SLIDER_ITEM_BLOCK,
  PRODUCT_SCROLLER_BLOCK,
  PRODUCT_SCROLLER_ITEM_BLOCK,
  CATEGORIES_SCROLLER_BLOCK,
  CATEGORIES_SCROLLER_ITEM_BLOCK,
  MENU_ITEMS_BLOCK,
  MENU_ITEM_BLOCK,
  MENU_SUB_ITEM_BLOCK,
  STANDARD_BANNER_BLOCK,
  STANDARD_TEXT_BLOCK,
  STANDARD_VIDEO_BLOCK,
  STANDARD_SPACER_BLOCK,
  STANDARD_SELECTED_PRODUCTS_BLOCK,
  STANDARD_SEARCH_BAR_BLOCK,
  STANDARD_FAQS_BLOCK,
  STANDARD_FAQ_ITEM_BLOCK,
  CONTACT_US_BLOCK,
  ADVANCED_MULTIMEDIA_SCROLLER_BLOCK,
  ADVANCED_MULTIMEDIA_SCROLLER_ITEM_BLOCK,
  HEADING_BLOCK,
  IMAGE_SCROLLER_BLOCK,
  IMAGE_SCROLLER_ITEM_BLOCK,
  GRID_BLOCK,
  GRID_ITEM_BLOCK,
  PREBUILD_PRODUCT_SCROLLER_BLOCK,
  PRODUCT_SCROLLER_WITH_BACKGROUND_IMAGE_BLOCK,
  EXPANDALBE_CATEGORIES_BLOCK,
  EXPANDALBE_CATEGORIES_ITEM_BLOCK,
  EXPANDALBE_SUB_CATEGORIES_ITEM_BLOCK,
];
