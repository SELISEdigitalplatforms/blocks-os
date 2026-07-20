import { afterEach, describe, expect, it } from "vitest";
import { getApiPath, getApiUrl, getBlocksOidcWellKnownUrl } from "./get-api-path";

type BlocksWindow = Window & {
  __BLOCKS_ENV__?: Record<string, string | undefined>;
};

describe("get-api-path", () => {
  afterEach(() => {
    delete (window as BlocksWindow).__BLOCKS_ENV__;
  });

  it("getApiPath always returns the /api prefix", () => {
    expect(getApiPath("iam")).toBe("/api");
    expect(getApiPath("anything")).toBe("/api");
  });

  it("getApiUrl builds a url from the IAM base url", () => {
    (window as BlocksWindow).__BLOCKS_ENV__ = {
      BLOCKS_IAM_BASE_URL: "https://iam.base",
    };
    expect(getApiUrl("iam", "users")).toBe("https://iam.base/api/users");
  });

  it("getBlocksOidcWellKnownUrl strips a trailing slash from the base", () => {
    (window as BlocksWindow).__BLOCKS_ENV__ = {
      BLOCKS_IAM_BASE_URL: "https://iam.base/",
    };
    expect(getBlocksOidcWellKnownUrl("proj-1")).toBe(
      "https://iam.base/proj-1/.well-known/openid-configuration",
    );
  });
});
