import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { extractOIDCParams, buildOIDCNavigationUrl, getCurrentOIDCParams } from "./oidc-utils";

const setLocation = (search: string, hash: string, href?: string) => {
  Object.defineProperty(window, "location", {
    value: {
      search,
      hash,
      href: href ?? `http://localhost:3000/oidc/login${search}${hash}`,
    },
    writable: true,
    configurable: true,
  });
};

describe("oidc-utils extra", () => {
  beforeEach(() => setLocation("", ""));
  afterEach(() => vi.restoreAllMocks());

  describe("extractOIDCParams", () => {
    it("extracts clientId/userName/projectKey from the hash color-and-ampersand branch", () => {
      setLocation("", "#124091&clientId=cid&userName=alice&x-blocks-key=pk");
      const params = extractOIDCParams();
      expect(params.themeColor).toBe("#124091");
      expect(params.clientId).toBe("cid");
      expect(params.userName).toBe("alice");
      expect(params.projectKey).toBe("pk");
    });

    it("handles a hash that is only a color (else branch, no extra params)", () => {
      setLocation("", "#124091");
      const params = extractOIDCParams();
      expect(params.themeColor).toBe("#124091");
      expect(params.clientId).toBeUndefined();
    });

    it("falls back to the default color for an invalid brandColor", () => {
      setLocation("?brandColor=notacolor", "");
      const params = extractOIDCParams();
      expect(params.themeColor).toBe("#124091");
    });

    it("normalizes a bare 6-hex brandColor into #-form", () => {
      setLocation("?brandColor=AABBCC", "");
      const params = extractOIDCParams();
      expect(params.themeColor).toBe("#AABBCC");
    });

    it("fully decodes a double-encoded logoUrl from the query", () => {
      // %253A -> %3A -> :   and %252F -> %2F -> /
      setLocation("?logoUrl=https%253A%252F%252Fcdn.test.com%252Flogo.png", "");
      const params = extractOIDCParams();
      expect(params.logoUrl).toBe("https://cdn.test.com/logo.png");
    });

    it("recovers logoUrl from the URL fragment when it is not a query param", () => {
      const href =
        "http://localhost:3000/oidc/login#logoUrl=https://cdn.test.com/frag.png";
      setLocation("", "#logoUrl=https://cdn.test.com/frag.png", href);
      const params = extractOIDCParams();
      expect(params.logoUrl).toBe("https://cdn.test.com/frag.png");
    });
  });

  describe("buildOIDCNavigationUrl", () => {
    it("serializes every present OIDC param", () => {
      setLocation(
        "?x-blocks-key=pk&userName=alice&clientId=cid&logoUrl=https%3A%2F%2Fx%2Fl.png&brandColor=%23FF0000&state=st&nonce=no&scope=openid&redirect_uri=https%3A%2F%2Fcb",
        "",
      );
      const url = buildOIDCNavigationUrl("/oidc/consent");
      expect(url.startsWith("/oidc/consent?")).toBe(true);
      expect(url).toContain("x-blocks-key=pk");
      expect(url).toContain("userName=alice");
      expect(url).toContain("clientId=cid");
      expect(url).toContain("state=st");
      expect(url).toContain("nonce=no");
      expect(url).toContain("scope=openid");
      expect(url).toContain("redirect_uri=https");
      expect(url).toContain("brandColor=%23FF0000");
    });
  });

  describe("getCurrentOIDCParams", () => {
    it("includes all present params in the URLSearchParams", () => {
      setLocation(
        "?x-blocks-key=pk&userName=alice&clientId=cid&logoUrl=https%3A%2F%2Fx%2Fl.png&brandColor=%23FF0000&state=st&nonce=no&scope=openid&redirect_uri=https%3A%2F%2Fcb",
        "",
      );
      const params = getCurrentOIDCParams();
      expect(params.get("x-blocks-key")).toBe("pk");
      expect(params.get("userName")).toBe("alice");
      expect(params.get("clientId")).toBe("cid");
      expect(params.get("state")).toBe("st");
      expect(params.get("nonce")).toBe("no");
      expect(params.get("scope")).toBe("openid");
      expect(params.get("redirect_uri")).toBe("https://cb");
      expect(params.get("brandColor")).toBe("#FF0000");
    });
  });
});
