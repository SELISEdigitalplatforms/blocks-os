import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { redirectToLogin, buildNavigationUrl } from "./oidc-navigation.util";

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

describe("oidc-navigation.util extra", () => {
  beforeEach(() => setLocation("", ""));
  afterEach(() => vi.restoreAllMocks());

  describe("redirectToLogin", () => {
    it("preserves query params and pulls color + params from a color-led hash", () => {
      setLocation("?x-blocks-key=pk", "#124091&state=abc");
      redirectToLogin();
      const href = window.location.href;
      expect(href.startsWith("/oidc/login?")).toBe(true);
      expect(href).toContain("x-blocks-key=pk");
      expect(href).toContain("state=abc");
      // "%23124091" gets stored literally then re-encoded by toString -> %2523124091
      expect(href).toContain("brandColor=%2523124091");
    });

    it("parses a hash without a leading color as plain fragment params", () => {
      setLocation("", "#clientId=cid&state=xyz");
      redirectToLogin();
      const href = window.location.href;
      expect(href).toContain("clientId=cid");
      expect(href).toContain("state=xyz");
    });

    it("re-encodes a #-prefixed brandColor coming from the query string", () => {
      setLocation("?brandColor=%23FF0000", "");
      redirectToLogin();
      expect(window.location.href).toContain("brandColor=%2523FF0000");
    });
  });

  describe("buildNavigationUrl", () => {
    it("adds brandColor and fragment params from a color-led hash", () => {
      setLocation("?x-blocks-key=pk", "#00AA11&state=s1");
      const url = buildNavigationUrl("/oidc/consent");
      expect(url.startsWith("/oidc/consent?")).toBe(true);
      expect(url).toContain("x-blocks-key=pk");
      expect(url).toContain("state=s1");
      expect(url).toContain("brandColor=%252300AA11");
    });

    it("recovers brandColor from the full URL when it is not already a param", () => {
      setLocation("", "#state=only", "http://localhost:3000/oidc/login?brandColor=445566");
      const url = buildNavigationUrl("/oidc/callback");
      expect(url).toContain("state=only");
      expect(url).toContain("brandColor=445566");
    });

    it("re-encodes a #-prefixed brandColor coming from the query string", () => {
      setLocation("?brandColor=%23ABCDEF", "");
      const url = buildNavigationUrl("/oidc/consent");
      expect(url).toContain("brandColor=%2523ABCDEF");
    });
  });
});
