import { afterEach, describe, expect, it } from "vitest";
import { stubOrigin } from "@/test-utils/stub-origin";
import { getServiceBaseUrl, getServiceSwaggerUrl } from "./service-swagger";

type BlocksWindow = Window & { __BLOCKS_ENV__?: Record<string, string | undefined> };

describe("service-swagger", () => {
  let restoreOrigin: (() => void) | undefined;

  afterEach(() => {
    delete (window as BlocksWindow).__BLOCKS_ENV__;
    restoreOrigin?.();
    restoreOrigin = undefined;
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
        BLOCKS_LOGIC_BASE_URL: "https://logic.env",
      };
      expect(getServiceBaseUrl("blocks-logic", "/relative/path")).toBe("https://logic.env");
    });

    it("resolves blocks-os to the serving origin rather than the injected env", () => {
      restoreOrigin = stubOrigin("https://dev-os-546.blocksdevelopers.com/app/console");
      (window as BlocksWindow).__BLOCKS_ENV__ = {
        BLOCKS_OS_BASE_URL: "https://dev-os.blocksdevelopers.com:5000",
      };
      expect(getServiceSwaggerUrl("blocks-os")).toBe(
        "https://dev-os-546.blocksdevelopers.com/swagger/index.html",
      );
    });
  });

  describe("services behind a feature setting", () => {
    it("gives no agents or Studio link while their features are off", () => {
      (window as BlocksWindow).__BLOCKS_ENV__ = {
        BLOCKS_AGENTS_BASE_URL: "https://agents.env",
        BLOCKS_STUDIO_BASE_URL: "https://studio.env",
      };
      expect(getServiceSwaggerUrl("blocks-agents")).toBe("");
      expect(getServiceSwaggerUrl("blocks-studio")).toBe("");
      expect(getServiceSwaggerUrl("blocks-agents", "https://agents.example.com")).toBe("");
    });

    it("gives the agents and Studio links when their features are on", () => {
      (window as BlocksWindow).__BLOCKS_ENV__ = {
        BLOCKS_AGENTS_BASE_URL: "https://agents.env",
        BLOCKS_STUDIO_BASE_URL: "https://studio.env/",
        BLOCKS_FEATURE_AGENTS: "true",
        BLOCKS_FEATURE_STUDIO: "true",
      };
      expect(getServiceSwaggerUrl("blocks-agents")).toBe("https://agents.env/swagger/index.html");
      expect(getServiceSwaggerUrl("blocks-studio")).toBe("https://studio.env/swagger/index.html");
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
