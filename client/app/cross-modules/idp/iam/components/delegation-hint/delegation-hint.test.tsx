import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({ isRestricted: false }));
vi.mock("@blocks-idp/iam/hooks/use-delegation-scope", () => ({
  useDelegationScope: () => ({ isRestricted: h.isRestricted }),
}));

import { DelegationHint } from "./delegation-hint";

describe("DelegationHint", () => {
  beforeEach(() => {
    h.isRestricted = false;
  });

  it("says nothing to the system user", () => {
    const { container } = render(<DelegationHint kind="roles" />);
    expect(container.textContent).toBe("");
  });

  it("explains assignable roles to a limited caller", () => {
    h.isRestricted = true;
    render(<DelegationHint kind="roles" />);
    expect(screen.getByTestId("delegation-hint-roles").textContent).toBe(
      "You can assign roles whose permissions you hold.",
    );
  });

  it("explains grantable permissions to a limited caller", () => {
    h.isRestricted = true;
    render(<DelegationHint kind="permissions" />);
    expect(screen.getByTestId("delegation-hint-permissions").textContent).toBe(
      "You can grant only permissions you hold.",
    );
  });
});
