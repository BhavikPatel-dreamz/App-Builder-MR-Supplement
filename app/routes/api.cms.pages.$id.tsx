import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";

import { deletePage, getPageById, updatePage } from "../lib/cms.server";
import { authenticate } from "../shopify.server";

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const id = params.id;

  if (!id) {
    return Response.json({ error: "Page id is required." }, { status: 400 });
  }

  const page = await getPageById(session.shop, id);

  if (!page) {
    return Response.json({ error: "Page not found." }, { status: 404 });
  }

  return Response.json(page);
};

export const action = async ({ request, params }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const id = params.id;

  if (!id) {
    return Response.json({ error: "Page id is required." }, { status: 400 });
  }

  if (request.method === "DELETE") {
    const deleted = await deletePage(session.shop, id);

    if (!deleted) {
      return Response.json({ error: "Page not found." }, { status: 404 });
    }

    return Response.json({ success: true });
  }

  if (request.method !== "PUT") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  const body = await request.json();

  try {
    const page = await updatePage(session.shop, id, {
      title: body.title,
      slug: body.slug,
      html: body.html,
      json:
        body.json === undefined
          ? undefined
          : typeof body.json === "string"
            ? body.json
            : JSON.stringify(body.json),
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

    if (!page) {
      return Response.json({ error: "Page not found." }, { status: 404 });
    }

    return Response.json(page);
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Failed to update page." },
      { status: 500 },
    );
  }
};
