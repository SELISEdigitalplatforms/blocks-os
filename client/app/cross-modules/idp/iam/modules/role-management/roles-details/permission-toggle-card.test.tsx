import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({ isEditMode: true, grantable: null as Set<string> | null }));

// Tooltip re-exports blocks-kit (process.env at load); passthrough keeps it renderable.
vi.mock("@/components/ui-kits/tooltip/tooltip", () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipContent: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock("./role-details-state", () => ({
  useRoleDetailsStore: (
    selector: (s: { isEditMode: boolean; grantableResources: Set<string> | null }) => unknown,
  ) => selector({ isEditMode: h.isEditMode, grantableResources: h.grantable }),
}));

import { PermissionToggleCard } from "./permission-toggle-card";

const permission = (over: Record<string, unknown> = {}) =>
  ({
    name: "Read users",
    resource: "users:read",
    description: "Allows reading users",
    permissionSeverity: 1,
    type: 1,
    ...over,
  }) as never;

const GRANT_REASON = "Your role doesn't have this permission.";

describe("PermissionToggleCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.isEditMode = true;
    h.grantable = null;
  });

  it("renders the permission name and description", () => {
    render(<PermissionToggleCard permission={permission()} checked={false} id="p1" />);
    expect(screen.getByText("Read users")).toBeTruthy();
    expect(screen.getByText("Allows reading users")).toBeTruthy();
  });

  it("shows a fallback description when none is provided", () => {
    render(<PermissionToggleCard permission={permission({ description: "" })} checked={false} id="p1" />);
    expect(screen.getByText("No description available.")).toBeTruthy();
  });

  it("enables the checkbox in edit mode and fires onCheckedChange", async () => {
    const onCheckedChange = vi.fn();
    const user = userEvent.setup();
    render(
      <PermissionToggleCard
        permission={permission()}
        checked={false}
        id="p1"
        onCheckedChange={onCheckedChange}
      />,
    );
    await user.click(screen.getByRole("checkbox"));
    expect(onCheckedChange).toHaveBeenCalled();
  });

  it("disables the checkbox when not in edit mode", () => {
    h.isEditMode = false;
    render(<PermissionToggleCard permission={permission()} checked id="p1" />);
    expect((screen.getByRole("checkbox") as HTMLButtonElement).disabled).toBe(true);
  });

  it("shows a satisfied badge when all dependent permissions are checked", () => {
    render(
      <PermissionToggleCard
        permission={permission()}
        checked
        id="p1"
        hasDependentPermissions
        isAllDependentPermissionsChecked
      />,
    );
    expect(screen.getByText("All dependent permissions are selected")).toBeTruthy();
  });

  it("shows a warning badge when dependent permissions are missing", () => {
    render(
      <PermissionToggleCard
        permission={permission()}
        checked
        id="p1"
        hasDependentPermissions
        isAllDependentPermissionsChecked={false}
      />,
    );
    expect(screen.getByText("One or more dependent permissions are missing")).toBeTruthy();
  });

  describe("a permission the caller does not hold", () => {
    it("is locked in edit mode with the reason shown", () => {
      h.grantable = new Set(["other:read"]);
      render(<PermissionToggleCard permission={permission()} checked={false} id="p1" />);
      expect((screen.getByRole("checkbox") as HTMLButtonElement).disabled).toBe(true);
      expect(screen.getByText(GRANT_REASON)).toBeTruthy();
    });

    it("stays locked when it is already checked, because removing it is a grant too", () => {
      h.grantable = new Set();
      render(<PermissionToggleCard permission={permission()} checked id="p1" />);
      expect((screen.getByRole("checkbox") as HTMLButtonElement).disabled).toBe(true);
    });

    it("can be toggled when the caller holds it", () => {
      h.grantable = new Set(["users:read"]);
      render(<PermissionToggleCard permission={permission()} checked={false} id="p1" />);
      expect((screen.getByRole("checkbox") as HTMLButtonElement).disabled).toBe(false);
      expect(screen.queryByText(GRANT_REASON)).toBeNull();
    });

    it("shows no reason outside edit mode", () => {
      h.isEditMode = false;
      h.grantable = new Set();
      render(<PermissionToggleCard permission={permission()} checked id="p1" />);
      expect(screen.queryByText(GRANT_REASON)).toBeNull();
    });
  });
});
