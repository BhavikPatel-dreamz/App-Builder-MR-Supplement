import { registerBlocks } from "gutenberg-block-kit/editor";
import {
  getBlockTypes,
  getCategories,
  setCategories,
  unregisterBlockType,
} from "gutenberg-block-kit/wp/blocks";
import { APPBUILDER_BLOCKS, APPBUILDER_CATEGORY } from "./constants";
import { registerImageCarousel } from "./carousel";
import { registerImageSlider } from "./image-slider";
import { registerProductScroller } from "./product-scroller";
import { registerCategoriesScroller } from "./categories-scroller";
import { registerMenuItems } from "./menu-items";
import { registerStandardBanner } from "./banner";
import { registerStandardText } from "./text";
import { registerStandardVideo } from "./video";
import { registerStandardSpacer } from "./spacer";
import { registerStandardSelectedProducts } from "./selected-products";
import { registerStandardSearchBar } from "./search-bar";
import { registerAdvancedMultimediaScroller } from "./advanced-multimedia-scroller";
import { registerMultimediaScroller } from "./multimedia-scroller";
import { registerExpandalbeCategories } from "./expandalbe-categories";
import { registerTopMarquee } from "./top-marquee";
import { registerProductsByCategorisScroller } from "./products-by-categoris-scroller";
import { registerBrandScroller } from "./brand-scroller";
import { registerRewardsSteps } from "./rewards-steps";
import { registerReviewSummary } from "./review-summary";
import { registerStorySection } from "./story-section";
import { registerSocialFeed } from "./social-feed";
import { registerBlogList } from "./blog-list";

let queued = false;

/**
 * Register every appbuilder block (and the "Appbuilder Blocks" inserter category)
 * exactly once. `registerBlocks` queues the callback until the editor's registry
 * and categories are initialised, then runs it with the kit's shared wp runtime
 * — so registerBlockType() inside each block hits the editor's own registry.
 *
 * Add a new block: create app/blocks/<name>/index.jsx exporting a
 * register<Name>() function, then call it below and add its name to
 * APPBUILDER_BLOCKS in constants.ts.
 */
export function registerAppBuilderBlocks() {
  if (queued) return;
  queued = true;

  registerBlocks(() => {
    const categories = getCategories() as Array<{ slug: string }>;
    if (!categories.some((category) => category.slug === APPBUILDER_CATEGORY)) {
      setCategories([
        { slug: APPBUILDER_CATEGORY, title: "Blocks", icon: "slides" },
        ...getCategories(),
      ]);
    }

    registerImageCarousel();
    registerImageSlider();
    registerProductScroller();
    registerCategoriesScroller();
    registerMenuItems();
    registerStandardBanner();
    registerStandardText();
    registerStandardVideo();
    registerStandardSpacer();
    registerStandardSelectedProducts();
    registerStandardSearchBar();
    registerAdvancedMultimediaScroller();
    registerMultimediaScroller();
    registerExpandalbeCategories();
    registerTopMarquee();
    registerProductsByCategorisScroller();
    registerBrandScroller();
    registerRewardsSteps();
    registerReviewSummary();
    registerStorySection();
    registerSocialFeed();
    registerBlogList();

    // Disable every block that isn't a appbuilder block — this runs after the kit
    // has registered all WP core blocks (paragraph, image, heading, … and the
    // theme/query/comment blocks), so it unregisters the lot. Only appbuilder
    // blocks remain insertable. (allowedBlockTypes hides them too; this removes
    // them from the registry outright.)
    const keep = new Set<string>(APPBUILDER_BLOCKS);
    const types = getBlockTypes() as Array<{ name: string }>;
    types.forEach((type) => {
      if (!keep.has(type.name)) unregisterBlockType(type.name);
    });
  });
}

// Side-effect: importing this module registers the blocks.
registerAppBuilderBlocks();
