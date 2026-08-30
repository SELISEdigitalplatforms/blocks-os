import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  mutateAsync: vi.fn(),
  isPending: false,
  showErrorToast: vi.fn(),
  showSuccessToast: vi.fn(),
}));

vi.mock("@blocks-idp/iam/hooks/use-roles", () => ({
  useAddRole: () => ({ mutateAsync: h.mutateAsync, isPending: h.isPending }),
}));
vi.mock("@/hooks/use-toast", () => ({
  showErrorToast: h.showErrorToast,
  showSuccessToast: h.showSuccessToast,
}));

import { AddRole } from "./add-role";

const advisory = (otherOrgs: number, slugConflicts = 0) => ({
  isSuccess: false,
  requiresDuplicateNameConfirmation: true,
  duplicateNameOrganizationCount: otherOrgs,
  slugConflictOrganizationCount: slugConflicts,
  errors: { duplicate_name: "Role_Name_Exists_In_Other_Organizations" },
});

const fillAndSubmit = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(screen.getByRole("button", { name: "Add Role" }));
  await screen.findByRole("heading", { name: "Add Role" });
  // The slug auto-derives from the name, so only the name needs typing.
  await user.type(screen.getByPlaceholderText("Enter name"), "Manager");
  await user.click(screen.getByRole("button", { name: "Add" }));
};

const confirmationDialog = () =>
  screen
    .getAllByRole("dialog")
    .find((el) => within(el).queryByText("This name is already used elsewhere") !== null)!;

describe("AddRole — duplicate-name confirmation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.isPending = false;
    h.mutateAsync.mockResolvedValue({ isSuccess: true });
  });

  it("asks for confirmation when other organizations already use the name", async () => {
    const user = userEvent.setup();
    h.mutateAsync.mockResolvedValueOnce(advisory(2));
    render(<AddRole />);

    await fillAndSubmit(user);

    await waitFor(() =>
      expect(screen.getByText("This name is already used elsewhere")).toBeTruthy(),
    );
    expect(
      screen.getByText(/2 other organizations already have a role with this name/),
    ).toBeTruthy();
    expect(h.showSuccessToast).not.toHaveBeenCalled();
  });

  it("uses the singular form for one organization", async () => {
    const user = userEvent.setup();
    h.mutateAsync.mockResolvedValueOnce(advisory(1));
    render(<AddRole />);

    await fillAndSubmit(user);

    await waitFor(() =>
      expect(
        screen.getByText(/1 other organization already has a role with this name/),
      ).toBeTruthy(),
    );
  });

  it("says how many organizations will keep their own role instead", async () => {
    const user = userEvent.setup();
    h.mutateAsync.mockResolvedValueOnce(advisory(3, 2));
    render(<AddRole />);

    await fillAndSubmit(user);

    await waitFor(() =>
      expect(
        screen.getByText(/2 of them will keep their own role and will not receive this one/),
      ).toBeTruthy(),
    );
  });

  it("resubmits with the confirmation flag and reports success", async () => {
    const user = userEvent.setup();
    h.mutateAsync.mockResolvedValueOnce(advisory(2)).mockResolvedValueOnce({ isSuccess: true });
    render(<AddRole />);

    await fillAndSubmit(user);
    await waitFor(() => screen.getByText("Create anyway"));
    await user.click(screen.getByText("Create anyway"));

    await waitFor(() => expect(h.showSuccessToast).toHaveBeenCalled());
    expect(h.mutateAsync).toHaveBeenLastCalledWith(
      expect.objectContaining({ name: "Manager", confirmDuplicateName: true }),
    );
  });

  it("treats a rejected 400 carrying the marker as the same question", async () => {
    const user = userEvent.setup();
    h.mutateAsync.mockRejectedValueOnce({
      status: 400,
      requiresDuplicateNameConfirmation: true,
      duplicateNameOrganizationCount: 4,
      slugConflictOrganizationCount: 0,
      errors: { duplicate_name: "Role_Name_Exists_In_Other_Organizations" },
    });
    render(<AddRole />);

    await fillAndSubmit(user);

    await waitFor(() =>
      expect(screen.getByText("This name is already used elsewhere")).toBeTruthy(),
    );
    expect(h.showErrorToast).not.toHaveBeenCalled();
  });

  it("cancelling creates nothing and keeps the entered values", async () => {
    const user = userEvent.setup();
    h.mutateAsync.mockResolvedValueOnce(advisory(2));
    render(<AddRole />);

    await fillAndSubmit(user);
    await waitFor(() => screen.getByText("This name is already used elsewhere"));

    // Scoped to the confirmation: the add-role form has a Cancel of its own, and clicking that
    // would close the whole dialog instead of dismissing the question.
    await user.click(within(confirmationDialog()).getByRole("button", { name: "Cancel" }));

    await waitFor(() =>
      expect(screen.queryByText("This name is already used elsewhere")).toBeNull(),
    );
    expect(h.mutateAsync).toHaveBeenCalledTimes(1);
    expect(h.showSuccessToast).not.toHaveBeenCalled();
    expect((screen.getByPlaceholderText("Enter name") as HTMLInputElement).value).toBe("Manager");
  });

  it("routes a field-coded server error onto its field without asking anything", async () => {
    const user = userEvent.setup();
    h.mutateAsync.mockRejectedValueOnce({
      status: 400,
      errors: { Name: "Role_Name_Already_Exists_In_Organization" },
    });
    render(<AddRole />);

    await fillAndSubmit(user);

    await waitFor(() =>
      expect(screen.getByText("Role_Name_Already_Exists_In_Organization")).toBeTruthy(),
    );
    expect(screen.queryByText("This name is already used elsewhere")).toBeNull();
    expect(h.showErrorToast).not.toHaveBeenCalled();
  });

  it("still toasts an error that belongs to no field", async () => {
    const user = userEvent.setup();
    h.mutateAsync.mockRejectedValueOnce({
      status: 400,
      errors: { forbidden: "Multi_Org_Required_For_Organization_Role" },
    });
    render(<AddRole />);

    await fillAndSubmit(user);

    await waitFor(() => expect(h.showErrorToast).toHaveBeenCalled());
    expect(screen.queryByText("This name is already used elsewhere")).toBeNull();
  });

  it("creates in one step when no other organization uses the name", async () => {
    const user = userEvent.setup();
    h.mutateAsync.mockResolvedValueOnce({ isSuccess: true, itemId: "r1" });
    render(<AddRole />);

    await fillAndSubmit(user);

    await waitFor(() => expect(h.showSuccessToast).toHaveBeenCalled());
    expect(screen.queryByText("This name is already used elsewhere")).toBeNull();
    expect(h.mutateAsync).toHaveBeenCalledTimes(1);
  });
});
