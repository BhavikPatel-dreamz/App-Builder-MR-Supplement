// Plain values only — safe to import from SSR code (no @wordpress runtime).
export const APPBUILDER_CATEGORY = "appbuilder-blocks";

// Block names match the saved JSON / mobile contract.
export const IMAGE_CAROUSEL_BLOCK = "core/image-carousel";
export const IMAGE_CAROUSEL_ITEM_BLOCK = "core/image-carousel-item";

export const IMAGE_SLIDER_BLOCK = "core/image-slider";
export const IMAGE_SLIDER_ITEM_BLOCK = "core/image-slider-item";

export const PRODUCT_SCROLLER_BLOCK = "core/product-scroller";

export const CATEGORIES_SCROLLER_BLOCK = "core/category-scroller";
export const CATEGORIES_SCROLLER_ITEM_BLOCK = "core/category-scroller-item";

export const MENU_ITEMS_BLOCK = "core/menu-items";
export const MENU_ITEM_BLOCK = "core/menu-item";
export const MENU_SUB_ITEM_BLOCK = "core/menu-sub-item";

export const STANDARD_BANNER_BLOCK = "standard/banner";
export const STANDARD_TEXT_BLOCK = "standard/text";
export const STANDARD_VIDEO_BLOCK = "standard/video";
export const STANDARD_SPACER_BLOCK = "standard/spacer";
export const STANDARD_SELECTED_PRODUCTS_BLOCK = "standard/selected-products";
export const STANDARD_SEARCH_BAR_BLOCK = "standard/search-bar";

export const ADVANCED_MULTIMEDIA_SCROLLER_BLOCK = "core/advanced-multimedia-scroller";
export const ADVANCED_MULTIMEDIA_SCROLLER_ITEM_BLOCK = "core/advanced-multimedia-scroller-item";
export const MULTIMEDIA_SCROLLER_BLOCK = "core/multimedia-scroller";
export const MULTIMEDIA_SCROLLER_ITEM_BLOCK = "core/multimedia-scroller-item";
export const EXPANDALBE_CATEGORIES_BLOCK = "core/expandalbe-categories";
export const EXPANDALBE_CATEGORIES_ITEM_BLOCK = "core/expandalbe-categories-item";
export const EXPANDALBE_SUB_CATEGORIES_ITEM_BLOCK = "core/expandalbe-sub-categories-item";

export const TOP_MARQUEE_BLOCK = "core/top-marquee";
export const TOP_MARQUEE_ITEM_BLOCK = "core/top-marquee-item";

export const PRODUCTS_BY_CATEGORIS_SCROLLER_BLOCK =
  "core/products-by-categoris-scroller";
export const PRODUCT_BY_CATEGORIES_SCROLLER_ITEM_BLOCK =
  "core/product-by-categories-scroller-item";

export const BRAND_SCROLLER_BLOCK = "core/brand-scroller";
export const BRAND_SCROLLER_ITEM_BLOCK = "core/brand-scroller-item";

export const REWARDS_STEPS_BLOCK = "core/rewards-steps";
export const REWARDS_STEPS_ITEM_BLOCK = "core/rewards-steps-item";

export const REVIEW_SUMMARY_BLOCK = "core/review-summary";

export const STORY_SECTION_BLOCK = "core/story-section";

export const SOCIAL_FEED_BLOCK = "core/social-feed";
export const SOCIAL_FEED_ITEM_BLOCK = "core/social-feed-item";

export const BLOG_LIST_BLOCK = "core/blog-list";

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
  ADVANCED_MULTIMEDIA_SCROLLER_BLOCK,
  ADVANCED_MULTIMEDIA_SCROLLER_ITEM_BLOCK,
  MULTIMEDIA_SCROLLER_BLOCK,
  MULTIMEDIA_SCROLLER_ITEM_BLOCK,
  EXPANDALBE_CATEGORIES_BLOCK,
  EXPANDALBE_CATEGORIES_ITEM_BLOCK,
  EXPANDALBE_SUB_CATEGORIES_ITEM_BLOCK,
  TOP_MARQUEE_BLOCK,
  TOP_MARQUEE_ITEM_BLOCK,
  PRODUCTS_BY_CATEGORIS_SCROLLER_BLOCK,
  PRODUCT_BY_CATEGORIES_SCROLLER_ITEM_BLOCK,
  BRAND_SCROLLER_BLOCK,
  BRAND_SCROLLER_ITEM_BLOCK,
  REWARDS_STEPS_BLOCK,
  REWARDS_STEPS_ITEM_BLOCK,
  REVIEW_SUMMARY_BLOCK,
  STORY_SECTION_BLOCK,
  SOCIAL_FEED_BLOCK,
  SOCIAL_FEED_ITEM_BLOCK,
  BLOG_LIST_BLOCK,
];
