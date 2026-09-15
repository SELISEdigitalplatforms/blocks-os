import { afterEach, describe, expect, it } from "vitest";
import { stubOrigin } from "@/test-utils/stub-origin";
import { getDefaultShortUrlBase, isValidUrl, magicUrlSchema } from "./url.util";

type BlocksWindow = Window & {
  __BLOCKS_ENV__?: Record<string, string | undefined>;
};

describe("url.util", () => {
  let restoreOrigin: (() => void) | undefined;

  afterEach(() => {
    delete (window as BlocksWindow).__BLOCKS_ENV__;
    restoreOrigin?.();
    restoreOrigin = undefined;
  });

  // `getDefaultShortUrlBase` sniffs the environment out of the OS base URL, which now resolves to
  // the origin serving the app -- so these drive it through `window.location`, not the env.
  describe("getDefaultShortUrlBase", () => {
    it("returns the dev short base when served from a dev host", () => {
      restoreOrigin = stubOrigin("https://dev-os.blocksdevelopers.com");
      expect(getDefaultShortUrlBase()).toBe("https://dev-short.seliseblocks.com/");
    });

    it("returns the dev short base when served from a numbered dev preview host", () => {
      restoreOrigin = stubOrigin("https://dev-os-546.blocksdevelopers.com");
      expect(getDefaultShortUrlBase()).toBe("https://dev-short.seliseblocks.com/");
    });

    it("returns the staging short base when served from a stg host", () => {
      restoreOrigin = stubOrigin("https://stg-os.blocksdevelopers.com");
      expect(getDefaultShortUrlBase()).toBe("https://stg-short.seliseblocks.com/");
    });

    it("falls back to prod when no non-prod env matches", () => {
      restoreOrigin = stubOrigin("https://os.seliseblocks.com");
      expect(getDefaultShortUrlBase()).toBe("https://short.seliseblocks.com/");
    });

    // `blocksdevelopers.com` contains "dev", so a substring match over the whole URL sent every
    // stage host to the dev short base.
    it("does not treat the blocksdevelopers.com domain itself as the dev env", () => {
      restoreOrigin = stubOrigin("https://stg-os-546.blocksdevelopers.com");
      expect(getDefaultShortUrlBase()).toBe("https://stg-short.seliseblocks.com/");
    });

    it("uses the dev base for local development", () => {
      restoreOrigin = stubOrigin("https://localhost:5000");
      expect(getDefaultShortUrlBase()).toBe("https://dev-short.seliseblocks.com/");
    });

    // An opaque origin ("null") is not a usable base, so resolution falls through to the injected
    // env -- which is empty here, leaving nothing to parse.
    it("falls back to prod when no base url can be resolved", () => {
      (window as BlocksWindow).__BLOCKS_ENV__ = { BLOCKS_OS_BASE_URL: "" };
      restoreOrigin = stubOrigin("about:blank");
      expect(getDefaultShortUrlBase()).toBe("https://short.seliseblocks.com/");
    });
  });

  describe("isValidUrl", () => {
    it("accepts http and https urls", () => {
      expect(isValidUrl("https://example.com")).toBe(true);
      expect(isValidUrl("http://example.com/path")).toBe(true);
    });
    it("rejects non-http protocols", () => {
      expect(isValidUrl("ftp://example.com")).toBe(false);
    });
    it("rejects malformed urls", () => {
      expect(isValidUrl("not a url")).toBe(false);
    });
  });

  describe("magicUrlSchema", () => {
    it("accepts a valid uri and name", () => {
      const result = magicUrlSchema.safeParse({
        uri: "https://example.com",
        name: "My link",
      });
      expect(result.success).toBe(true);
    });

    it("rejects an empty name", () => {
      const result = magicUrlSchema.safeParse({ uri: "example.com", name: "" });
      expect(result.success).toBe(false);
    });

    it("rejects an invalid uri", () => {
      const result = magicUrlSchema.safeParse({ uri: "!!!", name: "ok" });
      expect(result.success).toBe(false);
    });
  });
});
