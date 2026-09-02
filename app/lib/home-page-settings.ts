import { parseBottomTabAction, type BottomTabAction } from "./bottom-tabs";

const DEFAULT_DELAY = 2000;
const DEFAULT_HEIGHT = 15;
const DEFAULT_DIVIDER_HEIGHT = 4;
const DEFAULT_DIVIDER_COLOR = "#ffffff";
const DEFAULT_BG = "#ffffff";
const DEFAULT_TEXT_COLOR = "#ffffff";
const DEFAULT_FONT_SIZE = 10;
const DEFAULT_ICON_SIZE = 16;
const MAX_MARQUEE_ITEMS = 20;

export type TopMarqueeItem = {
  iconUrl: string;
  iconHeight: number;
  iconWidth: number;
  text: string;
  textColor: string;
  textFontSize: number;
  action: BottomTabAction;
};

export type TopMarqueeSettings = {
  enableAutoSlide: boolean;
  autoSlideDelay: number;
  blockHeight: number;
  showDivider: boolean;
  dividerHeight: number;
  dividerColor: string;
  action: BottomTabAction;
  backgroundColor: string;
  items: TopMarqueeItem[];
};

export type HomePageSettings = {
  topMarquee: TopMarqueeSettings;
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

function parseHexColor(value: unknown, fallback: string): string {
  const raw = String(value ?? "").trim();
  if (/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(raw)) {
    return raw;
  }
  return fallback;
}

export const EMPTY_TOP_MARQUEE_ITEM: TopMarqueeItem = {
  iconUrl: "",
  iconHeight: DEFAULT_ICON_SIZE,
  iconWidth: DEFAULT_ICON_SIZE,
  text: "",
  textColor: DEFAULT_TEXT_COLOR,
  textFontSize: DEFAULT_FONT_SIZE,
  action: {},
};

export const DEFAULT_TOP_MARQUEE: TopMarqueeSettings = {
  enableAutoSlide: true,
  autoSlideDelay: DEFAULT_DELAY,
  blockHeight: DEFAULT_HEIGHT,
  showDivider: true,
  dividerHeight: DEFAULT_DIVIDER_HEIGHT,
  dividerColor: DEFAULT_DIVIDER_COLOR,
  action: {},
  backgroundColor: DEFAULT_BG,
  items: [],
};

export const DEFAULT_HOME_PAGE_SETTINGS: HomePageSettings = {
  topMarquee: { ...DEFAULT_TOP_MARQUEE, items: [] },
};

export function createEmptyTopMarqueeItem(): TopMarqueeItem {
  return { ...EMPTY_TOP_MARQUEE_ITEM, action: {} };
}

export function parseTopMarqueeItem(value: unknown): TopMarqueeItem | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  const obj = value as Record<string, unknown>;
  return {
    iconUrl: String(obj.iconUrl ?? "").trim(),
    iconHeight: parseNumber(obj.iconHeight ?? obj.imageHeight, DEFAULT_ICON_SIZE),
    iconWidth: parseNumber(obj.iconWidth ?? obj.imageWidth, DEFAULT_ICON_SIZE),
    text: String(obj.text ?? ""),
    textColor: parseHexColor(obj.textColor, DEFAULT_TEXT_COLOR),
    textFontSize: parseNumber(obj.textFontSize, DEFAULT_FONT_SIZE),
    action: parseBottomTabAction(obj.action),
  };
}

export function parseTopMarquee(value: unknown): TopMarqueeSettings {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {
      ...DEFAULT_TOP_MARQUEE,
      items: [],
      action: {},
    };
  }
  const obj = value as Record<string, unknown>;
  const items = Array.isArray(obj.items)
    ? obj.items
        .map(parseTopMarqueeItem)
        .filter((item): item is TopMarqueeItem => item !== null)
        .slice(0, MAX_MARQUEE_ITEMS)
    : [];

  return {
    enableAutoSlide: parseBoolean(obj.enableAutoSlide, true),
    autoSlideDelay: parseNumber(obj.autoSlideDelay, DEFAULT_DELAY),
    blockHeight: parseNumber(obj.blockHeight, DEFAULT_HEIGHT),
    showDivider: parseBoolean(obj.showDivider, true),
    dividerHeight: parseNumber(obj.dividerHeight, DEFAULT_DIVIDER_HEIGHT),
    dividerColor: parseHexColor(obj.dividerColor, DEFAULT_DIVIDER_COLOR),
    action: parseBottomTabAction(obj.action),
    backgroundColor: parseHexColor(obj.backgroundColor, DEFAULT_BG),
    items,
  };
}

export function parseHomePageSettings(value: unknown): HomePageSettings {
  const raw =
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  return {
    topMarquee: parseTopMarquee(raw.topMarquee),
  };
}
