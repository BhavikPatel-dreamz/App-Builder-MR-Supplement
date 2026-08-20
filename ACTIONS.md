# Button Actions

Buttons in blocks (hero, carousel, products-scroller, client-stories, free-consultation, …)
store a structured **action** instead of a plain URL. Each action serializes to
`data-action` JSON your native app / Shopify app reads at runtime.

```json
{
  "action": {
    "actionName": "OPEN_PRODUCT",
    "params": { "productId": "gid://shopify/Product/123", "productHandle": "blue-shoe" }
  }
}
```

## What ships in the package

The package is generic. It ships **only one** built-in action:

| Action | Params |
|--------|--------|
| `OPEN_URL` | `{ url }` |

Everything else — Shopify products/collections, in-app pages, cart, wishlist, etc. —
is **your config**. You add actions via the `actions` prop on `<BlockEditor>`. Nothing
Shopify-specific is baked into `dist`.

## The `actions` prop

```jsx
import { BlockEditor } from 'gutenberg-block-kit/editor';

<BlockEditor
  actions={{
    customActions: [...],   // action definitions to add / override (by name)
    removeActions: [...],   // built-in names to drop, e.g. ['OPEN_URL']
    fetchPages,             // () => Promise<{ id, title }[]>  — for page-select fields
    pickProduct,            // () => Promise<{ productId, productHandle, productTitle? }>
    pickCollection,         // () => Promise<{ collectionId, collectionHandle, collectionTitle? }>
  }}
  onSave={...}
  onLoad={...}
/>
```

- **Merge by name.** A `customActions` entry whose `name` matches a built-in **overrides** it
  (keeps position); a new `name` is **appended** to the dropdown.
- **Remove by name.** `removeActions: ['OPEN_URL']` drops it. (You can replace it entirely by
  also passing your own `OPEN_URL` in `customActions`.)

## Action definition shape

```js
{
  name: 'COPY_TO_CLIPBOARD',        // unique; persisted as `actionName`
  label: 'Copy To Clipboard',       // dropdown label
  fields: [                         // editable inputs (omit for paramless actions)
    { key: 'text',  label: 'Text',  type: 'textarea', required: true },
    { key: 'title', label: 'Title', type: 'text',     required: true },
  ],
  defaultParams: { text: 'Hi!', title: 'Copy' },   // applied ONLY when the action is selected
  editorOnlyKeys: ['pageParamsRaw'],               // param keys never persisted
  normalizeParams: (params) => ({ ... }),          // editor params  -> persisted params
  denormalizeParams: (params) => ({ ... }),        // persisted params -> editor params
  validateParams: (params) => ['error', ...],      // extra validation messages
  previewHref: (params) => '/path',                // web-preview href (native app uses data-action)
}
```

### Field types

| `type` | Renders | Notes |
|--------|---------|-------|
| `text` | text input | `readOnly: true` for display-only |
| `url` | url input | |
| `textarea` | multiline | |
| `page-select` | searchable CMS-page combobox | needs `fetchPages`; typing an unlisted value uses it as the `pageId` |
| `page-params` | text input | pair with `normalizeParams` to store an object |
| `product-picker` | "Select Product" button | calls `pickProduct` from the `actions` prop |
| `collection-picker` | "Select Collection" button | calls `pickCollection` |

### Field options

`{ key, label, type, required, readOnly, help }`

## Lifecycle (how params flow)

```
selected type ──defaultParams──▶ editor form
editor form ──normalizeParams──▶ stripped to schema fields ──▶ persisted JSON
persisted JSON ──denormalizeParams──▶ editor form (round-trip)
```

- **`defaultParams` apply only on type-select**, never on re-render. Clearing a field stays cleared.
- **Persisted JSON keeps only schema-field keys** (minus `editorOnlyKeys`). Custom hooks let you
  reshape (e.g. a comma string → an object).
- At **render/SSR** the registry is not available; unknown actions **pass their params through
  untouched**, so saved data is never lost.

## Full Shopify example

```js
// shopifyActions.js
import { parsePageParams, pageParamsToRaw } from 'gutenberg-block-kit/editor';

export const shopifyActions = [
  {
    name: 'COPY_TO_CLIPBOARD',
    label: 'Copy To Clipboard',
    fields: [
      { key: 'text',  label: 'Text',  type: 'textarea', required: true },
      { key: 'title', label: 'Title', type: 'text',     required: true },
    ],
    defaultParams: { text: 'Check out this site!', title: 'Copy to clipboard' },
  },
  {
    name: 'OPEN_PRODUCT',
    label: 'Open Product',
    fields: [
      { key: 'productId',     label: 'Product',        type: 'product-picker', required: true },
      { key: 'productHandle', label: 'Product Handle', type: 'text', readOnly: true },
    ],
    previewHref: (p) => (p.productHandle ? `/products/${p.productHandle}` : '#'),
  },
  {
    name: 'OPEN_COLLECTION',
    label: 'Open Collection',
    fields: [
      { key: 'collectionId',     label: 'Collection',        type: 'collection-picker', required: true },
      { key: 'collectionHandle', label: 'Collection Handle', type: 'text', readOnly: true },
    ],
    previewHref: (p) => (p.collectionHandle ? `/collections/${p.collectionHandle}` : '#'),
  },
  {
    name: 'OPEN_INAPP_PAGE',
    label: 'Open In-App Page',
    fields: [
      { key: 'pageId',        label: 'Page',        type: 'page-select', required: true },
      { key: 'pageParamsRaw', label: 'Page Params', type: 'page-params',
        help: 'Comma-separated key=value, e.g. abc=123,xyz=456' },
    ],
    editorOnlyKeys: ['pageParamsRaw'],
    // editor string -> persisted object
    normalizeParams: (p) => {
      const out = {};
      const id = (p.pageId || '').trim();
      if (id) out.pageId = id;
      const pp = (p.pageParams && Object.keys(p.pageParams).length)
        ? p.pageParams
        : parsePageParams(p.pageParamsRaw || '');
      if (Object.keys(pp).length) out.pageParams = pp;
      return out;
    },
    // persisted object -> editor string
    denormalizeParams: (p) => ({ pageParamsRaw: pageParamsToRaw(p.pageParams) }),
  },
  // paramless actions
  { name: 'OPEN_CART_PAGE',     label: 'Open Cart Page',     previewHref: () => '/cart' },
  { name: 'OPEN_WISHLIST_PAGE', label: 'Open Wishlist Page', previewHref: () => '/wishlist' },
  { name: 'OPEN_SEARCH_PAGE',   label: 'Open Search Page',   previewHref: () => '/search' },
  { name: 'OPEN_HOME',          label: 'Open Home',          previewHref: () => '/' },
  { name: 'OPEN_LOGIN_PAGE',    label: 'Open Login Page',    previewHref: () => '/account/login' },
  { name: 'OPEN_MY_ACCOUNT',    label: 'Open My Account',    previewHref: () => '/account' },
  { name: 'OPEN_ORDERS',        label: 'Open Orders',        previewHref: () => '/account/orders' },
  { name: 'OPEN_TODAYS_MEDITATION', label: "Open Today's Meditation" },
  { name: 'LOGOUT',             label: 'Logout' },
  { name: 'GO_BACK',            label: 'Go Back' },
];
```

Wire it in:

```jsx
// editor mount
import { BlockEditor } from 'gutenberg-block-kit/editor';
import { shopifyActions } from './shopifyActions.js';
import { fetchShopifyPages, openProductPicker, openCollectionPicker } from './shopify.js';

<BlockEditor
  actions={{
    customActions: shopifyActions,
    fetchPages: fetchShopifyPages,        // () => [{ id, title }]
    pickProduct: openProductPicker,       // () => { productId, productHandle, productTitle }
    pickCollection: openCollectionPicker, // () => { collectionId, collectionHandle, collectionTitle }
  }}
  onSave={...}
  onLoad={...}
/>
```

> Working reference: `examples/demo/actionsConfig.js` + `examples/demo/main.jsx`.

## Programmatic helpers

Exported from `gutenberg-block-kit/editor` (and `gutenberg-block-kit/actions`):

| Export | Use |
|--------|-----|
| `createActionRegistry({ customActions, removeActions })` | Build a registry object outside the editor |
| `BUILTIN_ACTIONS` / `DEFAULT_REGISTRY` | The shipped `OPEN_URL`-only set |
| `normalizeAction(action, registry?)` | Strip to persisted params |
| `denormalizeAction(action, registry?)` | Add editor-only fields back |
| `validateAction(action, registry?)` | `{ valid, errors }` |
| `getActionPreviewHref(action, registry?)` | Web-preview href |
| `getDefaultActionForType(name, registry?)` | Default action for a type |
| `parsePageParams` / `pageParamsToRaw` | `"a=1,b=2"` ⇄ `{ a:1, b:2 }` |
| `resolveButtonAction` / `resolveItemButtonAction` | Read a button action off block attributes (render-safe) |

`registry` is optional — omit it and the built-in-only `DEFAULT_REGISTRY` is used (render/SSR safe).

## Reading actions at runtime (native / storefront)

The package only stores intent. Your app reads `data-action` on each rendered link and routes it:

```js
document.querySelectorAll('[data-action]').forEach((el) => {
  el.addEventListener('click', (e) => {
    e.preventDefault();
    const { actionName, params } = JSON.parse(el.dataset.action);
    switch (actionName) {
      case 'OPEN_PRODUCT':  return openProduct(params.productHandle);
      case 'OPEN_INAPP_PAGE': return openPage(params.pageId, params.pageParams);
      case 'OPEN_URL':      return (window.location.href = params.url);
      // …your handlers
    }
  });
});
```
