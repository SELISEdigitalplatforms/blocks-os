import { describe, expect, it } from "vitest";
import { providers } from "./git-dummy";

describe("git-dummy providers", () => {
  it("lists the known git providers", () => {
    expect(providers.map((p) => p.id)).toEqual([
      "github",
      "gitlab",
      "bitbucket",
      "azure",
      "aws",
    ]);
  });

  it("marks only GitHub as active", () => {
    const active = providers.filter((p) => p.active);
    expect(active).toHaveLength(1);
    expect(active[0].id).toBe("github");
    expect(active[0].name).toBe("GitHub");
  });
});
