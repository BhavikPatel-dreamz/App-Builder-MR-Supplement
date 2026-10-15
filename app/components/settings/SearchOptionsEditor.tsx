import {
  DEFAULT_SEARCH_SETTINGS,
  type SearchSettings,
} from "../../lib/search-settings";
import {
  EMPTY_COLLECTION_REF,
  hasCollectionRef,
  type SettingsCollectionRef,
} from "../../lib/settings-resources";

async function pickCollection(): Promise<SettingsCollectionRef | null> {
  const picker =
    typeof window !== "undefined" ? window.shopify?.resourcePicker : null;
  if (!picker) return null;

  const selection = await picker({ type: "collection", multiple: false });
  const collection = selection?.[0];
  if (!collection?.id) return null;

  return {
    collectionId: String(collection.id),
    handle: collection.handle ? String(collection.handle) : "",
    title: collection.title ? String(collection.title) : "",
  };
}

export function SearchOptionsEditor({
  value,
  onChange,
}: {
  value: SearchSettings;
  onChange: (next: SearchSettings) => void;
}) {
  const settings = value || DEFAULT_SEARCH_SETTINGS;
  const collection = settings.searchbarCollection;
  const selected = hasCollectionRef(collection);

  return (
    <s-section heading="Search">
      <s-stack direction="block" gap="base">
        <s-paragraph>
          Search options for the native app. Saved on GET /cms/settings as search.
        </s-paragraph>

        <s-box padding="base" border="base" borderRadius="base">
          <s-stack direction="block" gap="base">
            <s-heading>Searchbar Default Collection</s-heading>
            {selected ? (
              <s-stack direction="block" gap="small">
                <s-text>
                  <strong>{collection.title || "Selected collection"}</strong>
                </s-text>
                {collection.handle ? (
                  <s-text color="subdued">{collection.handle}</s-text>
                ) : null}
              </s-stack>
            ) : (
              <s-text color="subdued">No collection selected.</s-text>
            )}
            <s-stack direction="inline" gap="small" alignItems="center">
              <s-button
                variant="secondary"
                onClick={async () => {
                  const picked = await pickCollection();
                  if (picked) {
                    onChange({ ...settings, searchbarCollection: picked });
                  }
                }}
              >
                {selected ? "Change collection" : "Select collection"}
              </s-button>
              {selected ? (
                <s-button
                  variant="tertiary"
                  onClick={() =>
                    onChange({
                      ...settings,
                      searchbarCollection: { ...EMPTY_COLLECTION_REF },
                    })
                  }
                >
                  Clear
                </s-button>
              ) : null}
            </s-stack>
          </s-stack>
        </s-box>
      </s-stack>
    </s-section>
  );
}
