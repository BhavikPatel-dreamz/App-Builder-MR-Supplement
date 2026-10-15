import type {
  ActionFunctionArgs,
  HeadersFunction,
  LoaderFunctionArgs,
} from "react-router";
import { useFetcher, useLoaderData, useSearchParams } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";

import {
  deletePage,
  listPages,
  listPagesWithComponents,
  updatePage,
  type PageType,
} from "../lib/cms.server";
import { authenticate } from "../shopify.server";

const TABS: { type: PageType; label: string; plural: string }[] = [
  { type: "page", label: "page", plural: "Pages" },
  { type: "header", label: "header", plural: "Headers" },
  { type: "footer", label: "footer", plural: "Footers" },
];

function resolveType(value: string | null): PageType {
  return value === "header" || value === "footer" ? value : "page";
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const url = new URL(request.url);
  const q = (url.searchParams.get("q") || "").trim().toLowerCase();
  const type = resolveType(url.searchParams.get("type"));

  const records =
    type === "page"
      ? await listPagesWithComponents(session.shop)
      : (await listPages(session.shop, type)).map((page) => ({
          ...page,
          headerTitle: "",
          footerTitle: "",
          stickyHeaderTitle: "",
          stickyFooterTitle: "",
        }));

  const pages = q
    ? records.filter(
        (page) =>
          page.title.toLowerCase().includes(q) ||
          page.slug.toLowerCase().includes(q) ||
          page.description.toLowerCase().includes(q),
      )
    : records;

  return { pages, total: records.length, q, type };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();
  const intent = String(formData.get("intent") || "status");
  const pageId = String(formData.get("pageId") || "");

  if (!pageId) {
    return { error: "Missing page id." };
  }

  if (intent === "delete") {
    const deleted = await deletePage(session.shop, pageId);
    return deleted ? { deleted: pageId } : { error: "Page not found." };
  }

  const status = String(formData.get("status") || "");
  if (!["draft", "published"].includes(status)) {
    return { error: "Invalid publish request." };
  }

  const page = await updatePage(session.shop, pageId, {
    status: status as "draft" | "published",
  });

  if (!page) {
    return { error: "Page not found." };
  }

  return { page };
};

type PageRow = ReturnType<typeof useLoaderData<typeof loader>>["pages"][number];

function PageRowActions({
  page,
  showPreview,
}: {
  page: PageRow;
  showPreview: boolean;
}) {
  const fetcher = useFetcher<typeof action>();
  const busy = fetcher.state !== "idle";

  return (
    <s-stack direction="inline" gap="small">
      <s-button href={`/app/${page.id}`} variant="secondary">
        Edit
      </s-button>

      <fetcher.Form method="post">
        <input type="hidden" name="intent" value="status" />
        <input type="hidden" name="pageId" value={page.id} />
        <input
          type="hidden"
          name="status"
          value={page.status === "published" ? "draft" : "published"}
        />
        <s-button
          type="submit"
          variant="tertiary"
          {...(busy ? { loading: true } : {})}
        >
          {page.status === "published" ? "Unpublish" : "Publish"}
        </s-button>
      </fetcher.Form>

      {showPreview && page.status === "published" ? (
        <s-button
          href={`/pages/${page.slug}`}
          target="_blank"
          variant="tertiary"
        >
          Preview
        </s-button>
      ) : null}

      <fetcher.Form
        method="post"
        onSubmit={(event) => {
          if (
            !window.confirm(`Delete “${page.title}”? This can't be undone.`)
          ) {
            event.preventDefault();
          }
        }}
      >
        <input type="hidden" name="intent" value="delete" />
        <input type="hidden" name="pageId" value={page.id} />
        <s-button
          type="submit"
          variant="tertiary"
          tone="critical"
          {...(busy ? { loading: true } : {})}
        >
          Delete
        </s-button>
      </fetcher.Form>
    </s-stack>
  );
}

export default function CmsIndex() {
  const { pages, total, q, type } = useLoaderData<typeof loader>();
  const [, setSearchParams] = useSearchParams();

  const tab = TABS.find((t) => t.type === type) ?? TABS[0];
  const isPage = type === "page";

  return (
    <s-page heading="CMS">
      <s-button slot="primary-action" href={`/app/new?type=${type}`}>
        Create {tab.label}
      </s-button>

      <s-section>
        <s-stack direction="block" gap="base">
          <s-stack direction="inline" gap="small">
            {TABS.map((t) => (
              <s-button
                key={t.type}
                variant={t.type === type ? "primary" : "tertiary"}
                onClick={() =>
                  setSearchParams(
                    (prev) => {
                      prev.set("type", t.type);
                      prev.delete("q");
                      return prev;
                    },
                    { replace: true },
                  )
                }
              >
                {t.plural}
              </s-button>
            ))}
          </s-stack>

          <s-heading>
            All {tab.plural.toLowerCase()} ({total})
          </s-heading>

          <s-search-field
            label={`Search ${tab.plural.toLowerCase()}`}
            labelAccessibilityVisibility="exclusive"
            placeholder="Search by title, slug, or description"
            value={q}
            onInput={(e) => {
              const value = e.currentTarget.value;
              setSearchParams(
                (prev) => {
                  if (value) {
                    prev.set("q", value);
                  } else {
                    prev.delete("q");
                  }
                  return prev;
                },
                { replace: true },
              );
            }}
          ></s-search-field>

          {pages.length === 0 ? (
            <s-paragraph>
              {q ? (
                <>
                  No {tab.plural.toLowerCase()} match “{q}”.
                </>
              ) : (
                <>
                  No {tab.plural.toLowerCase()} yet.{" "}
                  <s-link href={`/app/new?type=${type}`}>
                    Create your first {tab.label}
                  </s-link>
                  .
                </>
              )}
            </s-paragraph>
          ) : (
            <s-table>
              <s-table-header-row>
                <s-table-header>Title</s-table-header>
                <s-table-header>Slug</s-table-header>
                {isPage ? <s-table-header>Header</s-table-header> : null}
                {isPage ? <s-table-header>Footer</s-table-header> : null}
                {isPage ? <s-table-header>Sticky</s-table-header> : null}
                <s-table-header>Status</s-table-header>
                <s-table-header>Updated</s-table-header>
                <s-table-header>Actions</s-table-header>
              </s-table-header-row>
              <s-table-body>
                {pages.map((page) => (
                  <s-table-row key={page.id}>
                    <s-table-cell>
                      <s-stack direction="block" gap="none">
                        <s-link href={`/app/${page.id}`}>{page.title}</s-link>
                        {page.description ? (
                          <s-text color="subdued">
                            {page.description.length > 80
                              ? `${page.description.slice(0, 80)}…`
                              : page.description}
                          </s-text>
                        ) : null}
                      </s-stack>
                    </s-table-cell>
                    <s-table-cell>
                      <s-text color="subdued">/{page.slug}</s-text>
                    </s-table-cell>
                    {isPage ? (
                      <s-table-cell>
                        <s-text color="subdued">
                          {page.headerTitle || "None"}
                        </s-text>
                      </s-table-cell>
                    ) : null}
                    {isPage ? (
                      <s-table-cell>
                        <s-text color="subdued">
                          {page.footerTitle || "None"}
                        </s-text>
                      </s-table-cell>
                    ) : null}
                    {isPage ? (
                      <s-table-cell>
                        {page.stickyHeaderTitle || page.stickyFooterTitle ? (
                          <s-stack direction="block" gap="none">
                            {page.stickyHeaderTitle ? (
                              <s-text color="subdued">
                                ↑ {page.stickyHeaderTitle}
                              </s-text>
                            ) : null}
                            {page.stickyFooterTitle ? (
                              <s-text color="subdued">
                                ↓ {page.stickyFooterTitle}
                              </s-text>
                            ) : null}
                          </s-stack>
                        ) : (
                          <s-text color="subdued">None</s-text>
                        )}
                      </s-table-cell>
                    ) : null}
                    <s-table-cell>
                      {page.status === "published" ? (
                        <s-badge tone="success">Published</s-badge>
                      ) : (
                        <s-badge>Draft</s-badge>
                      )}
                    </s-table-cell>
                    <s-table-cell>
                      <s-text color="subdued">
                        {new Date(page.updatedAt).toLocaleDateString(
                          undefined,
                          {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                          },
                        )}
                      </s-text>
                    </s-table-cell>
                    <s-table-cell>
                      <PageRowActions page={page} showPreview={isPage} />
                    </s-table-cell>
                  </s-table-row>
                ))}
              </s-table-body>
            </s-table>
          )}
        </s-stack>
      </s-section>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
