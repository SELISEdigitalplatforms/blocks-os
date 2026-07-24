import { afterEach, describe, expect, it } from "vitest";
import { getDefaultShortUrlBase, isValidUrl, magicUrlSchema } from "./url.util";

type BlocksWindow = Window & {
  __BLOCKS_ENV__?: Record<string, string | undefined>;
};

const setRuntimeEnv = (value: string | undefined) => {
  (window as BlocksWindow).__BLOCKS_ENV__ = { BLOCKS_OS_BASE_URL: value };
};

describe("url.util", () => {
  afterEach(() => {
    delete (window as BlocksWindow).__BLOCKS_ENV__;
  });

  describe("getDefaultShortUrlBase", () => {
    it("returns the dev short base when the api base points at dev", () => {
      setRuntimeEnv("https://dev-api.seliseblocks.com");
      expect(getDefaultShortUrlBase()).toBe("https://dev-short.seliseblocks.com/");
    });

    it("returns the staging short base for a stg api base", () => {
      setRuntimeEnv("https://stg-api.seliseblocks.com");
      expect(getDefaultShortUrlBase()).toBe("https://stg-short.seliseblocks.com/");
    });

    it("falls back to prod when no non-prod env matches", () => {
      setRuntimeEnv("https://api.seliseblocks.com");
      expect(getDefaultShortUrlBase()).toBe("https://short.seliseblocks.com/");
    });

    it("falls back to prod when the env is empty", () => {
      setRuntimeEnv("");
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
