export type SettingsCollectionRef = {
  collectionId: string;
  handle: string;
  title: string;
};

export type SettingsProductRef = {
  productId: string;
  handle: string;
  title: string;
};

export const EMPTY_COLLECTION_REF: SettingsCollectionRef = {
  collectionId: "",
  handle: "",
  title: "",
};

export const EMPTY_PRODUCT_REF: SettingsProductRef = {
  productId: "",
  handle: "",
  title: "",
};

export function parseCollectionRef(value: unknown): SettingsCollectionRef {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { ...EMPTY_COLLECTION_REF };
  }

  const record = value as Record<string, unknown>;
  return {
    collectionId: String(record.collectionId ?? ""),
    handle: String(record.handle ?? ""),
    title: String(record.title ?? ""),
  };
}

export function parseProductRef(value: unknown): SettingsProductRef {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { ...EMPTY_PRODUCT_REF };
  }

  const record = value as Record<string, unknown>;
  return {
    productId: String(record.productId ?? ""),
    handle: String(record.handle ?? ""),
    title: String(record.title ?? ""),
  };
}

export function hasCollectionRef(
  value: SettingsCollectionRef,
): value is SettingsCollectionRef & { collectionId: string } {
  return Boolean(value.collectionId.trim());
}

export function hasProductRef(
  value: SettingsProductRef,
): value is SettingsProductRef & { productId: string } {
  return Boolean(value.productId.trim());
}
