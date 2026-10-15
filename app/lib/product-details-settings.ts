const DEFAULT_PAYMENT_METHOD = 3;

export type ProductDetailsSettings = {
  paymentMethod: number;
};

export type PublicProductDetailsSettings = {
  paymentMethod: number;
};

export const DEFAULT_PRODUCT_DETAILS_SETTINGS: ProductDetailsSettings = {
  paymentMethod: DEFAULT_PAYMENT_METHOD,
};

function parseNumber(value: unknown, fallback: number): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export function parseProductDetailsSettings(
  value: unknown,
): ProductDetailsSettings {
  const raw =
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};

  return {
    paymentMethod: Math.max(
      0,
      Math.floor(parseNumber(raw.paymentMethod, DEFAULT_PAYMENT_METHOD)),
    ),
  };
}

export function toPublicProductDetailsSettings(
  value: unknown,
): PublicProductDetailsSettings {
  const settings = parseProductDetailsSettings(value);
  return {
    paymentMethod: settings.paymentMethod,
  };
}
