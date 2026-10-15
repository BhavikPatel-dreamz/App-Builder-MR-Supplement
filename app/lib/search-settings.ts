import {
  EMPTY_COLLECTION_REF,
  parseCollectionRef,
  type SettingsCollectionRef,
} from "./settings-resources";

export type SearchSettings = {
  searchbarCollection: SettingsCollectionRef;
};

export type PublicSearchCollection = {
  id: string;
  handle: string;
  title: string;
};

export type PublicSearchSettings = {
  searchbarCollection: PublicSearchCollection;
};

export const DEFAULT_SEARCH_SETTINGS: SearchSettings = {
  searchbarCollection: { ...EMPTY_COLLECTION_REF },
};

export function parseSearchSettings(value: unknown): SearchSettings {
  const raw =
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};

  return {
    searchbarCollection: parseCollectionRef(raw.searchbarCollection),
  };
}

export function toPublicSearchSettings(value: unknown): PublicSearchSettings {
  const settings = parseSearchSettings(value);
  return {
    searchbarCollection: {
      id: settings.searchbarCollection.collectionId,
      handle: settings.searchbarCollection.handle,
      title: settings.searchbarCollection.title,
    },
  };
}
