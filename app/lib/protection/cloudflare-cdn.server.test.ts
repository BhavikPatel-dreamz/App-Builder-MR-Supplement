import { describe, expect, it } from "vitest";

import { uniqueHttpUrls } from "./cloudflare-cdn.server";

describe("uniqueHttpUrls", () => {
  it("keeps http(s) uniques and drops junk", () => {
    expect(
      uniqueHttpUrls([
        "https://appbuilder.dreamzapps.com/cms/pages",
        "https://appbuilder.dreamzapps.com/cms/pages",
        "ftp://x/y",
        "not a url",
        "http://127.0.0.1:8088/graphql",
      ]),
    ).toEqual([
      "https://appbuilder.dreamzapps.com/cms/pages",
      "http://127.0.0.1:8088/graphql",
    ]);
  });
});
