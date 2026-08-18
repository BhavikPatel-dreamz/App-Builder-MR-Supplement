// Action registry config for the CMS block editor.
//
// Passed as <ClientBlockEditor actions={...}> so every riyasat block's
// <ActionBuilder> offers the same set of button actions. The kit ships only
// OPEN_URL; everything Shopify/native-app specific is added here. See ACTIONS.md.
//
// Plain TS (no @wordpress runtime) so it's safe to import during SSR.
//
// NOTE on "default text reappears": the kit's built-in OPEN_URL carries
// defaultParams, and `getDefaultActionForType` re-injects defaults whenever an
// action type is selected. We deliberately omit `defaultParams` on every
// text-entry action below so cleared fields stay cleared.

/** "abc=123,xyz=456" -> { abc: "123", xyz: "456" } */
function parsePageParams(raw: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const pair of (raw || "").split(",")) {
    const i = pair.indexOf("=");
    if (i === -1) continue;
    const key = pair.slice(0, i).trim();
    const value = pair.slice(i + 1).trim();
    if (key) out[key] = value;
  }
  return out;
}

/** { abc: "123", xyz: "456" } -> "abc=123,xyz=456" */
function pageParamsToRaw(params: Record<string, unknown> | undefined): string {
  if (!params) return "";
  return Object.entries(params)
    .map(([k, v]) => `${k}=${v}`)
    .join(",");
}

// () => Promise<{ id, title }[]> for the page-select field. Typing a value the
// dropdown doesn't list uses it verbatim as the pageId (kit behavior), so no
// separate manual-id field is needed for OPEN_INAPP_PAGE.
export async function fetchPages(): Promise<{ id: string; title: string }[]> {
  const response = await fetch("/api/cms/pages");
  if (!response.ok) return [];
  return response.json();
}

// App Bridge v4 resource pickers. Return null when cancelled / unavailable.
export async function pickProduct() {
  const picker =
    typeof window !== "undefined" ? window.shopify?.resourcePicker : null;
  if (!picker) return null;
  const selection = await picker({ type: "product", multiple: false });
  const product = selection?.[0];
  if (!product) return null;
  return {
    productId: product.id,
    productHandle: product.handle,
    productTitle: product.title,
  };
}

export async function pickCollection() {
  const picker =
    typeof window !== "undefined" ? window.shopify?.resourcePicker : null;
  if (!picker) return null;
  const selection = await picker({ type: "collection", multiple: false });
  const collection = selection?.[0];
  if (!collection) return null;
  return {
    collectionId: collection.id,
    collectionHandle: collection.handle,
    collectionTitle: collection.title,
  };
}

type ActionDef = {
  name: string;
  label: string;
  fields?: Array<{
    key: string;
    label: string;
    type: string;
    required?: boolean;
    readOnly?: boolean;
    help?: string;
  }>;
  defaultParams?: Record<string, unknown>;
  editorOnlyKeys?: string[];
  normalizeParams?: (params: Record<string, any>) => Record<string, unknown>;
  denormalizeParams?: (params: Record<string, any>) => Record<string, unknown>;
  previewHref?: (params: Record<string, any>) => string;
};

export const riyasatActions: ActionDef[] = [
  // --- URL / Web ---------------------------------------------------------
  {
    // Override the kit built-in to drop its default url so the field starts
    // empty and a cleared value stays cleared.
    name: "OPEN_URL",
    label: "Open Url",
    fields: [{ key: "url", label: "Web URL", type: "url", required: true }],
    previewHref: (p) => p.url || "#",
  },
  {
    name: "OPEN_WEBVIEW",
    label: "Open Webview",
    fields: [
      { key: "webViewUrl", label: "Webview URL", type: "url", required: true },
      { key: "title", label: "Title", type: "text", required: true },
    ],
    previewHref: (p) => p.webViewUrl || "#",
  },
  {
    name: "OPEN_POPIN",
    label: "Open Popin",
    fields: [
      { key: "webViewUrl", label: "Webview URL", type: "url", required: true },
      { key: "openInModal", label: "Open in modal", type: "boolean" },
    ],
    defaultParams: { openInModal: true },
    normalizeParams: (p) => ({
      webViewUrl: p.webViewUrl,
      openInModal:
        p.openInModal !== false && String(p.openInModal ?? true).toLowerCase() !== "false",
    }),
    previewHref: (p) => p.webViewUrl || "#",
  },

  // --- In-app navigation -------------------------------------------------
  {
    name: "OPEN_INAPP_PAGE",
    label: "Open In-App Page",
    fields: [
      { key: "pageId", label: "Page", type: "page-select", required: true },
      {
        key: "pageParamsRaw",
        label: "Page Params",
        type: "page-params",
        help: "Comma-separated key=value, e.g. abc=123,xyz=456",
      },
    ],
    editorOnlyKeys: ["pageParamsRaw"],
    // editor string -> persisted object
    normalizeParams: (p) => {
      const out: Record<string, unknown> = {};
      const id = (p.pageId || "").trim();
      if (id) out.pageId = id;
      const pp =
        p.pageParams && Object.keys(p.pageParams).length
          ? p.pageParams
          : parsePageParams(p.pageParamsRaw || "");
      if (Object.keys(pp).length) out.pageParams = pp;
      return out;
    },
    // persisted object -> editor string
    denormalizeParams: (p) => ({ pageParamsRaw: pageParamsToRaw(p.pageParams) }),
  },
  {
    name: "OPEN_BOTTOM_TAB",
    label: "Open Bottom Tab",
    // Manual page-id entry (not the CMS dropdown), per spec.
    fields: [{ key: "pageId", label: "Page ID", type: "text", required: true }],
  },

  // --- Messaging ---------------------------------------------------------
  {
    name: "SHOW_MESSAGE",
    label: "Show Message",
    fields: [{ key: "title", label: "Title", type: "text", required: true }],
  },
  {
    name: "COPY_TO_CLIPBOARD",
    label: "Copy To Clipboard",
    fields: [
      { key: "text", label: "Text", type: "textarea", required: true },
      { key: "title", label: "Title", type: "text", required: true },
    ],
  },

  // --- Shopify resources -------------------------------------------------
  {
    name: "OPEN_PRODUCT",
    label: "Open Product",
    // Only the picker is shown; productHandle is fetched from Shopify on pick.
    fields: [
      { key: "productId", label: "Product", type: "product-picker", required: true },
    ],
    // productTitle is editor-only (display label); persist id + handle only.
    editorOnlyKeys: ["productTitle"],
    normalizeParams: (p) => ({
      productId: p.productId,
      productHandle: p.productHandle,
    }),
    previewHref: (p) => (p.productHandle ? `/products/${p.productHandle}` : "#"),
  },
  {
    name: "OPEN_COLLECTION",
    label: "Open Collection",
    fields: [
      { key: "collectionId", label: "Collection", type: "collection-picker", required: true },
    ],
    editorOnlyKeys: ["collectionTitle"],
    normalizeParams: (p) => ({
      collectionId: p.collectionId,
      collectionHandle: p.collectionHandle,
    }),
    previewHref: (p) =>
      p.collectionHandle ? `/collections/${p.collectionHandle}` : "#",
  },

  // --- Paramless navigation ---------------------------------------------
  { name: "OPEN_CART_PAGE", label: "Open Cart Page", previewHref: () => "/cart" },
  { name: "OPEN_WISHLIST_PAGE", label: "Open Wishlist Page", previewHref: () => "/wishlist" },
  { name: "OPEN_SEARCH_PAGE", label: "Open Search Page", previewHref: () => "/search" },
  { name: "OPEN_HOME", label: "Open Home", previewHref: () => "/" },
  { name: "OPEN_LOGIN_PAGE", label: "Open Login Page", previewHref: () => "/account/login" },
  { name: "OPEN_MY_ACCOUNT", label: "Open My Account", previewHref: () => "/account" },
  { name: "OPEN_ORDERS", label: "Open Orders", previewHref: () => "/account/orders" },
  {
    name: "OPEN_TODAYS_MEDITATION",
    label: "Open Today's Meditation",
  },
  { name: "LOGOUT", label: "Logout" },
  { name: "GO_BACK", label: "Go Back" },
];

export const cmsEditorActions = {
  customActions: riyasatActions,
  fetchPages,
  pickProduct,
  pickCollection,
};
