import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({ isRestricted: false }));
vi.mock("@blocks-idp/iam/hooks/use-grant-scope", () => ({
  useGrantScope: () => ({ isRestricted: h.isRestricted }),
}));

import { GrantHint } from "./grant-hint";

describe("GrantHint", () => {
  beforeEach(() => {
    h.isRestricted = false;
  });

  it("says nothing to the system user", () => {
    const { container } = render(<GrantHint kind="roles" />);
    expect(container.textContent).toBe("");
  });

  it("explains assignable roles to a limited caller", () => {
    h.isRestricted = true;
    render(<GrantHint kind="roles" />);
    expect(screen.getByTestId("grant-hint-roles").textContent).toBe(
      "You can assign roles whose permissions you hold.",
    );
  });

  it("explains grantable permissions to a limited caller", () => {
    h.isRestricted = true;
    render(<GrantHint kind="permissions" />);
    expect(screen.getByTestId("grant-hint-permissions").textContent).toBe(
      "You can grant only permissions you hold.",
    );
  });
});
