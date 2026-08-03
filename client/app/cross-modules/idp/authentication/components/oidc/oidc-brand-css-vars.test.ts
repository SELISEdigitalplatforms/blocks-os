import { describe, expect, it } from "vitest";
import { buildOidcBrandCssVars } from "./oidc-brand-css-vars";

describe("buildOidcBrandCssVars", () => {
  it("builds the full set of accent variables from a valid hex color", () => {
    const vars = buildOidcBrandCssVars("#124091") as Record<string, string>;
    expect(vars["--accent"]).toBe("#124091");
    expect(vars["--accent2"]).toMatch(/^#[0-9a-f]{6}$/);
    expect(vars["--accent-glow"]).toContain("rgba(");
    expect(vars["--accent-soft"]).toContain("0.1");
    expect(vars["--accent-softer"]).toContain("0.06");
  });

  it("falls back to the default brand color when the input is empty", () => {
    const vars = buildOidcBrandCssVars("") as Record<string, string>;
    expect(vars["--accent"]).toBe("#124091");
  });

  it("falls back to the default brand color for an invalid hex", () => {
    const vars = buildOidcBrandCssVars("not-a-color") as Record<string, string>;
    expect(vars["--accent"]).toBe("#124091");
    // invalid input returns only the accent fallback, no derived variables
    expect(vars["--accent2"]).toBeUndefined();
  });

  it("handles a null input", () => {
    const vars = buildOidcBrandCssVars(null) as Record<string, string>;
    expect(vars["--accent"]).toBe("#124091");
  });

  it("lightens the accent2 towards white", () => {
    const vars = buildOidcBrandCssVars("#000000") as Record<string, string>;
    // 15% towards white from black -> around #262626
    expect(vars["--accent2"]).toBe("#262626");
  });
});
