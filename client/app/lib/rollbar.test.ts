import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildRollbarConfig, getRollbar } from "./rollbar";

type BlocksWindow = Window & {
  __BLOCKS_ENV__?: Record<string, string | undefined>;
};

const runtimeEnv = () => {
  const browserWindow = window as BlocksWindow;
  browserWindow.__BLOCKS_ENV__ ??= {};
  return browserWindow.__BLOCKS_ENV__;
};

describe("buildRollbarConfig", () => {
  let original: Record<string, string | undefined>;

  beforeEach(() => {
    original = { ...runtimeEnv() };
  });

  afterEach(() => {
    (window as BlocksWindow).__BLOCKS_ENV__ = original;
  });

  it("stays disabled until a client token is seeded", () => {
    runtimeEnv().BLOCKS_ROLLBAR_CLIENT_TOKEN = "";

    expect(buildRollbarConfig()).toMatchObject({ accessToken: "", enabled: false });
  });

  it("treats an unreplaced placeholder as unconfigured", () => {
    runtimeEnv().BLOCKS_ROLLBAR_CLIENT_TOKEN = "__BLOCKS_ROLLBAR_CLIENT_TOKEN__";

    expect(buildRollbarConfig().enabled).toBe(false);
  });

  it("enables reporting once a token is present", () => {
    runtimeEnv().BLOCKS_ROLLBAR_CLIENT_TOKEN = "client-token";

    expect(buildRollbarConfig()).toMatchObject({
      accessToken: "client-token",
      enabled: true,
      captureUncaught: true,
      captureUnhandledRejections: true,
    });
  });

  it("uses the seeded environment name", () => {
    runtimeEnv().BLOCKS_ROLLBAR_ENV = "stg";

    expect(buildRollbarConfig().environment).toBe("stg");
  });

  it("falls back to 'unknown' rather than reporting into an unnamed environment", () => {
    runtimeEnv().BLOCKS_ROLLBAR_ENV = "";

    expect(buildRollbarConfig().environment).toBe("unknown");
  });

  it("warns when an environment is named but its token was never seeded", () => {
    runtimeEnv().BLOCKS_ROLLBAR_ENV = "dev";
    runtimeEnv().BLOCKS_ROLLBAR_CLIENT_TOKEN = "";
    const reported = vi.spyOn(console, "error").mockImplementation(() => {});

    getRollbar();

    expect(reported).toHaveBeenCalledWith(expect.stringContaining("OFF for environment \"dev\""));
    reported.mockRestore();
  });

  it("scrubs the platform's own credential fields", () => {
    const { scrubFields } = buildRollbarConfig();

    expect(scrubFields).toEqual(
      expect.arrayContaining(["x-blocks-key", "Authorization", "refreshToken"]),
    );
  });
});
