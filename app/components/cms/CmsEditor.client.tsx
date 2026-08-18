import { useCallback } from "react";
import "gutenberg-block-kit/styles";
import "../../blocks/riyasat/shared-ui.css";
import "../../blocks/riyasat/image-carousel.css";
import "../../blocks/riyasat/image-slider.css";
import "../../blocks/riyasat/product-scroller.css";
import "../../blocks/riyasat/categories-scroller.css";
import "../../blocks/riyasat/menu-items.css";
import "../../blocks/riyasat/selected-products.css";
import "../../blocks/riyasat/standard-blocks.css";
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
