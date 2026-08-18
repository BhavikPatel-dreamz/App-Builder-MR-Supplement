import { registerBlocks } from "gutenberg-block-kit/editor";
import {
  getBlockTypes,
  getCategories,
  setCategories,
  unregisterBlockType,
} from "gutenberg-block-kit/wp/blocks";
import { RIYASAT_BLOCKS, RIYASAT_CATEGORY } from "./constants";
import { registerImageCarousel } from "./carousel";
import { registerImageSlider } from "./image-slider";
import { registerProductScroller } from "./product-scroller";
import { registerInstaFeed } from "./insta-feed";
import { registerBlogs } from "./blogs";
import { registerTransformationalCourses } from "./transformational-courses";
import { registerCategoriesScroller } from "./categories-scroller";
import { registerMenuItems } from "./menu-items";
import { registerStandardBanner } from "./banner";
import { registerStandardText } from "./text";
import { registerStandardVideo } from "./video";
import { registerStandardSpacer } from "./spacer";
import { registerStandardSelectedProducts } from "./selected-products";
import { registerStandardSearchBar } from "./search-bar";
import { registerStandardBlogList } from "./blog-list";
import { registerStandardHealingGuidanceSessions } from "./healing-guidance-sessions";
import { registerStandardTodaysMeditation } from "./todays-meditation";
import { registerStandardTodaysAffirmation } from "./todays-affirmation";
import { registerStandardHtml } from "./html";
import { registerAngelCards } from "./angel-cards";
import { registerStandardFaqs } from "./faqs";
import { registerContactUs } from "./contact-us";

let queued = false;

/**
 * Register every riyasat block (and the "Riyasat Blocks" inserter category)
 * exactly once. `registerBlocks` queues the callback until the editor's registry
 * and categories are initialised, then runs it with the kit's shared wp runtime
 * — so registerBlockType() inside each block hits the editor's own registry.
 *
 * Add a new block: create app/blocks/<name>/index.jsx exporting a
 * register<Name>() function, then call it below and add its name to
 * RIYASAT_BLOCKS in constants.ts.
 */
export function registerRiyasatBlocks() {
  if (queued) return;
  queued = true;

  registerBlocks(() => {
    const categories = getCategories() as Array<{ slug: string }>;
    if (!categories.some((category) => category.slug === RIYASAT_CATEGORY)) {
      setCategories([
        { slug: RIYASAT_CATEGORY, title: "Blocks", icon: "slides" },
        ...getCategories(),
      ]);
    }

    registerImageCarousel();
    registerImageSlider();
    registerProductScroller();
    registerInstaFeed();
    registerBlogs();
    registerTransformationalCourses();
    registerCategoriesScroller();
    registerMenuItems();
    registerStandardBanner();
    registerStandardText();
    registerStandardVideo();
    registerStandardSpacer();
    registerStandardSelectedProducts();
    registerStandardSearchBar();
    registerStandardBlogList();
    registerStandardHealingGuidanceSessions();
    registerStandardTodaysMeditation();
    registerStandardTodaysAffirmation();
    registerStandardHtml();
    registerAngelCards();
    registerStandardFaqs();
    registerContactUs();

    // Disable every block that isn't a riyasat block — this runs after the kit
    // has registered all WP core blocks (paragraph, image, heading, … and the
    // theme/query/comment blocks), so it unregisters the lot. Only riyasat
    // blocks remain insertable. (allowedBlockTypes hides them too; this removes
    // them from the registry outright.)
    const keep = new Set<string>(RIYASAT_BLOCKS);
    const types = getBlockTypes() as Array<{ name: string }>;
    types.forEach((type) => {
      if (!keep.has(type.name)) unregisterBlockType(type.name);
    });
  });
}

// Side-effect: importing this module registers the blocks.
registerRiyasatBlocks();
