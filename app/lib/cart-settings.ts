import {
  parseProductRef,
  type SettingsProductRef,
} from "./settings-resources";

const DEFAULT_FREE_SHIPPING_PRICE = 100;
const DEFAULT_HANDY_ITEMS_TITLE = "HandyLastMinuteItems";
const MAX_HANDY_ITEMS = 50;

export type CartFreeShippingProgressbar = {
  price: number;
  enable: boolean;
};

export type CartHandyItem = SettingsProductRef;

export type CartHandyItems = {
  title: string;
  enable: boolean;
  items: CartHandyItem[];
};

export type CartSettings = {
  cartFreeShippingProgressbar: CartFreeShippingProgressbar;
  cartHandyItems: CartHandyItems;
};

export type PublicCartHandyItem = {
  productId: string;
};

export type PublicCartSettings = {
  cartFreeShippingProgressbar: CartFreeShippingProgressbar;
  cartHandyItems: {
    title: string;
    enable: boolean;
    items: PublicCartHandyItem[];
  };
};

function parseBoolean(value: unknown, fallback = false): boolean {
  if (value === true || value === "true" || value === 1 || value === "1") return true;
  if (value === false || value === "false" || value === 0 || value === "0") return false;
  return fallback;
}

function parseNumber(value: unknown, fallback: number): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export const DEFAULT_CART_FREE_SHIPPING: CartFreeShippingProgressbar = {
  price: DEFAULT_FREE_SHIPPING_PRICE,
  enable: true,
};

export const DEFAULT_CART_HANDY_ITEMS: CartHandyItems = {
  title: DEFAULT_HANDY_ITEMS_TITLE,
  enable: true,
  items: [],
};

export const DEFAULT_CART_SETTINGS: CartSettings = {
  cartFreeShippingProgressbar: { ...DEFAULT_CART_FREE_SHIPPING },
  cartHandyItems: { ...DEFAULT_CART_HANDY_ITEMS, items: [] },
};

export function parseCartHandyItem(value: unknown): CartHandyItem | null {
  if (typeof value === "string") {
    const productId = value.trim();
    return productId ? { productId, handle: "", title: "" } : null;
  }

  const parsed = parseProductRef(value);
  return parsed.productId.trim() ? parsed : null;
}

export function parseCartSettings(value: unknown): CartSettings {
  const raw =
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};

  const progressRaw =
    raw.cartFreeShippingProgressbar &&
    typeof raw.cartFreeShippingProgressbar === "object" &&
    !Array.isArray(raw.cartFreeShippingProgressbar)
      ? (raw.cartFreeShippingProgressbar as Record<string, unknown>)
      : {};

  const handyRaw =
    raw.cartHandyItems &&
    typeof raw.cartHandyItems === "object" &&
    !Array.isArray(raw.cartHandyItems)
      ? (raw.cartHandyItems as Record<string, unknown>)
      : {};

  const items = Array.isArray(handyRaw.items)
    ? handyRaw.items
        .map(parseCartHandyItem)
        .filter((item): item is CartHandyItem => item !== null)
        .filter(
          (item, index, list) =>
            list.findIndex((other) => other.productId === item.productId) ===
            index,
        )
        .slice(0, MAX_HANDY_ITEMS)
    : [];

  const title = String(handyRaw.title ?? "").trim();

  return {
    cartFreeShippingProgressbar: {
      price: Math.max(
        0,
        parseNumber(progressRaw.price, DEFAULT_FREE_SHIPPING_PRICE),
      ),
      enable: parseBoolean(progressRaw.enable, true),
    },
    cartHandyItems: {
      title: title || DEFAULT_HANDY_ITEMS_TITLE,
      enable: parseBoolean(handyRaw.enable, true),
      items,
    },
  };
}

export function toPublicCartSettings(value: unknown): PublicCartSettings {
  const settings = parseCartSettings(value);
  return {
    cartFreeShippingProgressbar: {
      price: settings.cartFreeShippingProgressbar.price,
      enable: settings.cartFreeShippingProgressbar.enable,
    },
    cartHandyItems: {
      title: settings.cartHandyItems.title,
      enable: settings.cartHandyItems.enable,
      items: settings.cartHandyItems.items.map((item) => ({
        productId: item.productId,
      })),
    },
  };
}
