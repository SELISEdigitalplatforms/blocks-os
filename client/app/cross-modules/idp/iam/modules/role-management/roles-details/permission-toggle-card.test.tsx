import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({ isEditMode: true }));

// Tooltip re-exports blocks-kit (process.env at load); passthrough keeps it renderable.
vi.mock("@/components/ui-kits/tooltip/tooltip", () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipContent: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock("./role-details-state", () => ({
  useRoleDetailsStore: (selector: (s: { isEditMode: boolean }) => unknown) =>
    selector({ isEditMode: h.isEditMode }),
}));

import { PermissionToggleCard } from "./permission-toggle-card";

const permission = (over: Record<string, unknown> = {}) =>
  ({
    name: "Read users",
    description: "Allows reading users",
    permissionSeverity: 1,
    type: 1,
    ...over,
  }) as never;

describe("PermissionToggleCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.isEditMode = true;
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
});
