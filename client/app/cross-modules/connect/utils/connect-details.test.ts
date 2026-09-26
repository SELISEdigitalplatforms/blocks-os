import { describe, expect, it } from "vitest";
import { resolveProjectDomain, toConnectJson } from "./connect-details";

describe("toConnectJson", () => {
  it("emits exactly the five connection fields", () => {
    const json = JSON.parse(
      toConnectJson({
        clientId: "client-1",
        clientSecret: "blxk_secret",
        xBlocksKey: "tenant-1",
        baseUrl: "https://localization.example.com",
        domain: "app.example.com",
      }),
    );

    expect(json).toEqual({
      clientId: "client-1",
      clientSecret: "blxk_secret",
      "x-blocks-key": "tenant-1",
      baseUrl: "https://localization.example.com",
      domain: "app.example.com",
    });
  });
});

describe("resolveProjectDomain", () => {
  it("prefers the custom domain", () => {
    expect(
      resolveProjectDomain({ customDomain: "custom.com", applications: [{ domain: "app.com" }] }),
    ).toBe("custom.com");
  });

  it("falls back to the first application domain, then empty", () => {
    expect(
      resolveProjectDomain({ customDomain: null, applications: [{ domain: "app.com" }] }),
    ).toBe("app.com");
    expect(resolveProjectDomain(null)).toBe("");
  });
});
