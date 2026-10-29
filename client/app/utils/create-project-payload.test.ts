import { describe, expect, it } from "vitest";
import { buildCreateProjectPayload } from "./create-project-payload";

describe("buildCreateProjectPayload", () => {
  it("matches the payload the wizard's inline code produced", () => {
    const payload = buildCreateProjectPayload({
      name: "My Project",
      isAcceptBlocksTerms: true,
      isUseBlocksExclusively: true,
      environments: [{ value: "dev" }, { value: "prod" }],
      assets: [{ full_name: "acme/api", html_url: "https://github.com/acme/api", id: 42 }],
      baseDomain: "blocks.example.com",
      shortGuid: "abcde",
    });

    expect(payload).toEqual({
      name: "My Project",
      isAcceptBlocksTerms: true,
      isUseBlocksExclusively: true,
      resources: [{ name: "acme/api", link: "https://github.com/acme/api", resourceId: "42" }],
      applicationContexts: [
        { environment: "dev", domain: "https://dev-abcde.blocks.example.com", cookieDomain: "blocks.example.com" },
        { environment: "prod", domain: "https://prod-abcde.blocks.example.com", cookieDomain: "blocks.example.com" },
      ],
    });
  });

  it("keeps the wizard's exact domain derivation for main", () => {
    const payload = buildCreateProjectPayload({
      name: "P",
      isAcceptBlocksTerms: true,
      isUseBlocksExclusively: false,
      environments: [{ value: "main" }],
      baseDomain: "blocks.example.com",
      shortGuid: "abcde",
    });

    // Not a typo: the wizard's inline code produces "-abcde" for main (empty prefix, kept
    // dash). The builder must match it exactly; changing it would alter server data.
    expect(payload.applicationContexts[0].domain).toBe("https://-abcde.blocks.example.com");
  });

  it("maps missing asset ids to an empty resourceId and defaults assets to none", () => {
    const payload = buildCreateProjectPayload({
      name: "P",
      isAcceptBlocksTerms: true,
      isUseBlocksExclusively: true,
      environments: [{ value: "dev" }],
      assets: [{ full_name: "acme/api", html_url: "https://github.com/acme/api" }],
      baseDomain: "blocks.example.com",
      shortGuid: "abcde",
    });

    expect(payload.resources).toEqual([{ name: "acme/api", link: "https://github.com/acme/api", resourceId: "" }]);
    expect(buildCreateProjectPayload({
      name: "P",
      isAcceptBlocksTerms: true,
      isUseBlocksExclusively: true,
      environments: [{ value: "dev" }],
      baseDomain: "blocks.example.com",
      shortGuid: "abcde",
    }).resources).toEqual([]);
  });
});
