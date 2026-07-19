import { afterEach, describe, expect, it } from "vitest";
import { getServiceBaseUrl, getServiceSwaggerUrl } from "./service-swagger";

type BlocksWindow = Window & { __BLOCKS_ENV__?: Record<string, string | undefined> };

describe("service-swagger", () => {
  afterEach(() => {
    delete (window as BlocksWindow).__BLOCKS_ENV__;
  });

  describe("getServiceBaseUrl", () => {
    it("prefers an absolute endpoint base url and trims trailing slashes", () => {
      expect(getServiceBaseUrl("blocks-iam", "https://iam.example.com/")).toBe(
        "https://iam.example.com",
      );
    });

    it("resolves a known service from the runtime env, stripping the blocks- prefix", () => {
      (window as BlocksWindow).__BLOCKS_ENV__ = {
        BLOCKS_IAM_BASE_URL: "https://iam.env/",
      };
      expect(getServiceBaseUrl("blocks-iam")).toBe("https://iam.env");
    });

    it("returns an empty string for an unknown service", () => {
      expect(getServiceBaseUrl("blocks-unknown")).toBe("");
    });

    it("ignores a non-absolute baseUrl and falls back to env resolution", () => {
      (window as BlocksWindow).__BLOCKS_ENV__ = {
        BLOCKS_OS_BASE_URL: "https://os.env",
      };
      expect(getServiceBaseUrl("blocks-os", "/relative/path")).toBe("https://os.env");
    });
  });

  describe("getServiceSwaggerUrl", () => {
    it("appends the swagger path when a base url resolves", () => {
      expect(getServiceSwaggerUrl("iam", "https://iam.example.com")).toBe(
        "https://iam.example.com/swagger/index.html",
      );
    });

    it("returns an empty string when the base url cannot be resolved", () => {
      expect(getServiceSwaggerUrl("unknown-service")).toBe("");
    });
  });
});
