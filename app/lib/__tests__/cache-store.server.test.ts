import { describe, expect, it } from "vitest";

import {
  lookupPersistedQueryText,
  parseCacheUrlInput,
  uniqueCacheUrlKey,
  urlMatchesRequest,
} from "../cache-store.server";
import { PRODUCTS_BY_COLLECTION_ID_QUERY, PRODUCTS_BY_COLLECTION_ID_SHA256 } from "../persisted-queries";

describe("parseCacheUrlInput", () => {
  it("detects cms pages list", () => {
    expect(parseCacheUrlInput("/cms/pages").kind).toBe("cms_pages");
  });

  it("detects graphql sha256", () => {
    const parsed = parseCacheUrlInput(
      "/graphql?sha256=abc&variables=%7B%22id%22%3A%221%22%7D",
    );
    expect(parsed.kind).toBe("graphql");
    expect(parsed.sha256).toBe("abc");
    expect(parsed.variablesJson).toBe(JSON.stringify({ id: "1" }));
  });
});

describe("urlMatchesRequest", () => {
  it("matches collection graphql url", () => {
    const row = parseCacheUrlInput(
      `/graphql?sha256=${PRODUCTS_BY_COLLECTION_ID_SHA256}&variables=%7B%22id%22%3A%22gid%3A%2F%2Fshopify%2FCollection%2F375678697663%22%2C%22first%22%3A10%7D`,
    );
    const requestUrl = new URL(
      `https://appbuilder.dreamzapps.com/graphql?sha256=${PRODUCTS_BY_COLLECTION_ID_SHA256}&variables=%7B%22id%22%3A%22gid%3A%2F%2Fshopify%2FCollection%2F375678697663%22%2C%22first%22%3A10%7D`,
    );
    expect(urlMatchesRequest(requestUrl, row)).toBe(true);
  });

  it("matches after:null with the same query without after", () => {
    const row = parseCacheUrlInput(
      `/graphql?sha256=${PRODUCTS_BY_COLLECTION_ID_SHA256}&variables=%7B%22id%22%3A%22gid%3A%2F%2Fshopify%2FCollection%2F375678697663%22%2C%22first%22%3A10%7D`,
    );
    const requestUrl = new URL(
      `https://appbuilder.dreamzapps.com/graphql?sha256=${PRODUCTS_BY_COLLECTION_ID_SHA256}&variables=%7B%22id%22%3A%22gid%3A%2F%2Fshopify%2FCollection%2F375678697663%22%2C%22first%22%3A10%2C%22after%22%3Anull%7D`,
    );
    expect(urlMatchesRequest(requestUrl, row)).toBe(true);
  });

  it("does not match a different collection id", () => {
    const row = parseCacheUrlInput(
      "/graphql?sha256=abc&variables=%7B%22id%22%3A%22A%22%7D",
    );
    const requestUrl = new URL(
      "https://appbuilder.dreamzapps.com/graphql?sha256=abc&variables=%7B%22id%22%3A%22B%22%7D",
    );
    expect(urlMatchesRequest(requestUrl, row)).toBe(false);
  });
});

describe("uniqueCacheUrlKey", () => {
  it("collapses duplicate graphql variable sets", () => {
    const a = parseCacheUrlInput(
      "/graphql?sha256=abc&variables=%7B%22id%22%3A%221%22%7D",
    );
    const b = parseCacheUrlInput(
      "https://appbuilder.dreamzapps.com/graphql?sha256=abc&variables=%7B%22id%22%3A%221%22%7D",
    );
    expect(uniqueCacheUrlKey(a)).toBe(uniqueCacheUrlKey(b));
  });
});

describe("lookupPersistedQueryText", () => {
  it("resolves catalog hashes without a CacheUrl row", async () => {
    await expect(lookupPersistedQueryText(PRODUCTS_BY_COLLECTION_ID_SHA256)).resolves.toBe(
      PRODUCTS_BY_COLLECTION_ID_QUERY,
    );
  });
});
