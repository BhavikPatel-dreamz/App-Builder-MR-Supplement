import db from "../db.server";

export type PageStatus = "draft" | "published";
export type PageType = "page" | "header" | "footer";
export type RenderingType = "normal" | "scrollView" | "flatList";

/** A single Gutenberg block as produced by gutenberg-block-kit. */
export type Block = {
  name: string;
  clientId?: string;
  attributes?: Record<string, unknown>;
  innerBlocks?: Block[];
};

type PageRow = {
  id: string;
  title: string;
  slug: string;
  html: string;
  json: string;
  status: string;
  type: string;
  hideHeader: boolean;
  showPageTitle: boolean;
  backgroundColor: string;
  renderingType: string;
  headerId: string | null;
  footerId: string | null;
  stickyHeaderId: string | null;
  stickyFooterId: string | null;
  stickyHeader: string;
  stickyFooter: string;
  description: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  ogImage: string | null;
  keywords: string | null;
  updatedAt: Date;
};

export type PageRecord = {
  id: string;
  title: string;
  slug: string;
  html: string;
  json: string;
  status: PageStatus;
  type: PageType;
  hideHeader: boolean;
  showPageTitle: boolean;
  backgroundColor: string;
  renderingType: RenderingType;
  headerId: string;
  footerId: string;
  stickyHeaderId: string;
  stickyFooterId: string;
  stickyHeader: string;
  stickyFooter: string;
  description: string;
  seoTitle: string;
  seoDescription: string;
  ogImage: string;
  keywords: string;
  updatedAt: string;
};

/**
 * Clean JSON shape consumed by the mobile app via the signed App Proxy.
 * Exposes parsed block trees (not raw HTML) plus the layout settings and the
 * resolved reusable header/footer records.
 */
export type PublicPageRecord = {
  pageId: string;
  title: string;
  slug: string;
  hideHeader: boolean;
  showPageTitle: boolean;
  backgroundColor: string;
  renderingType: RenderingType;
  header: PublicPageComponent | Record<string, never>;
  footer: PublicPageComponent | Record<string, never>;
  blocks: Block[];
  stickyHeader: Block[];
  stickyFooter: Block[];
  description: string;
  seo: {
    title: string;
    description: string;
    ogImage: string;
    keywords: string[];
  };
  updatedAt: string;
};

/** Lightweight public list item — no block trees, kept small for index screens. */
export type PublicPageListItem = {
  pageId: string;
  title: string;
  slug: string;
  updatedAt: string;
};

export type PublicPageComponent = {
  id: string;
  title: string;
  blocks: Block[];
};

function normalizeRenderingType(value: string): RenderingType {
  return value === "scrollView" || value === "flatList" ? value : "normal";
}

function serializePage(page: PageRow): PageRecord {
  return {
    id: page.id,
    title: page.title,
    slug: page.slug,
    html: page.html,
    json: page.json,
    status: page.status as PageStatus,
    type: (page.type as PageType) ?? "page",
    hideHeader: page.hideHeader,
    showPageTitle: page.showPageTitle,
    backgroundColor: page.backgroundColor || "#ffffff",
    renderingType: normalizeRenderingType(page.renderingType),
    headerId: page.headerId ?? "",
    footerId: page.footerId ?? "",
    stickyHeaderId: page.stickyHeaderId ?? "",
    stickyFooterId: page.stickyFooterId ?? "",
  //  stickyHeader: page.stickyHeader ?? "[]",
  //  stickyFooter: page.stickyFooter ?? "[]",
    description: page.description ?? "",
    seoTitle: page.seoTitle ?? "",
    seoDescription: page.seoDescription ?? "",
    ogImage: page.ogImage ?? "",
    keywords: page.keywords ?? "",
    updatedAt: page.updatedAt.toISOString(),
  };
}

function parseKeywords(value: string | null): string[] {
  if (!value) return [];
  return value
    .split(",")
    .map((keyword) => keyword.trim())
    .filter(Boolean);
}

/**
 * Parse the stored `json` string into a block array. The editor saves
 * `JSON.stringify(blocks)`; we also tolerate a `{ blocks: [...] }` wrapper and
 * malformed/empty values so a bad record never breaks the proxy response.
 */
export function parseBlocks(json: string | null | undefined): Block[] {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json);
    if (Array.isArray(parsed)) return parsed as Block[];
    if (parsed && Array.isArray(parsed.blocks)) return parsed.blocks as Block[];
    return [];
  } catch {
    return [];
  }
}

function buildSeo(page: PageRow) {
  return {
    title: page.seoTitle || page.title,
    description: page.seoDescription || page.description || "",
    ogImage: page.ogImage ?? "",
    keywords: parseKeywords(page.keywords),
  };
}

function serializePublicListItem(page: PageRow): PublicPageListItem {
  return {
    pageId: page.id,
    title: page.title,
    slug: page.slug,
    updatedAt: page.updatedAt.toISOString(),
  };
}

function serializePublicComponent(
  page: Pick<PageRow, "id" | "title" | "json">,
): PublicPageComponent {
  return {
    id: page.id,
    title: page.title,
    blocks: parseBlocks(page.json),
  };
}

export function serializePublicPage(
  page: PageRow,
  options: {
    header?: PublicPageComponent | null;
    footer?: PublicPageComponent | null;
    stickyHeader?: Block[];
    stickyFooter?: Block[];
  } = {},
): PublicPageRecord {
  return {
    pageId: page.id,
    title: page.title,
    slug: page.slug,
    hideHeader: page.hideHeader,
    showPageTitle: page.showPageTitle,
    backgroundColor: page.backgroundColor || "#ffffff",
    renderingType: normalizeRenderingType(page.renderingType),
    header: options.header ?? {},
    footer: options.footer ?? {},
    blocks: parseBlocks(page.json),
    stickyHeader: options.stickyHeader ?? parseBlocks(page.stickyHeader),
    stickyFooter: options.stickyFooter ?? parseBlocks(page.stickyFooter),
    description: page.description ?? "",
    seo: buildSeo(page),
    updatedAt: page.updatedAt.toISOString(),
  };
}

export async function listPages(shop: string, type: PageType = "page") {
  const pages = await db.page.findMany({
    where: { shop, type },
    orderBy: { updatedAt: "desc" },
  });

  return pages.map(serializePage);
}

export async function listPagesWithComponents(shop: string) {
  const [pages, components] = await Promise.all([
    db.page.findMany({
      where: { shop, type: "page" },
      orderBy: { updatedAt: "desc" },
    }),
    db.page.findMany({
      where: { shop, type: { in: ["header", "footer"] } },
      select: { id: true, title: true, type: true },
    }),
  ]);

  const componentNames = new Map(
    components.map((component) => [component.id, component.title]),
  );

  const nameFor = (id: string | null) =>
    id ? componentNames.get(id) || "" : "";

  return pages.map((page) => ({
    ...serializePage(page),
    headerTitle: nameFor(page.headerId),
    footerTitle: nameFor(page.footerId),
    stickyHeaderTitle: nameFor(page.stickyHeaderId),
    stickyFooterTitle: nameFor(page.stickyFooterId),
  }));
}

/**
 * Published pages of a given type — used to populate the header/footer pickers
 * and (for "page") the public list endpoint.
 */
export async function listSelectablePages(shop: string, type: PageType) {
  const pages = await db.page.findMany({
    where: { shop, type },
    orderBy: { updatedAt: "desc" },
    select: { id: true, title: true, slug: true, status: true },
  });

  return pages;
}

/** Published pages only — used by the public mobile API (list endpoint). */
export async function listPublishedPages(shop: string) {
  const pages = await db.page.findMany({
    where: { shop, status: "published", type: "page" },
    orderBy: { updatedAt: "desc" },
  });

  return pages.map(serializePublicListItem);
}

export async function getPageById(shop: string, id: string) {
  const page = await db.page.findFirst({
    where: { id, shop },
  });

  return page ? serializePage(page) : null;
}

export async function getPageBySlug(shop: string, slug: string) {
  const page = await db.page.findFirst({
    where: { shop, slug, status: "published" },
  });

  return page ? serializePage(page) : null;
}

/** Resolve a header/footer-type page by id, or null if unset/missing. */
async function resolveComponent(
  shop: string,
  id: string | null,
  type: "header" | "footer",
): Promise<PublicPageComponent | null> {
  if (!id) return null;
  const component = await db.page.findFirst({
    where: { id, shop, type },
    select: { id: true, title: true, json: true },
  });
  return component ? serializePublicComponent(component) : null;
}

/** Published page by slug as a public JSON record (mobile API single endpoint). */
export async function getPublishedPageBySlug(shop: string, slug: string) {
  const page = await db.page.findFirst({
    where: { shop, slug, status: "published", type: "page" },
  });

  if (!page) return null;

  const [header, footer, stickyHeaderComponent, stickyFooterComponent] =
    await Promise.all([
      resolveComponent(shop, page.headerId, "header"),
      resolveComponent(shop, page.footerId, "footer"),
      resolveComponent(shop, page.stickyHeaderId, "header"),
      resolveComponent(shop, page.stickyFooterId, "footer"),
    ]);

  return serializePublicPage(page, {
    header,
    footer,
    // Prefer the referenced reusable component's blocks; fall back to the
    // legacy inline JSON for pages saved before sticky slots became references.
    stickyHeader: stickyHeaderComponent
      ? stickyHeaderComponent.blocks
      : parseBlocks(page.stickyHeader),
    stickyFooter: stickyFooterComponent
      ? stickyFooterComponent.blocks
      : parseBlocks(page.stickyFooter),
  });
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}

export type PageMetaInput = {
  description?: string;
  seoTitle?: string;
  seoDescription?: string;
  ogImage?: string;
  keywords?: string;
};

/** Layout/settings fields shared by create and update. */
export type PageSettingsInput = {
  type?: PageType;
  hideHeader?: boolean;
  showPageTitle?: boolean;
  backgroundColor?: string;
  renderingType?: RenderingType;
  headerId?: string | null;
  footerId?: string | null;
  stickyHeaderId?: string | null;
  stickyFooterId?: string | null;
  stickyHeader?: string | Block[] | null;
  stickyFooter?: string | Block[] | null;
};

function serializeBlockInput(value: string | Block[] | null | undefined) {
  if (value === undefined) return undefined;
  if (value === null) return "[]";
  return typeof value === "string" ? value : JSON.stringify(value);
}

export async function createPage(
  shop: string,
  data: {
    title: string;
    slug?: string;
    html: string;
    json: string;
    status?: PageStatus;
  } & PageMetaInput &
    PageSettingsInput,
) {
  const slug = slugify(data.slug || data.title) || "page";

  const existing = await db.page.findFirst({
    where: { shop, slug },
  });

  const finalSlug = existing ? `${slug}-${Date.now()}` : slug;

  const page = await db.page.create({
    data: {
      shop,
      title: data.title,
      slug: finalSlug,
      html: data.html,
      json: data.json,
      status: data.status ?? "draft",
      type: data.type ?? "page",
      hideHeader: data.hideHeader ?? false,
      showPageTitle: data.showPageTitle ?? true,
      backgroundColor: data.backgroundColor || "#ffffff",
      renderingType: data.renderingType ?? "normal",
      headerId: data.headerId || null,
      footerId: data.footerId || null,
      stickyHeaderId: data.stickyHeaderId || null,
      stickyFooterId: data.stickyFooterId || null,
      stickyHeader: serializeBlockInput(data.stickyHeader) ?? "[]",
      stickyFooter: serializeBlockInput(data.stickyFooter) ?? "[]",
      description: data.description,
      seoTitle: data.seoTitle,
      seoDescription: data.seoDescription,
      ogImage: data.ogImage,
      keywords: data.keywords,
    },
  });

  return serializePage(page);
}

export async function updatePage(
  shop: string,
  id: string,
  data: {
    title?: string;
    slug?: string;
    html?: string;
    json?: string;
    status?: PageStatus;
  } & PageMetaInput &
    PageSettingsInput,
) {
  const existing = await db.page.findFirst({
    where: { id, shop },
  });

  if (!existing) {
    return null;
  }

  const nextSlug = data.slug ? slugify(data.slug) : undefined;

  if (nextSlug && nextSlug !== existing.slug) {
    const conflict = await db.page.findFirst({
      where: { shop, slug: nextSlug, NOT: { id } },
    });

    if (conflict) {
      throw new Error("A page with this slug already exists.");
    }
  }

  const page = await db.page.update({
    where: { id },
    data: {
      title: data.title,
      slug: nextSlug,
      html: data.html,
      json: data.json,
      status: data.status,
      type: data.type,
      hideHeader: data.hideHeader,
      showPageTitle: data.showPageTitle,
      backgroundColor: data.backgroundColor,
      renderingType: data.renderingType,
      // `headerId`/`footerId` are nullable: "" clears the reference, undefined
      // leaves it untouched.
      headerId:
        data.headerId === undefined ? undefined : data.headerId || null,
      footerId:
        data.footerId === undefined ? undefined : data.footerId || null,
      stickyHeaderId:
        data.stickyHeaderId === undefined
          ? undefined
          : data.stickyHeaderId || null,
      stickyFooterId:
        data.stickyFooterId === undefined
          ? undefined
          : data.stickyFooterId || null,
      stickyHeader: serializeBlockInput(data.stickyHeader),
      stickyFooter: serializeBlockInput(data.stickyFooter),
      description: data.description,
      seoTitle: data.seoTitle,
      seoDescription: data.seoDescription,
      ogImage: data.ogImage,
      keywords: data.keywords,
    },
  });

  return serializePage(page);
}

export async function deletePage(shop: string, id: string) {
  const existing = await db.page.findFirst({
    where: { id, shop },
  });

  if (!existing) {
    return false;
  }

  await db.page.delete({ where: { id } });
  return true;
}

export async function createMediaRecord(
  shop: string,
  data: {
    shopifyFileId?: string;
    url: string;
    alt?: string;
    title?: string;
    mimeType?: string;
  },
) {
  return db.media.create({
    data: {
      shop,
      shopifyFileId: data.shopifyFileId,
      url: data.url,
      alt: data.alt,
      title: data.title,
      mimeType: data.mimeType,
    },
  });
}
