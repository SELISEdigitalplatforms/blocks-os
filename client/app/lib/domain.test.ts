import { afterEach, describe, expect, it, vi } from "vitest";
import {
  isValidDomain,
  isValidSubdomain,
  getDomain,
  getSubdomain,
  getProjectBlocksApiUrl,
} from "./domain";
import type { IProject } from "@/models/project.model";

describe("lib/domain", () => {
  describe("isValidDomain", () => {
    it("accepts fully-qualified http(s) domains", () => {
      expect(isValidDomain("https://example.com")).toBe(true);
      expect(isValidDomain("http://sub.example.co.uk")).toBe(true);
    });
    it("trims surrounding whitespace before validating", () => {
      expect(isValidDomain("  https://example.com  ")).toBe(true);
    });
    it("rejects domains without a protocol", () => {
      expect(isValidDomain("example.com")).toBe(false);
    });
    it("rejects domains without a TLD", () => {
      expect(isValidDomain("https://localhost")).toBe(false);
    });
  });

  describe("isValidSubdomain", () => {
    it("returns false for empty input", () => {
      expect(isValidSubdomain("")).toBe(false);
    });
    it("accepts a valid protocol-prefixed subdomain label", () => {
      expect(isValidSubdomain("https://app")).toBe(true);
    });
    it("accepts a protocol-prefixed multi-label host", () => {
      expect(isValidSubdomain("https://app.example.com")).toBe(true);
    });
    it("accepts a deeply nested protocol-prefixed host", () => {
      expect(isValidSubdomain("https://a.b.c.example.com")).toBe(true);
    });
    it("trims surrounding whitespace before validating", () => {
      expect(isValidSubdomain("  https://app.example.com  ")).toBe(true);
    });
    it("rejects a host without a protocol scheme", () => {
      expect(isValidSubdomain("app.example.com")).toBe(false);
    });
    it("rejects a host with a trailing dot", () => {
      expect(isValidSubdomain("https://app.example.com.")).toBe(false);
    });
    it("rejects labels that start with a hyphen", () => {
      expect(isValidSubdomain("https://-bad")).toBe(false);
    });
  });

  describe("getDomain", () => {
    it("returns the registrable domain of a valid url", () => {
      expect(getDomain("https://sub.example.com")).toBe("example.com");
    });
    it("returns an empty string for an invalid url", () => {
      expect(getDomain("not-a-url")).toBe("");
    });
    it("defaults to an empty string with no argument", () => {
      expect(getDomain()).toBe("");
    });
  });

  describe("getSubdomain", () => {
    it("returns the protocol-prefixed subdomain", () => {
      expect(getSubdomain("https://app.example.com")).toBe("https://app");
    });
    it("returns empty when there is no subdomain", () => {
      expect(getSubdomain("https://example.com")).toBe("");
    });
    it("returns empty for an invalid url", () => {
      expect(getSubdomain("nope")).toBe("");
    });
    it("returns empty for empty input", () => {
      expect(getSubdomain("")).toBe("");
    });
  });

  describe("getProjectBlocksApiUrl", () => {
    afterEach(() => {
      vi.unstubAllEnvs();
    });

    it("returns empty when no project is supplied", () => {
      expect(getProjectBlocksApiUrl(undefined)).toBe("");
    });

    it("returns empty when the base url env is not set", () => {
      vi.stubEnv("VITE_PROJECT_DEFAULT_API_BASE_URL", "");
      expect(getProjectBlocksApiUrl({ customDomain: "" } as IProject)).toBe("");
    });

    it("returns the base url when there is no custom domain", () => {
      vi.stubEnv("VITE_PROJECT_DEFAULT_API_BASE_URL", "https://base.api");
      expect(getProjectBlocksApiUrl({ customDomain: "" } as IProject)).toBe(
        "https://base.api",
      );
    });

    it("derives a blocksapi host from the custom domain", () => {
      vi.stubEnv("VITE_PROJECT_DEFAULT_API_BASE_URL", "https://base.api");
      expect(
        getProjectBlocksApiUrl({
          customDomain: "https://portal.acme.com",
        } as IProject),
      ).toBe("blocksapi.acme.com");
    });
  });
});
