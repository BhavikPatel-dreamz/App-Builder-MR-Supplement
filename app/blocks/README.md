# Riyasat blocks — build recipe

Spec for adding a Gutenberg block to this app. Give the agent a block spec +
sample JSON in the format at the bottom; it produces the files mechanically by
following this recipe. No re-derivation needed.

## How it works (don't re-investigate)

- The app uses `gutenberg-block-kit` (≥1.1.0). It ships `@wordpress/*` as a
  **singleton** under `gutenberg-block-kit/wp/*`, so `registerBlockType()` in
  our block files hits the **editor's** registry. Never import `@wordpress/*`
  directly — always `gutenberg-block-kit/wp/*`.
- Blocks register via the kit's `registerBlocks(cb)` hook (timing-safe). The
  barrel `app/blocks/index.ts` calls each block's `register<Name>()` inside one
  `registerBlocks` callback, then unregisters every non-riyasat block (kills WP
  core) and adds the "Riyasat Blocks" category.
- `CmsEditorShell.tsx` mounts `<ClientBlockEditor>` with `disableBundledBlocks`
  + `editorSettings={{ allowedBlockTypes: RIYASAT_BLOCKS }}`, and client-only
  `import("../../blocks")` inside `useEffect`.

## SSR rule (critical)

Block files import the `@wordpress` runtime (emotion → `document`). They must be
**client-only**. NEVER static-import a block module or the barrel from SSR code.
- `constants.ts` = plain strings only → safe to import anywhere.
- `app/blocks/index.ts` + every `<name>/index.jsx` = loaded only via the
  client-only `import("../../blocks")` in `CmsEditorShell`'s effect.

## Conventions

- Block name: `core/<kebab>` (matches the saved-JSON / mobile contract).
- Parent/child (when JSON has `innerBlocks`): `core/<x>` + `core/<x>-item`.
  Child has `parent: ['core/<x>']`, registers **first**.
- `category: 'riyasat-blocks'` (use `RIYASAT_CATEGORY`).
- `apiVersion: 3`, `supports: { html: false }` (+ `align: ['wide','full']` on
  parents/standalone; `reusable: false` on children).
- Object attributes (`action`, `media`, `collection`) default `{}`.
- `// @ts-nocheck` at top of every `.jsx` block file.
- `save()` carries data the storefront/mobile needs as `data-*` JSON +
  `riyasat-<name>*` classes. Editor previews may use inline styles. No storefront
  CSS is written here unless asked.

## Control → component map

| Spec control | Import from `gutenberg-block-kit/wp/...` | Usage |
| --- | --- | --- |
| text | `components` → `TextControl` | `value`/`onChange` |
| text area | `components` → `TextareaControl` | `rows={N}` |
| toggle | `components` → `ToggleControl` | `checked`/`onChange` |
| color picker | `block-editor` → `PanelColorSettings` | `colorSettings={[{label,value,onChange}]}`, default `#f5f5f5` |
| image picker | `block-editor` → `MediaUpload`+`MediaUploadCheck` | `allowedTypes={['image']}`, store `media.url` |
| image/video picker | same, `allowedTypes={['image','video']}` | store `{ url: m.url, type: m.mime }` |
| action | `gutenberg-block-kit/actions` → `ActionBuilder` | `value={action}` `onChange={(n)=>setAttributes({action:n})}`, default `{}`, all action types kept |
| collection (Shopify) | App Bridge `window.shopify.resourcePicker` | `{type:'collection',multiple:false}` → `{collectionId:id, handle, title}` |
| inner items | `block-editor` → `InnerBlocks` | parent: `allowedBlocks`/`template`/`renderAppender={InnerBlocks.ButtonBlockAppender}`; horizontal rows add `orientation="horizontal"`; save: `<InnerBlocks.Content/>` |
| slide count (for pagination dots) | `wp/data` → `useSelect` + `wp/element` → `useState/useEffect` | `useSelect(s=>s('core/block-editor').getBlockCount(clientId),[clientId])` |

## The 3 steps to add a block

1. **`constants.ts`** — add `const <NAME>_BLOCK = "core/<kebab>";` (+ `_ITEM` if
   parent/child) and append to `RIYASAT_BLOCKS`.
2. **`app/blocks/<kebab>/index.jsx`** — write the block(s); export
   `register<Name>()`. (Parent/child: child first inside that fn.)
3. **`app/blocks/index.ts`** — `import { register<Name> } from "./<kebab>"` and
   call `register<Name>()` in the `registerBlocks` callback (before the
   unregister sweep).

Then verify:
```
npx tsc --noEmit -p tsconfig.json     # only pre-existing cms.server.ts error allowed
npx react-router build                 # must exit 0
grep -rl "wp-runtime" build/server/   # must print nothing (SSR clean)
```

## Templates

### Single block (no innerBlocks)

```jsx
// @ts-nocheck
import { registerBlockType } from 'gutenberg-block-kit/wp/blocks';
import { useBlockProps, InspectorControls, PanelColorSettings,
  MediaUpload, MediaUploadCheck } from 'gutenberg-block-kit/wp/block-editor';
import { PanelBody, TextControl, TextareaControl, Button } from 'gutenberg-block-kit/wp/components';
import { ActionBuilder } from 'gutenberg-block-kit/actions';
import { FOO_BLOCK, RIYASAT_CATEGORY } from '../constants';

export function registerFoo() {
  registerBlockType(FOO_BLOCK, {
    apiVersion: 3,
    title: 'Foo',
    category: RIYASAT_CATEGORY,
    icon: 'star-filled',
    supports: { html: false, align: ['wide', 'full'] },
    attributes: {
      title: { type: 'string', default: '' },
      backgroundColor: { type: 'string', default: '#f5f5f5' },
      action: { type: 'object', default: {} },
    },
    edit: ({ attributes, setAttributes }) => {
      const { title, backgroundColor, action } = attributes;
      const blockProps = useBlockProps({ className: 'riyasat-foo-editor' });
      return (
        <>
          <InspectorControls>
            <PanelBody title="Content" initialOpen>
              <TextControl label="Title" value={title}
                onChange={(v) => setAttributes({ title: v })} />
              <ActionBuilder label="Action" value={action}
                onChange={(n) => setAttributes({ action: n })} />
            </PanelBody>
            <PanelColorSettings title="Colors" colorSettings={[{
              label: 'Background color', value: backgroundColor,
              onChange: (v) => setAttributes({ backgroundColor: v || '#f5f5f5' }),
            }]} />
          </InspectorControls>
          <div {...blockProps} style={{ background: backgroundColor }}>{title}</div>
        </>
      );
    },
    save: ({ attributes }) => {
      const { title, backgroundColor, action } = attributes;
      const blockProps = useBlockProps.save({
        className: 'riyasat-foo',
        'data-action': JSON.stringify(action ?? {}),
        'data-background-color': backgroundColor,
        style: { background: backgroundColor },
      });
      return <div {...blockProps}>{title ? <h3 className="riyasat-foo__title">{title}</h3> : null}</div>;
    },
  });
}
```

### Parent + child (innerBlocks)

```jsx
// @ts-nocheck
import { registerBlockType } from 'gutenberg-block-kit/wp/blocks';
import { useBlockProps, InnerBlocks, InspectorControls,
  MediaUpload, MediaUploadCheck } from 'gutenberg-block-kit/wp/block-editor';
import { PanelBody, TextControl, Button } from 'gutenberg-block-kit/wp/components';
import { ActionBuilder } from 'gutenberg-block-kit/actions';
import { FOO_BLOCK, FOO_ITEM_BLOCK, RIYASAT_CATEGORY } from '../constants';

function registerFooItem() {
  registerBlockType(FOO_ITEM_BLOCK, {
    apiVersion: 3, title: 'Foo Item', category: RIYASAT_CATEGORY,
    parent: [FOO_BLOCK], icon: 'format-image',
    supports: { html: false, reusable: false },
    attributes: {
      imageUrl: { type: 'string', default: '' },
      label: { type: 'string', default: '' },
      action: { type: 'object', default: {} },
    },
    edit: ({ attributes, setAttributes }) => { /* MediaUpload + TextControl + ActionBuilder */ },
    save: ({ attributes }) => {
      const { imageUrl, label, action } = attributes;
      const blockProps = useBlockProps.save({
        className: 'riyasat-foo__item', 'data-action': JSON.stringify(action ?? {}),
      });
      return <div {...blockProps}>{imageUrl ? <img src={imageUrl} alt="" /> : null}{label ? <span>{label}</span> : null}</div>;
    },
  });
}

function registerFooParent() {
  registerBlockType(FOO_BLOCK, {
    apiVersion: 3, title: 'Foo', category: RIYASAT_CATEGORY,
    icon: 'screenoptions', supports: { html: false, align: ['wide', 'full'] },
    attributes: { showPagination: { type: 'boolean', default: true } },
    edit: ({ attributes, setAttributes }) => (
      <>
        <InspectorControls>{/* PanelBody + controls */}</InspectorControls>
        <div {...useBlockProps({ className: 'riyasat-foo-editor' })}>
          <InnerBlocks allowedBlocks={[FOO_ITEM_BLOCK]}
            template={[[FOO_ITEM_BLOCK, {}], [FOO_ITEM_BLOCK, {}]]}
            templateLock={false} renderAppender={InnerBlocks.ButtonBlockAppender} />
        </div>
      </>
    ),
    save: ({ attributes }) => (
      <div {...useBlockProps.save({ className: 'riyasat-foo' })}><InnerBlocks.Content /></div>
    ),
  });
}

export function registerFoo() { registerFooItem(); registerFooParent(); }
```

## Input format for next time

Paste per block:
```
Block name: <Human title>
#core/<name>
- <attr>(<control type>)
...
#core/<name>-item            (only if it has children)
- <attr>(<control type>)
...
<sample saved JSON>
```
The agent maps each control via the table, follows the 3 steps + the matching
template, then runs the verify commands. Existing blocks for reference:
`carousel/`, `trust-badges/`, `image-slider/`, `product-scroller/`,
`free-consultation/`, `editors-pick/`.
```
