import { useCallback, useEffect, useRef, useState } from "react";
import { ClientBlockEditor } from "gutenberg-block-kit/editor-client";
// constants.ts holds plain strings only — safe to import during SSR. The block
// modules (which pull the @wordpress/emotion runtime) are loaded client-only in
// the effect below.
import { APPBUILDER_BLOCKS } from "../../blocks/constants";
import { directUploadMedia } from "../../lib/upload-client";
import { cmsEditorActions } from "./actionsConfig";
import { CmsPageSwitcher, type CmsPageListItem } from "./CmsPageSwitcher";
import { FaCog, FaSearch } from "react-icons/fa";

type MetaState = {
  slug: string;
  description: string;
  seoTitle: string;
  seoDescription: string;
  ogImage: string;
  keywords: string;
  hideHeader: boolean;
  showPageTitle: boolean;
  backgroundColor: string;
  renderingType: "normal" | "scrollView" | "flatList";
  headerId: string;
  footerId: string;
  stickyHeaderId: string;
  stickyFooterId: string;
};

type SelectableComponent = {
  id: string;
  title: string;
  slug: string;
  status: string;
};

type ContentType = "page" | "header" | "footer";

type CmsEditorShellProps = {
  pageId?: string;
  contentType?: ContentType;
  initialTitle?: string;
  initialContent?: string;
  isNew?: boolean;
  previewSlug?: string;
  onSaved?: (pageId: string) => void;
  initialSlug?: string;
  initialDescription?: string;
  initialSeoTitle?: string;
  initialSeoDescription?: string;
  initialOgImage?: string;
  initialKeywords?: string;
  initialHideHeader?: boolean;
  initialShowPageTitle?: boolean;
  initialBackgroundColor?: string;
  initialRenderingType?: "normal" | "scrollView" | "flatList";
  initialHeaderId?: string;
  initialFooterId?: string;
  initialStickyHeaderId?: string;
  initialStickyFooterId?: string;
  headers?: SelectableComponent[];
  footers?: SelectableComponent[];
  pages?: CmsPageListItem[];
};

function EditorFallback() {
  return (
    <s-page heading="CMS Editor">
      <s-section>
        <s-paragraph>Loading editor…</s-paragraph>
      </s-section>
    </s-page>
  );
}

async function fetchPage(pageId: string) {
  const response = await fetch(`/api/cms/pages/${pageId}`);

  if (!response.ok) {
    return null;
  }

  return response.json();
}

export function CmsEditorShell({
  pageId,
  contentType = "page",
  initialTitle = "Untitled page",
  initialContent,
  isNew = false,
  previewSlug,
  onSaved,
  initialSlug = "",
  initialDescription = "",
  initialSeoTitle = "",
  initialSeoDescription = "",
  initialOgImage = "",
  initialKeywords = "",
  initialHideHeader = false,
  initialShowPageTitle = true,
  initialBackgroundColor = "#ffffff",
  initialRenderingType = "normal",
  initialHeaderId = "",
  initialFooterId = "",
  initialStickyHeaderId = "",
  initialStickyFooterId = "",
  headers = [],
  footers = [],
  pages = [],
}: CmsEditorShellProps) {
  useEffect(() => {
    void import("gutenberg-block-kit/styles").then(() =>
      import("../../styles/cms.css"),
    );
    import("../../blocks/appbuilder/shared-ui.css");
    import("../../blocks/appbuilder/image-carousel.css");
    import("../../blocks/appbuilder/image-slider.css");
    import("../../blocks/appbuilder/product-scroller.css");
    import("../../blocks/appbuilder/categories-scroller.css");
    import("../../blocks/appbuilder/menu-items.css");
    import("../../blocks/appbuilder/selected-products.css");
    import("../../blocks/appbuilder/standard-blocks.css");
    import("../../blocks/appbuilder/advanced-multimedia-scroller.css");
    import("../../blocks/appbuilder/expandalbe-categories.css");
    // Client-only: registers Appbuilder Blocks via the kit's registerBlocks() hook.
    // Imported here (not at module top) so the @wordpress runtime never loads
    // during SSR — registerBlocks queues until the editor's registry inits.
    import("../../blocks");
  }, []);

  useEffect(() => {
    function ensureWidgetListOpen() {
      const root = document.querySelector(".cms-editor-shell");
      if (!root) return;

      const inserterToggle = root.querySelector(
        ".toolbar-inserter-btn",
      ) as HTMLButtonElement | null;

      if (inserterToggle?.getAttribute("data-inserter-open") !== "true") {
        inserterToggle?.click();
      }
    }

    function preventWidgetListClose(event: Event) {
      const target = event.target as Element | null;
      if (!target) return;

      const inserterToggle = target.closest(
        ".cms-editor-shell .toolbar-inserter-btn",
      );
      if (inserterToggle?.getAttribute("data-inserter-open") === "true") {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        return;
      }

      const inserterClose = target.closest(
        ".cms-editor-shell .gbk-inserter-panel .block-editor-inserter-sidebar__header button",
      );
      if (inserterClose) {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
      }
    }

    function handleOutsideClick(event: MouseEvent | TouchEvent) {
      const target = event.target as Node | null;
      if (!target || !(target instanceof Node)) return;

      const hasActiveModal = !!document.querySelector(
        ".components-modal__frame, .components-modal__screen-overlay, .rbb-media-modal, .components-modal, [role='dialog'], s-modal",
      );
      const isInsideModal = (target as Element).closest?.(
        ".components-modal__frame, .components-modal__screen-overlay, .rbb-media-modal, .components-modal, [role='dialog'], s-modal, .components-modal__content, .components-modal__header",
      );
      if (hasActiveModal || isInsideModal) return;

      const popovers = Array.from(
        document.querySelectorAll(
          ".components-popover, .components-dropdown__content, .components-color-picker, .components-popover__content, .components-color-palette__picker, .components-dropdown-menu__menu",
        ),
      ).filter((el) => {
        const style = window.getComputedStyle(el);
        return style.display !== "none" && style.visibility !== "hidden";
      });

      if (popovers.length === 0) return;

      const isInsidePopover = popovers.some((popover) => popover.contains(target));
      if (isInsidePopover) return;

      const isTrigger = (target as Element).closest?.(
        "button, .components-color-palette__item, .components-panel__color-title, [aria-expanded='true'], .components-color-palette__custom-color",
      );
      if (isTrigger && isTrigger.getAttribute("aria-expanded") === "true") {
        return;
      }

      const escapeEvent = new KeyboardEvent("keydown", {
        key: "Escape",
        code: "Escape",
        keyCode: 27,
        which: 27,
        bubbles: true,
        cancelable: true,
      });

      document.dispatchEvent(escapeEvent);
      if (document.activeElement && document.activeElement !== document.body) {
        document.activeElement.dispatchEvent(escapeEvent);
      }
    }

    ensureWidgetListOpen();
    const observer = new MutationObserver(ensureWidgetListOpen);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["data-inserter-open", "class"],
    });
    document.addEventListener("click", preventWidgetListClose, true);
    document.addEventListener("mousedown", handleOutsideClick, true);
    document.addEventListener("touchstart", handleOutsideClick, true);

    return () => {
      observer.disconnect();
      document.removeEventListener("click", preventWidgetListClose, true);
      document.removeEventListener("mousedown", handleOutsideClick, true);
      document.removeEventListener("touchstart", handleOutsideClick, true);
    };
  }, []);

  const [meta, setMeta] = useState<MetaState>({
    slug: initialSlug,
    description: initialDescription,
    seoTitle: initialSeoTitle,
    seoDescription: initialSeoDescription,
    ogImage: initialOgImage,
    keywords: initialKeywords,
    hideHeader: initialHideHeader,
    showPageTitle: initialShowPageTitle,
    backgroundColor: initialBackgroundColor,
    renderingType: initialRenderingType,
    headerId: initialHeaderId,
    footerId: initialFooterId,
    stickyHeaderId: initialStickyHeaderId,
    stickyFooterId: initialStickyFooterId,
  });
  const [uploadingOg, setUploadingOg] = useState(false);
  const [metaError, setMetaError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [pageTitle, setPageTitle] = useState(initialTitle);

  // The custom header buttons live inside the kit's editor chrome, so there's
  // no declarative commandFor activator to wire up — open the modals via their
  // showOverlay() method instead.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pageSettingsModalRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const seoModalRef = useRef<any>(null);

  // The id of the page this editor is bound to. For an existing page it's the
  // prop; for a brand-new page it starts undefined and is filled in once the
  // first save creates the record. Subsequent saves then update that same page
  // (PUT) instead of creating a fresh one (POST) on every Save click.
  const [currentPageId, setCurrentPageId] = useState<string | undefined>(
    pageId,
  );

  // onSave is captured by the editor at mount; read live meta via a ref so the
  // latest field values are included no matter when the user clicks Save. The
  // page id is read the same way so the first-save id is seen by later saves.
  const metaRef = useRef(meta);
  useEffect(() => {
    metaRef.current = meta;
  }, [meta]);

  const currentPageIdRef = useRef(currentPageId);
  useEffect(() => {
    currentPageIdRef.current = currentPageId;
  }, [currentPageId]);

  const pageTitleRef = useRef(pageTitle);
  useEffect(() => {
    pageTitleRef.current = pageTitle;
  }, [pageTitle]);

  // Route param changed (page switcher) — keep shell state aligned with the loader.
  useEffect(() => {
    setCurrentPageId(pageId);
    setMeta({
      slug: initialSlug,
      description: initialDescription,
      seoTitle: initialSeoTitle,
      seoDescription: initialSeoDescription,
      ogImage: initialOgImage,
      keywords: initialKeywords,
      hideHeader: initialHideHeader,
      showPageTitle: initialShowPageTitle,
      backgroundColor: initialBackgroundColor,
      renderingType: initialRenderingType,
      headerId: initialHeaderId,
      footerId: initialFooterId,
      stickyHeaderId: initialStickyHeaderId,
      stickyFooterId: initialStickyFooterId,
    });
    setPageTitle(initialTitle);
    setMetaError(null);
  }, [
    pageId,
    initialSlug,
    initialDescription,
    initialSeoTitle,
    initialSeoDescription,
    initialOgImage,
    initialKeywords,
    initialHideHeader,
    initialShowPageTitle,
    initialBackgroundColor,
    initialRenderingType,
    initialHeaderId,
    initialFooterId,
    initialStickyHeaderId,
    initialStickyFooterId,
    initialTitle,
  ]);

  const syncKitPageTitle = useCallback((title: string) => {
    requestAnimationFrame(() => {
      const input = document.querySelector(
        ".cms-editor-shell .page-title-input",
      ) as HTMLInputElement | null;
      if (!input) {
        return;
      }

      const setter = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value",
      )?.set;
      setter?.call(input, title);
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
  }, []);

  useEffect(() => {
    syncKitPageTitle(pageTitle);
  }, [pageTitle, syncKitPageTitle]);

  const setField = useCallback(
    <K extends keyof MetaState>(key: K, value: MetaState[K]) => {
      setMeta((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  const onSave = useCallback(
    async ({
      title,
      html,
      json,
    }: {
      id: string;
      title: string;
      html: string;
      json: string;
    }) => {
      setSaving(true);
      try {
        const current = metaRef.current;
        const payload = {
          title: pageTitleRef.current.trim() || title,
          html,
          json,
          type: contentType,
          slug: current.slug.trim() || undefined,
          description: current.description,
          seoTitle: current.seoTitle,
          seoDescription: current.seoDescription,
          ogImage: current.ogImage,
          keywords: current.keywords,
          hideHeader: current.hideHeader,
          showPageTitle: current.showPageTitle,
          backgroundColor: current.backgroundColor || "#ffffff",
          renderingType: current.renderingType,
          headerId: current.headerId || null,
          footerId: current.footerId || null,
          stickyHeaderId: current.stickyHeaderId || null,
          stickyFooterId: current.stickyFooterId || null,
        };

        // Create only when we don't yet have a saved page; otherwise update it.
        // This makes repeated Save clicks on a new page edit the same record
        // instead of spawning a duplicate page on every click.
        const existingId = currentPageIdRef.current;
        const response = existingId
          ? await fetch(`/api/cms/pages/${existingId}`, {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(payload),
            })
          : await fetch("/api/cms/pages", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(payload),
            });

        if (!response.ok) {
          const error = await response.json().catch(() => ({}));
          throw new Error(error.error || "Failed to save page.");
        }

        const saved = await response.json();
        // Bind the editor to the freshly created page so the next save updates
        // it rather than creating another one.
        if (!existingId && saved.id) {
          setCurrentPageId(saved.id);
        }
        // Reflect the server-resolved slug (it may de-dupe or derive from title).
        if (saved.slug) {
          setField("slug", saved.slug);
        }
        onSaved?.(saved.id);
        return saved;
      } finally {
        setSaving(false);
      }
    },
    [contentType, onSaved, setField],
  );

  const onLoad = useCallback(
    async (id: string) => {
      if (isNew) {
        return null;
      }

      return fetchPage(id);
    },
    [isNew],
  );

  const listImages = useCallback(
    async ({
      page,
      perPage,
      search,
    }: {
      page: number;
      perPage: number;
      search: string;
    }) => {
      const params = new URLSearchParams({
        page: String(page),
        perPage: String(perPage),
        q: search,
      });

      const response = await fetch(`/api/cms/media?${params.toString()}`);

      if (!response.ok) {
        throw new Error("Failed to load media library.");
      }

      return response.json();
    },
    [],
  );

  const uploadImage = useCallback((file: File) => directUploadMedia(file), []);

  const onOgFileChange = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.target.value = "";
      if (!file) return;

      setUploadingOg(true);
      setMetaError(null);
      try {
        const uploaded = await uploadImage(file);
        if (uploaded?.url) {
          setField("ogImage", uploaded.url);
        }
      } catch (error) {
        setMetaError(
          error instanceof Error ? error.message : "Failed to upload image.",
        );
      } finally {
        setUploadingOg(false);
      }
    },
    [setField, uploadImage],
  );

  const ogFileInputRef = useRef<HTMLInputElement>(null);

  // Compact one-line summary of the SEO/social fields, shown when the group is
  // collapsed so the user can see what's set without expanding it.
  const seoSummary = (() => {
    const parts: string[] = [];
    if (meta.seoTitle.trim()) parts.push("title");
    if (meta.seoDescription.trim()) parts.push("description");
    if (meta.keywords.trim()) parts.push("keywords");
    if (meta.ogImage.trim()) parts.push("image");
    return parts.length ? `Set: ${parts.join(", ")}` : "Using page defaults";
  })();

  const twoCol = "@container (inline-size >= 640px) 1fr 1fr, 1fr";

  // Header/footer components only hold a title, slug and blocks — the page
  // layout, sticky and SEO settings below are page-only.
  const isPage = contentType === "page";
  const typeLabel =
    contentType === "header"
      ? "Header"
      : contentType === "footer"
        ? "Footer"
        : "Page";

  // Header buttons injected into the kit's editor chrome. The gear opens the
  // page/layout settings modal; the magnifier opens SEO & social (pages only —
  // headers/footers carry neither layout nor SEO fields).
  const customButtons = [
    {
      id: "page-settings",
      icon: <FaCog />,
      title: `${typeLabel} settings`,
      position: "start" as const,
      onClick: () => pageSettingsModalRef.current?.showOverlay?.(),
    },
    ...(isPage
      ? [
          {
            id: "seo-settings",
            icon: <FaSearch />,
            title: "Search engine & social",
            position: "start" as const,
            onClick: () => seoModalRef.current?.showOverlay?.(),
          },
        ]
      : []),
  ];

  return (
    <div className="cms-editor-shell">
      {/* Blocking overlay while a save is in flight, so the merchant knows the
          builder is persisting and doesn't navigate away mid-save. */}
      {saving ? (
        <div
          role="status"
          aria-live="polite"
          aria-label="Saving"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(255, 255, 255, 0.6)",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "16px 20px",
              borderRadius: 12,
              background: "#fff",
              boxShadow: "0 4px 24px rgba(0, 0, 0, 0.18)",
            }}
          >
            <s-spinner size="base" accessibilityLabel="Saving"></s-spinner>
            <s-text>Saving {typeLabel.toLowerCase()}…</s-text>
          </div>
        </div>
      ) : null}

      {/* Page/layout settings — opened by the gear button in the editor header. */}
      <s-modal
        id="cms-page-settings"
        ref={pageSettingsModalRef}
        heading={`${typeLabel} settings`}
        size="large"
      >
        {metaError ? (
          <s-banner tone="critical" heading="Image upload failed">
            <s-paragraph>{metaError}</s-paragraph>
          </s-banner>
        ) : null}

        <s-stack direction="block" gap="base">
          <s-text-field
            label={`${typeLabel} title`}
            name="pageTitle"
            value={pageTitle}
            onChange={(e) => {
              const nextTitle = e.currentTarget.value;
              setPageTitle(nextTitle);
              syncKitPageTitle(nextTitle);
            }}
          ></s-text-field>

          {/* Essentials — slug and excerpt side by side on wide viewports. */}
          <s-grid gridTemplateColumns={twoCol} gap="base">
            <s-text-field
              label="URL slug"
              name="slug"
              prefix="/pages/"
              placeholder="auto-generated from the title"
              details="Leave blank to generate from the title."
              value={meta.slug}
              onChange={(e) => setField("slug", e.currentTarget.value)}
            ></s-text-field>

            <s-text-area
              label="Description / excerpt"
              name="description"
              rows={2}
              details="Shown in list/card views on mobile."
              value={meta.description}
              onChange={(e) => setField("description", e.currentTarget.value)}
            ></s-text-area>
          </s-grid>

          {isPage ? (
            <>
              <s-divider />

              <s-grid gridTemplateColumns={twoCol} gap="base">
                <s-select
                  label="Header"
                  name="headerId"
                  value={meta.headerId}
                  onChange={(e) => setField("headerId", e.currentTarget.value)}
                >
                  <s-option value="">None</s-option>
                  {headers.map((header) => (
                    <s-option key={header.id} value={header.id}>
                      {header.title}
                    </s-option>
                  ))}
                </s-select>

                <s-select
                  label="Footer"
                  name="footerId"
                  value={meta.footerId}
                  onChange={(e) => setField("footerId", e.currentTarget.value)}
                >
                  <s-option value="">None</s-option>
                  {footers.map((footer) => (
                    <s-option key={footer.id} value={footer.id}>
                      {footer.title}
                    </s-option>
                  ))}
                </s-select>
              </s-grid>

              {/* Sticky (pinned) slots reuse the same header/footer components,
              selected by reference so one component can be shared across pages. */}
              {/* <s-grid gridTemplateColumns={twoCol} gap="base"> */}
                {/* <s-select
                  label="Sticky header"
                  name="stickyHeaderId"
                  details="Pinned to the top on mobile."
                  value={meta.stickyHeaderId}
                  onChange={(e) =>
                    setField("stickyHeaderId", e.currentTarget.value)
                  }
                >
                  <s-option value="">None</s-option>
                  {headers.map((header) => (
                    <s-option key={header.id} value={header.id}>
                      {header.title}
                    </s-option>
                  ))}
                </s-select> */}

                {/* <s-select
                  label="Sticky footer"
                  name="stickyFooterId"
                  details="Pinned to the bottom on mobile."
                  value={meta.stickyFooterId}
                  onChange={(e) =>
                    setField("stickyFooterId", e.currentTarget.value)
                  }
                >
                  <s-option value="">None</s-option>
                  {footers.map((footer) => (
                    <s-option key={footer.id} value={footer.id}>
                      {footer.title}
                    </s-option>
                  ))}
                </s-select> */}
              {/* </s-grid> */}

              <s-grid gridTemplateColumns={twoCol} gap="base">
                <s-select
                  label="Rendering type"
                  name="renderingType"
                  value={meta.renderingType}
                  onChange={(e) =>
                    setField(
                      "renderingType",
                      e.currentTarget.value as MetaState["renderingType"],
                    )
                  }
                >
                  <s-option value="normal">Normal</s-option>
                  <s-option value="scrollView">Scroll view</s-option>
                  <s-option value="flatList">Flat list</s-option>
                </s-select>

                <s-color-field
                  label="Background color"
                  name="backgroundColor"
                  placeholder="#ffffff"
                  value={meta.backgroundColor}
                  onChange={(e) =>
                    setField("backgroundColor", e.currentTarget.value)
                  }
                ></s-color-field>
              </s-grid>

              <s-stack direction="inline" gap="base">
                <s-checkbox
                  label="Hide page header"
                  name="hideHeader"
                  checked={meta.hideHeader}
                  onChange={(e) =>
                    setField("hideHeader", e.currentTarget.checked)
                  }
                ></s-checkbox>
                <s-checkbox
                  label="Show page title"
                  name="showPageTitle"
                  checked={meta.showPageTitle}
                  onChange={(e) =>
                    setField("showPageTitle", e.currentTarget.checked)
                  }
                ></s-checkbox>
              </s-stack>

            </>
          ) : null}
        </s-stack>

        <s-button
          slot="primary-action"
          variant="primary"
          onClick={() => pageSettingsModalRef.current?.hideOverlay?.()}
        >
          Done
        </s-button>
      </s-modal>

      {/* SEO & social — opened by the magnifier button in the editor header.
          Pages only; headers/footers carry no SEO fields. */}
      {isPage ? (
        <s-modal
          id="cms-seo-settings"
          ref={seoModalRef}
          heading="Search engine & social"
          size="large"
        >
          {metaError ? (
            <s-banner tone="critical" heading="Image upload failed">
              <s-paragraph>{metaError}</s-paragraph>
            </s-banner>
          ) : null}

          <s-stack direction="block" gap="base">
            <s-text color="subdued">{seoSummary}</s-text>

            <s-grid gridTemplateColumns={twoCol} gap="base">
              <s-text-field
                label="SEO title"
                name="seoTitle"
                maxLength={70}
                placeholder="Defaults to the page title"
                details={`${meta.seoTitle.length}/70`}
                value={meta.seoTitle}
                onChange={(e) => setField("seoTitle", e.currentTarget.value)}
              ></s-text-field>

              <s-text-field
                label="Keywords"
                name="keywords"
                placeholder="comma, separated, keywords"
                details="Comma-separated."
                value={meta.keywords}
                onChange={(e) => setField("keywords", e.currentTarget.value)}
              ></s-text-field>
            </s-grid>

            <s-text-area
              label="Meta description"
              name="seoDescription"
              rows={2}
              maxLength={160}
              details={`${meta.seoDescription.length}/160`}
              value={meta.seoDescription}
              onChange={(e) => setField("seoDescription", e.currentTarget.value)}
            ></s-text-area>

            {/* OG image — thumbnail and controls inline to stay compact. */}
            <s-stack direction="block" gap="small">
              <s-text color="subdued">Social / OG image</s-text>
              <s-grid gridTemplateColumns={twoCol} gap="base" alignItems="end">
                <s-stack direction="inline" gap="base" alignItems="center">
                  {meta.ogImage ? (
                    <s-thumbnail
                      size="large"
                      src={meta.ogImage}
                      alt="OG image"
                    />
                  ) : null}
                  <s-stack direction="inline" gap="small">
                    <s-button
                      variant="secondary"
                      onClick={() => ogFileInputRef.current?.click()}
                      {...(uploadingOg ? { loading: true } : {})}
                    >
                      {meta.ogImage ? "Replace" : "Upload"}
                    </s-button>
                    {meta.ogImage ? (
                      <s-button
                        variant="tertiary"
                        tone="critical"
                        onClick={() => setField("ogImage", "")}
                      >
                        Remove
                      </s-button>
                    ) : null}
                  </s-stack>
                </s-stack>
                <s-text-field
                  label="Image URL"
                  labelAccessibilityVisibility="exclusive"
                  name="ogImage"
                  placeholder="https://…"
                  value={meta.ogImage}
                  onChange={(e) => setField("ogImage", e.currentTarget.value)}
                ></s-text-field>
              </s-grid>
              <input
                ref={ogFileInputRef}
                type="file"
                accept="image/*"
                style={{ display: "none" }}
                onChange={onOgFileChange}
              />
            </s-stack>
          </s-stack>

          <s-button
            slot="primary-action"
            variant="primary"
            onClick={() => seoModalRef.current?.hideOverlay?.()}
          >
            Done
          </s-button>
        </s-modal>
      ) : null}

      <CmsPageSwitcher
        currentPageId={currentPageId}
        contentType={contentType}
        currentTitle={pageTitle}
        pages={pages}
      />

      <ClientBlockEditor
        key={pageId ?? "new"}
        fallback={<EditorFallback />}
        initialPageId={pageId}
        initialTitle={initialTitle}
        initialContent={initialContent}
        onSave={onSave}
        headerButtons={{
          deviceSwitcher: false,  // device preview toggle
          sidebar: true,         // sidebar toggle
          preview: false,         // preview/edit toggle
          clear: true,          // hide Clear (trash) button
          save: true,            // Save button
          viewSite: false,       // hide View Site button
          options: true,         // options (⋮) menu
        }}
        onLoad={onLoad}
        // Gear + magnifier buttons in the editor header open the settings modals.
        customButtons={customButtons}
        // Button-action registry shared by every block's <ActionBuilder>.
        actions={cmsEditorActions}
        unregisterBlocks={["core/breadcrumbs","core/table","core/code","core/gallery","core/shortcode","core/search","core/tag-cloud","core/html"]}
        // Drop the kit's myapp/* demo blocks entirely.
        disableBundledBlocks
        // Hide remaining defaults (WP core) — only Appbuilder Blocks insertable.
        editorSettings={{ allowedBlockTypes: APPBUILDER_BLOCKS }}
        media={{
          perPage: 20,
          listImages,
          uploadImage,
        }}
        onViewSite={
          previewSlug
            ? () => {
                window.open(
                  `/pages/${previewSlug}`,
                  "_blank",
                  "noopener,noreferrer",
                );
              }
            : undefined
        }
      />
    </div>
  );
}
