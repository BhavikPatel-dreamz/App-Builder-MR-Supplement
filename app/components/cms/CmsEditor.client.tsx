import { useCallback } from "react";
import "gutenberg-block-kit/styles";
import "../../blocks/appbuilder/shared-ui.css";
import "../../blocks/appbuilder/image-carousel.css";
import "../../blocks/appbuilder/image-slider.css";
import "../../blocks/appbuilder/product-scroller.css";
import "../../blocks/appbuilder/categories-scroller.css";
import "../../blocks/appbuilder/menu-items.css";
import "../../blocks/appbuilder/selected-products.css";
import "../../blocks/appbuilder/standard-blocks.css";
import "../../blocks/appbuilder/advanced-multimedia-scroller.css";
import "../../blocks/appbuilder/multimedia-scroller.css";
import "../../blocks/appbuilder/expandalbe-categories.css";
import "../../blocks/appbuilder/top-marquee.css";
import "../../blocks/appbuilder/products-by-categoris-scroller.css";
import "../../blocks/appbuilder/brand-scroller.css";
import "../../blocks/appbuilder/social-feed.css";
import "../../blocks/appbuilder/story-section.css";
import "../../blocks/appbuilder/rewards-steps.css";
import { BlockEditor } from "gutenberg-block-kit/editor";
import { directUploadMedia } from "../../lib/upload-client";

type CmsEditorProps = {
  pageId?: string;
  initialTitle?: string;
  initialContent?: string;
  isNew?: boolean;
  previewSlug?: string;
  onSaved?: (pageId: string) => void;
};

async function fetchPage(pageId: string) {
  const response = await fetch(`/api/cms/pages/${pageId}`);

  if (!response.ok) {
    return null;
  }

  return response.json();
}

export function CmsEditor({
  pageId,
  initialTitle = "Untitled page",
  initialContent,
  isNew = false,
  previewSlug,
  onSaved,
}: CmsEditorProps) {
  const onSave = useCallback(
    async ({
      id,
      title,
      html,
      json,
    }: {
      id: string;
      title: string;
      html: string;
      json: string;
    }) => {
      const payload = {
        title,
        html,
        json,
        slug: id,
      };

      const response = isNew
        ? await fetch("/api/cms/pages", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          })
        : await fetch(`/api/cms/pages/${pageId}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || "Failed to save page.");
      }

      const saved = await response.json();
      onSaved?.(saved.id);
      return saved;
    },
    [isNew, onSaved, pageId],
  );

  const onLoad = useCallback(async (id: string) => {
    if (isNew) {
      return null;
    }

    return fetchPage(id);
  }, [isNew]);

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

  return (
    <div className="cms-editor-shell">
      <BlockEditor
        initialPageId={pageId}
        initialTitle={initialTitle}
        initialContent={initialContent}
        onSave={onSave}
        headerButtons={{
          deviceSwitcher: true,  // device preview toggle
          sidebar: true,         // sidebar toggle
          preview: true,         // preview/edit toggle
          clear: false,          // hide Clear (trash) button
          save: true,            // Save button
          viewSite: false,       // hide View Site button
          options: true,         // options (⋮) menu
        }}
        onLoad={onLoad}
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
