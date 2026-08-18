import type { LinksFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { BlockRenderer } from "gutenberg-block-kit/renderer";

import blockLibraryStyles from "../styles/wp-block-library.css?url";
import riyasatSharedUiStyles from "../blocks/riyasat/shared-ui.css?url";
import riyasatCarouselStyles from "../blocks/riyasat/image-carousel.css?url";
import riyasatImageSliderStyles from "../blocks/riyasat/image-slider.css?url";
import riyasatProductScrollerStyles from "../blocks/riyasat/product-scroller.css?url";
import riyasatCategoriesScrollerStyles from "../blocks/riyasat/categories-scroller.css?url";
import riyasatSelectedProductsStyles from "../blocks/riyasat/selected-products.css?url";

import { getPageBySlug } from "../lib/cms.server";

export const links: LinksFunction = () => [
  { rel: "stylesheet", href: blockLibraryStyles },
  { rel: "stylesheet", href: riyasatSharedUiStyles },
  { rel: "stylesheet", href: riyasatCarouselStyles },
  { rel: "stylesheet", href: riyasatImageSliderStyles },
  { rel: "stylesheet", href: riyasatProductScrollerStyles },
  { rel: "stylesheet", href: riyasatCategoriesScrollerStyles },
  { rel: "stylesheet", href: riyasatSelectedProductsStyles },
];

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const slug = params.slug;

  if (!slug) {
    throw new Response("Not found", { status: 404 });
  }

  const url = new URL(request.url);
  const shop = url.searchParams.get("shop");

  const page = shop
    ? await getPageBySlug(shop, slug)
    : await getPublishedPageBySlug(slug);

  if (!page) {
    throw new Response("Page not found", { status: 404 });
  }

  return { page };
};

async function getPublishedPageBySlug(slug: string) {
  const db = (await import("../db.server")).default;
  const page = await db.page.findFirst({
    where: { slug, status: "published" },
    orderBy: { updatedAt: "desc" },
  });

  if (!page) {
    return null;
  }

  return {
    id: page.id,
    title: page.title,
    slug: page.slug,
    html: page.html,
    json: page.json,
    status: page.status,
    updatedAt: page.updatedAt.toISOString(),
  };
}

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
