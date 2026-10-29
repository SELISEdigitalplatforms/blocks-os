import { describe, expect, it } from "vitest";
import { resolveOnboardingGuide } from "./onboard-guide";

describe("resolveOnboardingGuide", () => {
  it("leaves no placeholder behind when the project is configured", () => {
    const { markdown } = resolveOnboardingGuide({ tenantId: "tenant-key-123" });
    expect(markdown).not.toMatch(/\{\{\w+\}\}/);
  });

  it("substitutes the key into the brief", () => {
    const { markdown } = resolveOnboardingGuide({ tenantId: "tenant-key-123" });
    expect(markdown).toContain("project tenant-key-123");
    expect(markdown).toContain(
      "https://raw.githubusercontent.com/SELISEdigitalplatforms/blocks-skills/main/BOOTSTRAP.md",
    );
  });

  it("trims whitespace around the key", () => {
    const { values } = resolveOnboardingGuide({ tenantId: "  tenant-key-123  " });
    expect(values.X_BLOCKS_KEY).toBe("tenant-key-123");
  });

  it("marks the key when the project has none", () => {
    const { markdown, values } = resolveOnboardingGuide({});
    expect(values.X_BLOCKS_KEY).toBe("");
    expect(markdown).toContain("<not configured>");
  });
});
