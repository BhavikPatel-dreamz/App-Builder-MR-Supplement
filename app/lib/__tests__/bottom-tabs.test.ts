import { describe, it, expect } from "vitest";

import {
  parseBottomTabItem,
  parseBottomTabs,
  parseTabBackgroundColor,
} from "../bottom-tabs";

describe("bottom tabs contract", () => {
  it("parses the native JSON shape", () => {
    const tab = parseBottomTabItem({
      pageId: "home",
      title: "Home",
      action: { actionName: "OPEN_HOME", params: {} },
      openAsSaperatePage: false,
      actionIcon: "https://example.com/on.png",
      inActiveIcon: "https://example.com/off.png",
      activeTextColor: "#ffffff",
      inActiveTextColor: "#cccccc",
      fontSize: 10,
      activeIconSize: 20,
      inActiveIconSize: 20,
    });

    expect(tab).toMatchObject({
      pageId: "home",
      title: "Home",
      openAsSaperatePage: false,
      actionIcon: "https://example.com/on.png",
      fontSize: 10,
    });
    expect(tab?.action).toEqual({ actionName: "OPEN_HOME", params: {} });
  });

  it("accepts openAsSeparatePage spelling and empty action", () => {
    const tab = parseBottomTabItem({
      pageId: "bag",
      title: "Bag",
      action: {},
      openAsSeparatePage: true,
    });
    expect(tab?.openAsSaperatePage).toBe(true);
    expect(tab?.action).toEqual({});
  });

  it("caps tabs at 8", () => {
    const tabs = parseBottomTabs(
      Array.from({ length: 12 }, (_, i) => ({ pageId: `t${i}`, title: `T${i}` })),
    );
    expect(tabs).toHaveLength(8);
  });

  it("falls back tab background color", () => {
    expect(parseTabBackgroundColor("not-a-color")).toBe("#ffffff");
    expect(parseTabBackgroundColor("#fff")).toBe("#fff");
  });
});
