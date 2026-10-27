import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({ isDescendant: false }));
vi.mock("@blocks-idp/iam/hooks/use-grant-scope", () => ({
  useGrantScope: () => ({ isDescendant: h.isDescendant }),
}));

import { GrantHint } from "./grant-hint";

describe("GrantHint", () => {
  beforeEach(() => {
    h.isDescendant = false;
  });

  it("says nothing to the system user or a top user", () => {
    const { container } = render(<GrantHint kind="roles" />);
    expect(container.textContent).toBe("");
  });

  it("explains assignable roles to a limited caller", () => {
    h.isDescendant = true;
    render(<GrantHint kind="roles" />);
    expect(screen.getByTestId("grant-hint-roles").textContent).toBe(
      "You can give only roles below your role.",
    );
  });

  it("explains grantable permissions to a limited caller", () => {
    h.isDescendant = true;
    render(<GrantHint kind="permissions" />);
    expect(screen.getByTestId("grant-hint-permissions").textContent).toBe(
      "Only a top admin can give permissions directly. Give a role instead.",
    );
  });
});
