// App Bridge v4 — exposed on window in embedded admin. Loose by design.
interface Window {
  shopify?: {
    resourcePicker?: (options: {
      type: "product" | "collection" | "variant";
      multiple?: boolean;
    }) => Promise<
      Array<{ id: string; handle?: string; title?: string }> | undefined
    >;
    [key: string]: any;
  };
}

declare module "*.css";
declare module "*.css?url" {
  const href: string;
  export default href;
}

declare module "gutenberg-block-kit/editor" {
  import type { ComponentType } from "react";

  export const BlockEditor: ComponentType<Record<string, unknown>>;
  // Queue a registrar run after the editor's registry init, before first
  // render. The arg is the kit's shared wp runtime ({ blocks, blockEditor, … }).
  export function registerBlocks(
    registrar: (wp: Record<string, any>) => void,
  ): void;
  export function unregisterBlockType(name: string): unknown;
  export function getWpRuntime(): Record<string, any>;
  export function exposeWpOnWindow(): void;
}

// Shared @wordpress runtime exposed by the kit (same singleton the editor uses,
// so host registerBlockType() hits the editor's registry). Typed loose on
// purpose — these are the real @wordpress APIs.
declare module "gutenberg-block-kit/wp";
declare module "gutenberg-block-kit/wp/blocks";
declare module "gutenberg-block-kit/wp/block-editor";
declare module "gutenberg-block-kit/wp/components";
declare module "gutenberg-block-kit/wp/element";
declare module "gutenberg-block-kit/wp/data";
declare module "gutenberg-block-kit/wp/icons";
declare module "gutenberg-block-kit/actions";
declare module "gutenberg-block-kit/actions-kit";

declare module "gutenberg-block-kit/editor-client" {
  import type { ComponentType, ReactNode } from "react";

  export const ClientBlockEditor: ComponentType<
    Record<string, unknown> & { fallback?: ReactNode }
  >;
  export default ClientBlockEditor;
}

declare module "gutenberg-block-kit/renderer" {
  import type { ComponentType } from "react";

  export const BlockRenderer: ComponentType<{
    html?: string;
    className?: string;
    id?: string;
    as?: string;
  }>;
}

declare module "gutenberg-block-kit/styles";

declare module "gutenberg-block-kit/vite" {
  import type { Plugin } from "vite";

  export function gutenbergBlockKitVite(...args: unknown[]): Plugin | Plugin[];
}

declare module "@wordpress/blocks";
declare module "@wordpress/block-editor";
declare module "@wordpress/components";
declare module "@wordpress/data";
declare module "@wordpress/element";
