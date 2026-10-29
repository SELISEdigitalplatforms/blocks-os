import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  impact: null as unknown,
  isLoading: false,
  isError: false,
}));

vi.mock("@blocks-idp/iam/hooks/use-role-permission-change-impact", () => ({
  useRolePermissionChangeImpact: () => ({
    data: h.impact,
    isLoading: h.isLoading,
    isError: h.isError,
  }),
}));

import { ApplyPermissionChangesDialog } from "./apply-permission-changes-dialog";

const baseImpact = (overrides: Record<string, unknown> = {}) => ({
  isSuccess: true,
  slug: "manager",
  name: "Manager",
  isMultiOrgEnabled: true,
  canPropagate: true,
  addCount: 2,
  removeCount: 1,
  organizationCount: 3,
  skippedOrganizationCount: 0,
  affectedUserCount: 8,
  activeUserCount: 5,
  ...overrides,
});

const renderDialog = (props: Partial<Record<string, unknown>> = {}) => {
  const onConfirm = vi.fn().mockResolvedValue({});
  const onOpenChange = vi.fn();
  render(
    <ApplyPermissionChangesDialog
      open
      onOpenChange={onOpenChange}
      roleName="Manager"
      slug="manager"
      organizationId="default"
      addPermissions={["p1", "p2"]}
      removePermissions={["p3"]}
      isPending={false}
      onConfirm={onConfirm}
      {...(props as object)}
    />,
  );
  return { onConfirm, onOpenChange };
};

const propagateLabel = "Apply this change to all organizations";

describe("ApplyPermissionChangesDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.impact = baseImpact();
    h.isLoading = false;
    h.isError = false;
  });

  it("summarises what the change adds and removes", () => {
    renderDialog();
    expect(screen.getByText(/adds 2 permissions and removes 1 permission/)).toBeTruthy();
  });

  // The whole point of the dialog: propagation is the expected outcome when editing the default
  // organization, so it is pre-selected and opting out is the deliberate click.
  it("pre-selects propagation and confirms with it enabled", async () => {
    const { onConfirm } = renderDialog();

    expect(screen.getByLabelText(propagateLabel).getAttribute("data-state")).toBe("checked");

    await userEvent.click(screen.getByText("Apply to all organizations"));

    await waitFor(() => expect(onConfirm).toHaveBeenCalledWith(true));
  });

  it("confirms with propagation off once it is unticked", async () => {
    const { onConfirm } = renderDialog();

    await userEvent.click(screen.getByLabelText(propagateLabel));
    await userEvent.click(screen.getByText("Save changes"));

    await waitFor(() => expect(onConfirm).toHaveBeenCalledWith(false));
  });

  it("names the affected population once and says what happens to it", () => {
    renderDialog();
    // One sentence, not one per direction: the diff both adds and removes here.
    expect(screen.getByText(/8 users currently hold this role/)).toBeTruthy();
    expect(screen.getByText(/\(5 active\)/)).toBeTruthy();
    expect(screen.getByText(/They gain 2 permissions\./)).toBeTruthy();
    expect(screen.getByText(/They lose 1 permission\./)).toBeTruthy();
    expect(screen.getByText(/keep their current access until they next sign in/)).toBeTruthy();
  });

  it("drops the sign-in caveat when nothing is being removed", () => {
    h.impact = baseImpact({ removeCount: 0 });
    renderDialog({ removePermissions: [] });
    expect(screen.getByText(/They gain 2 permissions\./)).toBeTruthy();
    expect(screen.queryByText(/keep their current access/)).toBeNull();
  });

  // A skip nobody is told about is how organizations drift apart in the first place.
  it("names how many organizations propagation would skip", () => {
    h.impact = baseImpact({ skippedOrganizationCount: 2 });
    renderDialog();
    expect(
      screen.getByText(/2 organizations will be skipped because the role is missing or archived/),
    ).toBeTruthy();
  });

  it("hides the skip warning once propagation is unticked", async () => {
    h.impact = baseImpact({ skippedOrganizationCount: 2 });
    renderDialog();

    await userEvent.click(screen.getByLabelText(propagateLabel));

    expect(screen.queryByText(/will be skipped/)).toBeNull();
  });

  // An organization-scoped administrator is told why the option is absent rather than left to
  // wonder -- the backend would ignore the flag for them.
  it("explains the local-only scope when propagation is not available", () => {
    h.impact = baseImpact({ canPropagate: false });
    renderDialog();

    expect(screen.queryByLabelText(propagateLabel)).toBeNull();
    expect(screen.getByText(/applies to this organization only/)).toBeTruthy();
    expect(screen.getByText("Save changes")).toBeTruthy();
  });

  // It must be impossible to agree to a consequence before it is known.
  it("blocks confirming while the preview is still loading", () => {
    h.impact = null;
    h.isLoading = true;
    renderDialog();

    expect(screen.getByTestId("permission-change-impact-loading")).toBeTruthy();
    expect(screen.getByText("Save changes").closest("button")!.hasAttribute("disabled")).toBe(true);
  });

  // A failed preview degrades to a plain confirm. Saving locally stays possible; rewriting every
  // organization on the strength of numbers that never loaded does not.
  it("still allows a local save but withholds propagation when the preview fails", async () => {
    h.impact = null;
    h.isError = true;
    const { onConfirm } = renderDialog();

    expect(screen.queryByLabelText(propagateLabel)).toBeNull();
    expect(screen.getByText(/impact of this change could not be loaded/)).toBeTruthy();

    await userEvent.click(screen.getByText("Save changes"));

    await waitFor(() => expect(onConfirm).toHaveBeenCalledWith(false));
  });

  it("stays open when the save rejects, so the selection is not lost", async () => {
    const onConfirm = vi.fn().mockRejectedValue(new Error("nope"));
    const onOpenChange = vi.fn();
    render(
      <ApplyPermissionChangesDialog
        open
        onOpenChange={onOpenChange}
        roleName="Manager"
        slug="manager"
        organizationId="default"
        addPermissions={["p1"]}
        removePermissions={[]}
        isPending={false}
        onConfirm={onConfirm}
      />,
    );

    await userEvent.click(screen.getByText("Apply to all organizations"));

    await waitFor(() => expect(onConfirm).toHaveBeenCalled());
    expect(onOpenChange).not.toHaveBeenCalled();
  });
});
