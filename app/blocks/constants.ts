// Plain values only — safe to import from SSR code (no @wordpress runtime).
export const RIYASAT_CATEGORY = "riyasat-blocks";

// Block names match the saved JSON / mobile contract.
export const IMAGE_CAROUSEL_BLOCK = "core/image-carousel";
export const IMAGE_CAROUSEL_ITEM_BLOCK = "core/image-carousel-item";

export const IMAGE_SLIDER_BLOCK = "core/image-slider";
export const IMAGE_SLIDER_ITEM_BLOCK = "core/image-slider-item";

export const PRODUCT_SCROLLER_BLOCK = "core/product-scroller";

export const INSTA_FEED_BLOCK = "core/insta-feed";
export const INSTA_FEED_ITEM_BLOCK = "core/insta-feed-item";

export const BLOGS_BLOCK = "core/blogs";
export const BLOGS_ITEM_BLOCK = "core/blogs-item";
export const TRANSFORMATIONAL_COURSES_BLOCK = "core/transformational-courses";

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
export const STANDARD_BLOG_LIST_BLOCK = "standard/blog-list";
export const STANDARD_HEALING_GUIDANCE_SESSIONS_BLOCK =
  "core/healing-guidance-sessions";
export const STANDARD_HEALING_GUIDANCE_SESSION_BLOCK =
  "core/healing-guidance-session";
export const STANDARD_TODAYS_MEDITATION_BLOCK =
  "core/todays-meditation";
export const STANDARD_TODAYS_AFFIRMATION_BLOCK =
  "core/todays-affirmation";
export const STANDARD_HTML_BLOCK = "standard/html";
export const ANGEL_CARDS_BLOCK = "core/angel-cards";
export const ANGEL_CARD_ITEM_BLOCK = "core/angel-card-item";
export const STANDARD_FAQS_BLOCK = "standard/faqs";
export const STANDARD_FAQ_ITEM_BLOCK = "standard/faq-item";
export const CONTACT_US_BLOCK = "core/contact-us";

/**
 * Blocks kept registered + insertable. Everything else (all WP core blocks) is
 * unregistered in index.ts; the kit's myapp/* demos are dropped via
 * `disableBundledBlocks`. Add a new block's name here when you add it.
 */
export const RIYASAT_BLOCKS = [
  IMAGE_CAROUSEL_BLOCK,
  IMAGE_CAROUSEL_ITEM_BLOCK,
  IMAGE_SLIDER_BLOCK,
  IMAGE_SLIDER_ITEM_BLOCK,
  PRODUCT_SCROLLER_BLOCK,
  INSTA_FEED_BLOCK,
  INSTA_FEED_ITEM_BLOCK,
  BLOGS_BLOCK,
  BLOGS_ITEM_BLOCK,
  TRANSFORMATIONAL_COURSES_BLOCK,
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
  STANDARD_BLOG_LIST_BLOCK,
  STANDARD_HEALING_GUIDANCE_SESSIONS_BLOCK,
  STANDARD_HEALING_GUIDANCE_SESSION_BLOCK,
  STANDARD_TODAYS_MEDITATION_BLOCK,
  STANDARD_TODAYS_AFFIRMATION_BLOCK,
  STANDARD_HTML_BLOCK,
  ANGEL_CARDS_BLOCK,
  ANGEL_CARD_ITEM_BLOCK,
  STANDARD_FAQS_BLOCK,
  STANDARD_FAQ_ITEM_BLOCK,
  CONTACT_US_BLOCK,
];
