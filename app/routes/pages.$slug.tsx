import type { LinksFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { BlockRenderer } from "gutenberg-block-kit/renderer";
import { getPublishedPagePreviewBySlug } from "../lib/cms.server";

import blockLibraryStyles from "../styles/wp-block-library.css?url";
import riyasatSharedUiStyles from "../blocks/appbuilder/shared-ui.css?url";
import riyasatCarouselStyles from "../blocks/appbuilder/image-carousel.css?url";
import riyasatImageSliderStyles from "../blocks/appbuilder/image-slider.css?url";
import riyasatProductScrollerStyles from "../blocks/appbuilder/product-scroller.css?url";
import riyasatCategoriesScrollerStyles from "../blocks/appbuilder/categories-scroller.css?url";
import riyasatSelectedProductsStyles from "../blocks/appbuilder/selected-products.css?url";
//import riyasatAdvancedMultimediaScrollerStyles from "../blocks/appbuilder/advanced-multimedia-scroller.css?url";
import riyasatMultimediaScrollerStyles from "../blocks/appbuilder/multimedia-scroller.css?url";
import riyasatExpandalbeCategoriesStyles from "../blocks/appbuilder/expandalbe-categories.css?url";
import riyasatProductsByCategorisScrollerStyles from "../blocks/appbuilder/products-by-categoris-scroller.css?url";
import riyasatBrandScrollerStyles from "../blocks/appbuilder/brand-scroller.css?url";
import riyasatSocialFeedStyles from "../blocks/appbuilder/social-feed.css?url";
import riyasatStorySectionStyles from "../blocks/appbuilder/story-section.css?url";
import riyasatRewardsStepsStyles from "../blocks/appbuilder/rewards-steps.css?url";
import riyasatGoalsListStyles from "../blocks/appbuilder/goals-list.css?url";
import riyasatGoalStepsStyles from "../blocks/appbuilder/goal-steps.css?url";

export const links: LinksFunction = () => [
  { rel: "stylesheet", href: blockLibraryStyles },
  { rel: "stylesheet", href: riyasatSharedUiStyles },
  { rel: "stylesheet", href: riyasatCarouselStyles },
  { rel: "stylesheet", href: riyasatImageSliderStyles },
  { rel: "stylesheet", href: riyasatProductScrollerStyles },
  { rel: "stylesheet", href: riyasatCategoriesScrollerStyles },
  { rel: "stylesheet", href: riyasatSelectedProductsStyles },
  // { rel: "stylesheet", href: riyasatAdvancedMultimediaScrollerStyles },
  { rel: "stylesheet", href: riyasatMultimediaScrollerStyles },
  { rel: "stylesheet", href: riyasatExpandalbeCategoriesStyles },
  { rel: "stylesheet", href: riyasatProductsByCategorisScrollerStyles },
  { rel: "stylesheet", href: riyasatBrandScrollerStyles },
  { rel: "stylesheet", href: riyasatSocialFeedStyles },
  { rel: "stylesheet", href: riyasatStorySectionStyles },
  { rel: "stylesheet", href: riyasatRewardsStepsStyles },
  { rel: "stylesheet", href: riyasatGoalsListStyles },
  { rel: "stylesheet", href: riyasatGoalStepsStyles },
];

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const slug = params.slug;

  if (!slug) {
    throw new Response("Not found", { status: 404 });
  }

  const page = await getPublishedPagePreviewBySlug(slug);

  if (!page) {
    throw new Response("Page not found", { status: 404 });
  }

  return { page };
};

export default function PublicCmsPage() {
  const { page } = useLoaderData<typeof loader>();

  return (
    <main className="cms-public-page">
      <header style={{ padding: "1.5rem", borderBottom: "1px solid #e5e5e5" }}>
        <h1 style={{ margin: 0 }}>{page.title}</h1>
      </header>
      <BlockRenderer html={page.html} className="entry-content wp-block-post-content" />
    </main>
  );
}
