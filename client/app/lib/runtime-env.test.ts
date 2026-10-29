import { afterEach, describe, expect, it } from "vitest";
import { stubOrigin } from "@/test-utils/stub-origin";
import { getRuntimeEnv } from "./runtime-env";

type BlocksWindow = Window & {
  __BLOCKS_ENV__?: Record<string, string | undefined>;
};

describe("getRuntimeEnv", () => {
  let restoreOrigin: (() => void) | undefined;

  afterEach(() => {
    delete (window as BlocksWindow).__BLOCKS_ENV__;
    restoreOrigin?.();
    restoreOrigin = undefined;
  });

  it("prefers a non-placeholder value from the loadEnv map", () => {
    expect(
      getRuntimeEnv("BLOCKS_IAM_BASE_URL", {
        BLOCKS_IAM_BASE_URL: "https://from-loadenv",
      }),
    ).toBe("https://from-loadenv");
  });

  it("ignores placeholder values in the loadEnv map and falls back to window", () => {
    (window as BlocksWindow).__BLOCKS_ENV__ = {
      BLOCKS_IAM_BASE_URL: "https://from-window",
    };
    expect(
      getRuntimeEnv("BLOCKS_IAM_BASE_URL", {
        BLOCKS_IAM_BASE_URL: "__BLOCKS_IAM_BASE_URL__",
      }),
    ).toBe("https://from-window");
  });

  it("reads from window.__BLOCKS_ENV__ when present", () => {
    (window as BlocksWindow).__BLOCKS_ENV__ = {
      BLOCKS_LOGIC_BASE_URL: "https://logic-base",
    };
    expect(getRuntimeEnv("BLOCKS_LOGIC_BASE_URL")).toBe("https://logic-base");
  });

  it("ignores placeholder window values", () => {
    (window as BlocksWindow).__BLOCKS_ENV__ = {
      BLOCKS_LOGIC_BASE_URL: "__BLOCKS_LOGIC_BASE_URL__",
    };
    expect(getRuntimeEnv("BLOCKS_LOGIC_BASE_URL")).toBe("");
  });

  it("returns an empty string when nothing resolves", () => {
    expect(getRuntimeEnv("BLOCKS_MONITOR_BASE_URL")).toBe("");
  });

  describe("self-referential keys", () => {
    it("resolves BLOCKS_OS_BASE_URL from the browser origin, not the injected value", () => {
      restoreOrigin = stubOrigin("https://dev-os-546.blocksdevelopers.com/app/console");
      (window as BlocksWindow).__BLOCKS_ENV__ = {
        BLOCKS_OS_BASE_URL: "https://dev-os.blocksdevelopers.com:5000",
      };
      expect(getRuntimeEnv("BLOCKS_OS_BASE_URL")).toBe("https://dev-os-546.blocksdevelopers.com");
    });

    it("keeps a non-default port and drops the path and query", () => {
      restoreOrigin = stubOrigin("https://localhost:5000/app/console?tab=1");
      expect(getRuntimeEnv("BLOCKS_OS_BASE_URL")).toBe("https://localhost:5000");
    });

    it("still resolves the origin when no runtime env was injected at all", () => {
      restoreOrigin = stubOrigin("https://dev-os-546.blocksdevelopers.com");
      expect(getRuntimeEnv("BLOCKS_OS_BASE_URL")).toBe("https://dev-os-546.blocksdevelopers.com");
    });

    it("leaves foreign-service keys resolving from the injected env", () => {
      restoreOrigin = stubOrigin("https://dev-os-546.blocksdevelopers.com");
      (window as BlocksWindow).__BLOCKS_ENV__ = {
        BLOCKS_IAM_BASE_URL: "https://dev-iam.blocksdevelopers.com",
      };
      expect(getRuntimeEnv("BLOCKS_IAM_BASE_URL")).toBe("https://dev-iam.blocksdevelopers.com");
    });

    it("prefers an explicit loadEnv value, so the Vite dev proxy keeps its configured target", () => {
      restoreOrigin = stubOrigin("https://localhost:5000");
      expect(
        getRuntimeEnv("BLOCKS_OS_BASE_URL", {
          BLOCKS_OS_BASE_URL: "https://dev-os.blocksdevelopers.com:5000",
        }),
      ).toBe("https://dev-os.blocksdevelopers.com:5000");
    });
  });
});
