import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";

import { createPage, listSelectablePages } from "../lib/cms.server";
import { authenticate } from "../shopify.server";

function resolvePageType(value: string | null) {
  return value === "header" || value === "footer" ? value : "page";
}

// GET /api/cms/pages — list CMS records for the action builder and page switcher.
// Optional `?type=page|header|footer` (default page). Returns `{ id, title, slug, status }[]`.
export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const type = resolvePageType(new URL(request.url).searchParams.get("type"));
  const pages = await listSelectablePages(session.shop, type);
  return Response.json(pages);
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);

  if (request.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  const body = await request.json();

  if (!body.title || body.html === undefined || body.json === undefined) {
    return Response.json(
      { error: "title, html, and json are required." },
      { status: 400 },
    );
  }

  try {
    const page = await createPage(session.shop, {
      title: body.title,
      slug: body.slug,
      html: body.html,
      json: typeof body.json === "string" ? body.json : JSON.stringify(body.json),
      status: body.status,
      description: body.description,
      seoTitle: body.seoTitle,
      seoDescription: body.seoDescription,
      ogImage: body.ogImage,
      keywords: body.keywords,
      type: body.type,
      hideHeader: body.hideHeader,
      showPageTitle: body.showPageTitle,
      backgroundColor: body.backgroundColor,
      renderingType: body.renderingType,
      headerId: body.headerId,
      footerId: body.footerId,
      stickyHeaderId: body.stickyHeaderId,
      stickyFooterId: body.stickyFooterId,
      stickyHeader: body.stickyHeader,
      stickyFooter: body.stickyFooter,
    });

    return Response.json(page, { status: 201 });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Failed to create page." },
      { status: 500 },
    );
  }
};
