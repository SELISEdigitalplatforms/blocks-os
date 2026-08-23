import { describe, expect, it } from "vitest";
import {
  maskValue,
  onboardingFileName,
  resolveOnboardingGuide,
  revealKey,
  toHost,
} from "./onboard-guide";

const domain = {
  domain: "https://stg-a1b2c.seliseblocks.com",
  cookieDomain: "seliseblocks.com",
  isDomainVerified: true,
};

describe("resolveOnboardingGuide", () => {
  it("leaves no placeholder behind when the project is fully configured", () => {
    const { markdown } = resolveOnboardingGuide({ tenantId: "tenant-key-123", domain });
    expect(markdown).not.toMatch(/\{\{\w+\}\}/);
  });

  it("resolves every value from the project and its domain", () => {
    const { values, missing } = resolveOnboardingGuide({ tenantId: "tenant-key-123", domain });
    expect(values).toEqual({
      X_BLOCKS_KEY: "tenant-key-123",
      APP_DOMAIN: "https://stg-a1b2c.seliseblocks.com",
      APP_HOST: "stg-a1b2c.seliseblocks.com",
      BLOCKS_API_URL: "https://blocksapi.seliseblocks.com",
    });
    expect(missing).toEqual([]);
  });

  it("substitutes the key into every command that needs it", () => {
    const { markdown } = resolveOnboardingGuide({ tenantId: "tenant-key-123", domain });
    expect(markdown).toContain("blocks use tenant-key-123");
    expect(markdown).toContain("--x-blocks-key tenant-key-123");
    expect(markdown).toContain(
      "--redirect-uris https://stg-a1b2c.seliseblocks.com:5173/login/callback",
    );
    expect(markdown).toContain("--blocks-api-url https://blocksapi.seliseblocks.com");
  });

  it("keeps the markdown syntax that has to be escaped inside the template literal", () => {
    const { markdown } = resolveOnboardingGuide({ tenantId: "tenant-key-123", domain });
    // Backticks: inline code and fenced blocks.
    expect(markdown).toContain("`npm install -g @seliseblocks/cli-os@latest`");
    expect(markdown).toContain("```bash");
    // Backslashes: shell line continuations must stay a backslash + newline.
    expect(markdown).toContain("blocks auth oidc-clients save \\\n");
    expect(markdown).toContain("blocks new web <appName> \\\n");
  });

  it("normalizes a domain stored without a protocol or with a trailing slash", () => {
    const { values } = resolveOnboardingGuide({
      tenantId: "key",
      domain: { ...domain, domain: "a1b2c.seliseblocks.com/" },
    });
    expect(values.APP_DOMAIN).toBe("https://a1b2c.seliseblocks.com");
    expect(values.APP_HOST).toBe("a1b2c.seliseblocks.com");
  });

  it("falls back to the last two labels of the host when no cookie domain is stored", () => {
    const { values } = resolveOnboardingGuide({
      tenantId: "key",
      domain: { ...domain, domain: "https://dqrsf.slsblx.com", cookieDomain: "" },
    });
    expect(values.BLOCKS_API_URL).toBe("https://blocksapi.slsblx.com");
  });

  it("reports what is missing and marks it in the markdown when no domain exists", () => {
    const { markdown, values, missing } = resolveOnboardingGuide({
      tenantId: "tenant-key-123",
      domain: null,
    });
    expect(missing).toEqual(["APP_DOMAIN", "APP_HOST", "BLOCKS_API_URL"]);
    expect(values.X_BLOCKS_KEY).toBe("tenant-key-123");
    expect(markdown).toContain("<not configured>");
  });

  it("masks the key in the markdown only, never in the returned values", () => {
    const { markdown, values } = resolveOnboardingGuide({
      tenantId: "tenant-key-123",
      domain,
      maskKey: true,
    });
    expect(values.X_BLOCKS_KEY).toBe("tenant-key-123");
    expect(markdown).not.toContain("tenant-key-123");
    expect(markdown).toContain(maskValue("tenant-key-123"));
  });
});

describe("revealKey", () => {
  it("swaps every masked occurrence back for the real key", () => {
    const masked = maskValue("tenant-key-123");
    expect(revealKey(`blocks use ${masked}`, masked, "tenant-key-123")).toBe(
      "blocks use tenant-key-123",
    );
  });

  it("leaves text untouched when there is nothing to reveal", () => {
    expect(revealKey("blocks login", "", "tenant-key-123")).toBe("blocks login");
  });
});

describe("maskValue", () => {
  it("keeps the first and last three characters visible", () => {
    expect(maskValue("abcdefghijklmnop")).toBe(`abc${"*".repeat(14)}nop`);
  });

  it("returns an empty string for an empty value", () => {
    expect(maskValue("")).toBe("");
  });
});

describe("toHost", () => {
  it("strips the protocol and trailing slashes", () => {
    expect(toHost(" https://example.com/ ")).toBe("example.com");
    expect(toHost("http://example.com")).toBe("example.com");
    expect(toHost("example.com")).toBe("example.com");
  });
});

describe("onboardingFileName", () => {
  it("slugs the project name", () => {
    expect(onboardingFileName("My Great App")).toBe("blocks-onboarding-my-great-app.md");
  });

  it("falls back when the name has nothing usable", () => {
    expect(onboardingFileName("  ")).toBe("blocks-onboarding-project.md");
  });
});
