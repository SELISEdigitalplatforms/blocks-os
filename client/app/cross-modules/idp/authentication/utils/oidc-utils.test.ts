import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { extractOIDCParams, buildOIDCNavigationUrl, getCurrentOIDCParams } from "./oidc-utils";

describe("oidc-utils", () => {
  beforeEach(() => {
    // Reset window.location to a clean state
    Object.defineProperty(window, "location", {
      value: {
        search: "",
        hash: "",
        href: "http://localhost:3000/oidc/login",
      },
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ─── extractOIDCParams ──────────────────────────────────────────────────────
  describe("extractOIDCParams", () => {
    it("should return default themeColor when no params present", () => {
      const params = extractOIDCParams();
      expect(params.themeColor).toBe("#124091");
    });

    it("should extract params from query string", () => {
      Object.defineProperty(window, "location", {
        value: {
          search:
            "?x-blocks-key=test-key&userName=testuser&clientId=client-123&brandColor=%23FF0000",
          hash: "",
          href: "http://localhost:3000/oidc/login?x-blocks-key=test-key&userName=testuser&clientId=client-123&brandColor=%23FF0000",
        },
        writable: true,
        configurable: true,
      });

      const params = extractOIDCParams();
      expect(params.projectKey).toBe("test-key");
      expect(params.userName).toBe("testuser");
      expect(params.clientId).toBe("client-123");
      expect(params.themeColor).toBe("#FF0000");
    });

    it("should extract color from hash fragment when brandColor is a hex color", () => {
      Object.defineProperty(window, "location", {
        value: {
          search: "?x-blocks-key=test-key",
          hash: "#124091&logoUrl=https://cdn.test.com/logo.png",
          href: "http://localhost:3000/oidc/login?x-blocks-key=test-key#124091&logoUrl=https://cdn.test.com/logo.png",
        },
        writable: true,
        configurable: true,
      });

      const params = extractOIDCParams();
      expect(params.themeColor).toBe("#124091");
      expect(params.logoUrl).toBe("https://cdn.test.com/logo.png");
    });

    it("should extract OIDC params from hash fragment", () => {
      Object.defineProperty(window, "location", {
        value: {
          search: "",
          hash: "#124091&state=abc&nonce=def&scope=openid%20profile&redirect_uri=https://app.test.com/callback",
          href: "http://localhost:3000/oidc/login#124091&state=abc&nonce=def&scope=openid%20profile&redirect_uri=https://app.test.com/callback",
        },
        writable: true,
        configurable: true,
      });

      const params = extractOIDCParams();
      expect(params.state).toBe("abc");
      expect(params.nonce).toBe("def");
      expect(params.scope).toBe("openid profile");
      expect(params.redirectUri).toBe("https://app.test.com/callback");
    });

    it("should prefer query params over hash params", () => {
      Object.defineProperty(window, "location", {
        value: {
          search: "?clientId=from-query",
          hash: "#clientId=from-hash",
          href: "http://localhost:3000/oidc/login?clientId=from-query#clientId=from-hash",
        },
        writable: true,
        configurable: true,
      });

      const params = extractOIDCParams();
      expect(params.clientId).toBe("from-query");
    });

    it("falls back to the brandColor found in the full URL", () => {
      Object.defineProperty(window, "location", {
        value: {
          search: "?brandColor=",
          hash: "",
          href: "http://localhost:3000/oidc/login?brandColor=aa1122&other=1",
        },
        writable: true,
        configurable: true,
      });
      expect(extractOIDCParams().themeColor).toBe("#aa1122");
    });

    it("recognizes a hash color even when the remainder is not ampersand separated", () => {
      Object.defineProperty(window, "location", {
        value: {
          search: "",
          hash: "#aabbccclientId=z",
          href: "http://localhost:3000/oidc/login#aabbccclientId=z",
        },
        writable: true,
        configurable: true,
      });
      expect(extractOIDCParams().themeColor).toBe("#aabbcc");
    });

    it("recovers a logoUrl found only in the full URL", () => {
      Object.defineProperty(window, "location", {
        value: {
          search: "",
          hash: "",
          href: "http://localhost:3000/oidc/login?x=1&logoUrl=https%3A%2F%2Fcdn%2Ff.png",
        },
        writable: true,
        configurable: true,
      });
      expect(extractOIDCParams().logoUrl).toBe("https://cdn/f.png");
    });

    it("fully decodes a multiply-encoded logoUrl", () => {
      Object.defineProperty(window, "location", {
        value: {
          search: "?logoUrl=https%253A%252F%252Fcdn%252Fl.png",
          hash: "",
          href: "http://localhost:3000/oidc/login?logoUrl=https%253A%252F%252Fcdn%252Fl.png",
        },
        writable: true,
        configurable: true,
      });
      expect(extractOIDCParams().logoUrl).toBe("https://cdn/l.png");
    });
  });

  // ─── buildOIDCNavigationUrl ─────────────────────────────────────────────────
  describe("buildOIDCNavigationUrl", () => {
    it("should build URL with current OIDC params", () => {
      Object.defineProperty(window, "location", {
        value: {
          search: "?x-blocks-key=test-key&clientId=client-123&brandColor=%23FF0000",
          hash: "",
          href: "http://localhost:3000/oidc/login?x-blocks-key=test-key&clientId=client-123&brandColor=%23FF0000",
        },
        writable: true,
        configurable: true,
      });

      const url = buildOIDCNavigationUrl("/oidc/consent");
      expect(url).toContain("/oidc/consent?");
      expect(url).toContain("x-blocks-key=test-key");
      expect(url).toContain("clientId=client-123");
    });

    it("should return plain path when no OIDC params exist", () => {
      const url = buildOIDCNavigationUrl("/oidc/login");
      expect(url).toContain("/oidc/login");
    });
  });

  // ─── getCurrentOIDCParams ───────────────────────────────────────────────────
  describe("getCurrentOIDCParams", () => {
    it("should return URLSearchParams with current OIDC params", () => {
      Object.defineProperty(window, "location", {
        value: {
          search: "?x-blocks-key=test-key&state=abc",
          hash: "",
          href: "http://localhost:3000/oidc/login?x-blocks-key=test-key&state=abc",
        },
        writable: true,
        configurable: true,
      });

      const params = getCurrentOIDCParams();
      expect(params).toBeInstanceOf(URLSearchParams);
      expect(params.get("x-blocks-key")).toBe("test-key");
      expect(params.get("state")).toBe("abc");
    });

    it("should return empty URLSearchParams when no params exist", () => {
      const params = getCurrentOIDCParams();
      expect(params.toString()).toBe("brandColor=%23124091");
    });
  });
});
