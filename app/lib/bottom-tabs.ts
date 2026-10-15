/** Native-app bottom tab config. Keys match the public JSON contract. */

export type BottomTabAction = {
  actionName?: string;
  params?: Record<string, unknown>;
} | Record<string, never>;

export type BottomTabItem = {
  pageId: string;
  title: string;
  action: BottomTabAction;
  openAsSaperatePage: boolean;
  actionIcon: string;
  inActiveIcon: string;
  activeTextColor: string;
  inActiveTextColor: string;
  fontSize: number;
  activeIconSize: number;
  inActiveIconSize: number;
};

export type BottomTabsConfig = {
  tabBackgroundColor: string;
  tabs: BottomTabItem[];
};

export const DEFAULT_TAB_BACKGROUND = "#ffffff";

export const EMPTY_BOTTOM_TAB: BottomTabItem = {
  pageId: "",
  title: "",
  action: {},
  openAsSaperatePage: false,
  actionIcon: "",
  inActiveIcon: "",
  activeTextColor: "#000000",
  inActiveTextColor: "#888888",
  fontSize: 10,
  activeIconSize: 20,
  inActiveIconSize: 20,
};

const MAX_TABS = 8;

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

export function parseBottomTabAction(value: unknown): BottomTabAction {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  const obj = value as Record<string, unknown>;
  const actionName = String(obj.actionName ?? "").trim();
  if (!actionName) return {};
  const params =
    obj.params && typeof obj.params === "object" && !Array.isArray(obj.params)
      ? (obj.params as Record<string, unknown>)
      : {};
  return { actionName, params };
}

export function parseBottomTabItem(value: unknown): BottomTabItem | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  const obj = value as Record<string, unknown>;
  return {
    pageId: String(obj.pageId ?? "").trim(),
    title: String(obj.title ?? "").trim(),
    action: parseBottomTabAction(obj.action),
    openAsSaperatePage: parseBoolean(
      obj.openAsSaperatePage ?? obj.openAsSeparatePage,
      false,
    ),
    actionIcon: String(obj.actionIcon ?? obj.activeIcon ?? "").trim(),
    inActiveIcon: String(obj.inActiveIcon ?? obj.inactiveIcon ?? "").trim(),
    activeTextColor: parseHexColor(obj.activeTextColor, "#000000"),
    inActiveTextColor: parseHexColor(
      obj.inActiveTextColor ?? obj.inactiveTextColor,
      "#888888",
    ),
    fontSize: parseNumber(obj.fontSize, 10),
    activeIconSize: parseNumber(obj.activeIconSize, 20),
    inActiveIconSize: parseNumber(
      obj.inActiveIconSize ?? obj.inactiveIconSize,
      20,
    ),
  };
}

export function parseBottomTabs(value: unknown): BottomTabItem[] {
  if (!Array.isArray(value)) return [];
  return value
    .map(parseBottomTabItem)
    .filter((tab): tab is BottomTabItem => tab !== null)
    .slice(0, MAX_TABS);
}

export function parseTabBackgroundColor(value: unknown): string {
  return parseHexColor(value, DEFAULT_TAB_BACKGROUND);
}

export function createEmptyBottomTab(): BottomTabItem {
  return { ...EMPTY_BOTTOM_TAB, action: {} };
}
