# Agent prompt — add host-defined React blocks + unregister to `gutenberg-block-kit`

> Paste this whole file as the task for an agent running **inside the
> `gutenberg-block-kit` package repo** (not the Shopify app). It implements a
> public way for consumers to register their own real `.jsx` blocks and to
> remove bundled blocks.

---

## Role & repo

You are working in the **`gutenberg-block-kit`** npm package source (the repo
that builds `dist/App-*.mjs`, `dist/editor.mjs`, `dist/editor-client.mjs`,
`dist/vite.mjs`, etc.). Do not touch any consuming app.

## Problem (root cause — read first)

The editor bundle **bundles its own copy of `@wordpress/*`** (`@wordpress/blocks`,
`@wordpress/block-editor`, `@wordpress/components`, `@wordpress/element`,
`@wordpress/data`, `@wordpress/icons`). So when a consumer app writes a normal
block file:

```jsx
import { registerBlockType } from '@wordpress/blocks';
registerBlockType('myapp/carousel', { /* ... */ });
```

…that `registerBlockType` resolves to the **consumer's own** `@wordpress/blocks`
instance, which has a **different block registry** than the one the editor reads
from. The block never appears in the editor. There is also no exposed
`window.wp`, and `unregisterBlockType` is not even included in the bundle, so
bundled blocks cannot be removed.

Today the only public registration path is JSON blocks via the `blockRegistry` /
`customBlocksConfig` props (`registerJSONBlock`), which cannot express
InnerBlocks, media pickers, RichText, or custom `edit`/`save` — i.e. it cannot
express real blocks like the carousel example below.

## Goal

A consumer must be able to author a block **exactly the way the kit authors its
own `src/blocks/*`** — a normal `.jsx` using `@wordpress/*` APIs and
`registerBlockType` — then `import` it once and have it auto-register into the
**editor's** registry. Plus a one-switch way to remove bundled blocks.

The whole feature reduces to one thing: **make the editor's `@wordpress/*` a
singleton that consumer block code shares.** Everything below serves that.

## Tasks

### 1. Expose the kit's `@wordpress` runtime as a shared singleton

Create a new entry that re-exports the **same** `@wordpress` modules the editor
bundle uses:

```js
// src/wp.js
export * as blocks      from '@wordpress/blocks';
export * as blockEditor from '@wordpress/block-editor';
export * as components  from '@wordpress/components';
export * as element     from '@wordpress/element';
export * as data        from '@wordpress/data';
export * as icons       from '@wordpress/icons';
```

Also provide per-package subpath entries so consumers can do tree-shaken named
imports:

```
gutenberg-block-kit/wp                 -> namespace bundle above
gutenberg-block-kit/wp/blocks          -> export * from '@wordpress/blocks'
gutenberg-block-kit/wp/block-editor    -> export * from '@wordpress/block-editor'
gutenberg-block-kit/wp/components      -> export * from '@wordpress/components'
gutenberg-block-kit/wp/element         -> export * from '@wordpress/element'
gutenberg-block-kit/wp/data            -> export * from '@wordpress/data'
gutenberg-block-kit/wp/icons           -> export * from '@wordpress/icons'
```

Wire all of these into `package.json#exports` (both `import` and `require`).

**Build requirement — CRITICAL.** Configure the bundler so `@wordpress/*` is a
**single shared chunk** imported by BOTH `App-*.mjs` and the new `wp` entries.
If the `wp` entry bundles its own second copy of `@wordpress`, you have two
registries again and the feature silently fails. The acceptance test below must
prove a single shared registry.

> Fallback design if the shared-chunk build is impractical: at editor load,
> assign `window.wp = { blocks, blockEditor, components, element, data, icons }`
> (the classic WordPress global). Consumers then read `window.wp.blocks` etc.
> Still implement Task 3 to fix load order.

### 2. Export the shared internal helpers consumer blocks need

The carousel example imports kit-internal helpers
(`ActionBuilder`, `ActionLink`, `DEFAULT_BUTTON_ACTION`,
`resolveItemButtonAction` from `src/actions/index.js`). Expose them publicly:

```
gutenberg-block-kit/actions -> dist/actions.{mjs,cjs}
```

Audit `src/blocks/*` for any other shared helpers a consumer block would import
and export those too.

### 3. Guarantee registration runs at the right time

Import-time registration only works if it happens AFTER the editor's
`@wordpress` registry is initialized and BEFORE `<BlockEditor>` renders. Provide
a hook so consumers don't have to guess ordering:

```js
// exported from gutenberg-block-kit/editor
export function registerBlocks(register) {
  // queue; run after initBlocks(), before first render, passing the wp runtime
  pendingRegistrars.push(register);
}
// internally, once, after core/bundled init:
//   pendingRegistrars.forEach((fn) => fn(wpRuntime));
```

Support BOTH paths:
- **Side-effect import** (works once Task 1 makes the singleton real):
  `import './blocks'` registers via top-level `registerBlockType`.
- **Callback** (load-order safe regardless): `registerBlocks((wp) => { ... })`.

### 4. Include `unregisterBlockType` and add removal options

`unregisterBlockType` is currently absent from the bundle — include it (export
it via `gutenberg-block-kit/wp/blocks`). Add `BlockEditor` props:

```ts
disableBundledBlocks?: boolean   // skip registering the kit's own myapp/* demos entirely
unregisterBlocks?: string[]      // e.g. ["myapp/carousel", "myapp/cta-block"] — unregister after init
```

Keep `editorSettings.allowedBlockTypes` working as the inserter-level allowlist.
`disableBundledBlocks` is the "install the package, then remove the defaults in
one line" switch.

## Target consumer DX (the API you are building toward)

A consumer block file — note it is **identical** in style to your own
`src/blocks/carousel/index.jsx`, only the import specifiers change from
`@wordpress/*` to `gutenberg-block-kit/wp/*`:

```jsx
// consumer-app/blocks/carousel/index.jsx
import { registerBlockType } from 'gutenberg-block-kit/wp/blocks';
import {
  useBlockProps, RichText, InspectorControls,
  PanelColorSettings, MediaUpload, MediaUploadCheck,
} from 'gutenberg-block-kit/wp/block-editor';
import {
  PanelBody, RangeControl, ToggleControl, Button, TextControl,
} from 'gutenberg-block-kit/wp/components';
import { useState } from 'gutenberg-block-kit/wp/element';
import { plus, trash } from 'gutenberg-block-kit/wp/icons';
import {
  ActionBuilder, ActionLink, DEFAULT_BUTTON_ACTION, resolveItemButtonAction,
} from 'gutenberg-block-kit/actions';

registerBlockType('myapp/carousel', { /* full edit/save, exactly as kit-internal */ });
```

```js
// consumer-app/blocks/index.js  — barrel; importing it registers everything
import './carousel/index.jsx';
import './pricing/index.jsx';
```

```jsx
// consumer-app editor mount
import 'gutenberg-block-kit/styles';
import { ClientBlockEditor } from 'gutenberg-block-kit/editor-client';
import './blocks'; // side-effect registration

<ClientBlockEditor disableBundledBlocks onSave={onSave} onLoad={onLoad} />;
```

## Acceptance checklist

- [ ] A consumer `.jsx` block importing `gutenberg-block-kit/wp/*` registers into
      the **editor's** registry — it appears in the inserter, edits, and saves.
- [ ] Plain `import './blocks'` (no callback) registers host blocks — proves the
      `@wordpress` singleton is real.
- [ ] `registerBlocks((wp) => …)` callback path also works (load-order safe).
- [ ] `disableBundledBlocks` removes every `myapp/*` block, keeps consumer blocks.
- [ ] `unregisterBlocks(['myapp/carousel'])` removes exactly that one.
- [ ] `gutenberg-block-kit/actions` and `gutenberg-block-kit/wp[/*]` are importable
      and listed in `package.json#exports`.
- [ ] Exactly **one** `@wordpress/blocks` instance ends up in a consumer's final
      bundle. Add a test/assertion that the registry reached via `./wp/blocks` is
      the same one the editor renders from (e.g. register a sentinel block via
      `./wp/blocks` and assert `getBlockType('test/sentinel')` resolves inside the
      editor).
- [ ] README documents the new flow (author block → import → it registers;
      `disableBundledBlocks` / `unregisterBlocks`).

## Constraints

- Don't break existing public API: `blockRegistry`, `customBlocksConfig`,
  `initBlocks`, `editorSettings`, `media`, `onSave/onLoad/onClear`,
  `ClientBlockEditor`, `BlockRenderer`.
- Keep SSR safety (the editor must still load only on the client).
- Bump a minor version; add a CHANGELOG entry.

## Reference — a real consumer block this must support

The kit must be able to register this consumer-authored carousel verbatim (only
the import specifiers swapped to `gutenberg-block-kit/wp/*` +
`gutenberg-block-kit/actions`). It uses `useState`, `RichText`,
`MediaUpload`/`MediaUploadCheck`, `InspectorControls`, `PanelBody`,
`PanelColorSettings`, `RangeControl`, `ToggleControl`, `Button`, `TextControl`,
`plus`/`trash` icons, a repeatable `slides` array attribute, and the kit's
`ActionBuilder`/`ActionLink` helpers — i.e. the full surface a real block needs
and the JSON factory cannot provide.

```jsx
import { useState } from '@wordpress/element';
import { registerBlockType } from '@wordpress/blocks';
import {
  useBlockProps, RichText, InspectorControls,
  PanelColorSettings, MediaUpload, MediaUploadCheck,
} from '@wordpress/block-editor';
import {
  PanelBody, RangeControl, ToggleControl, Button, TextControl,
} from '@wordpress/components';
import { plus, trash } from '@wordpress/icons';
import {
  ActionBuilder, ActionLink, DEFAULT_BUTTON_ACTION, resolveItemButtonAction,
} from '../../actions/index.js';

// ...CarouselBlockIcon, defaultSlide, CarouselSlideContent, SlideFields...

registerBlockType('myapp/carousel', {
  title: 'Carousel',
  description: 'Image carousel with title, subtitle and button slides',
  category: 'myapp-blocks',
  icon: CarouselBlockIcon,
  attributes: {
    slides:        { type: 'array',   default: [/* defaultSlide(), defaultSlide() */] },
    showArrows:    { type: 'boolean', default: true },
    showDots:      { type: 'boolean', default: true },
    slideHeight:   { type: 'number',  default: 500 },
    overlayColor:  { type: 'string',  default: '#000000' },
    overlayOpacity:{ type: 'number',  default: 35 },
    textColor:     { type: 'string',  default: '#ffffff' },
    buttonColor:   { type: 'string',  default: '#3858e9' },
    textAlign:     { type: 'string',  default: 'center' },
    titleSize:     { type: 'number',  default: 42 },
    subtitleSize:  { type: 'number',  default: 18 },
  },
  edit:  ({ attributes, setAttributes }) => { /* InspectorControls + live canvas, useState for currentIndex */ },
  save:  ({ attributes }) => { /* serialized track/slides/arrows/dots markup */ },
});
```

> The complete `edit`/`save` body is in the consumer's hands; the kit only needs
> to (a) hand it the same `@wordpress` runtime and (b) register it at the right
> time. The full version of this file lives in the consuming Shopify app.
