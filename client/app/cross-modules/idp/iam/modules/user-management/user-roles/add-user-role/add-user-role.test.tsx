import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  useGetRoles: vi.fn(),
  addRoles: vi.fn(),
  slugs: [] as string[],
  isPending: false,
  showErrorToast: vi.fn(),
  showSuccessToast: vi.fn(),
}));

vi.mock("@blocks-idp/iam/hooks/use-roles", () => ({
  useGetRoles: (...args: unknown[]) => h.useGetRoles(...args),
}));
vi.mock("@blocks-idp/iam/hooks/use-user", () => ({
  useUserRoles: () => ({ isPending: h.isPending, addRoles: h.addRoles, slugs: h.slugs }),
}));
vi.mock("@/hooks/use-toast", () => ({
  showErrorToast: h.showErrorToast,
  showSuccessToast: h.showSuccessToast,
}));

import { AddUserRole } from "./add-user-role";

const makeRole = (i: number) => ({ itemId: `role-${i}`, name: `Role ${i}`, slug: `role_${i}` });

const setRoles = (count: number, totalCount = count, isLoading = false) => {
  h.useGetRoles.mockReturnValue({
    data: {
      data: Array.from({ length: count }, (_, i) => makeRole(i + 1)),
      totalCount,
    },
    isLoading,
  });
};

const openDialog = async (user: ReturnType<typeof userEvent.setup>) => {
  // DialogTrigger is not asChild here, so it nests a button inside the styled
  // Button; the outer trigger is the one that toggles the dialog.
  await user.click(screen.getAllByRole("button", { name: "Assign Role" })[0]);
  return screen.findByText("Assign roles");
};

describe("AddUserRole", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.slugs = [];
    h.isPending = false;
    h.addRoles.mockResolvedValue({ isSuccess: true });
    setRoles(3);
  });

  it("lists the available roles once the dialog is open", async () => {
    const user = userEvent.setup();
    render(<AddUserRole userId="u1" projectKey="p1" />);
    await openDialog(user);
    expect(screen.getByText("Role 1")).toBeTruthy();
    expect(screen.getByText("role_3")).toBeTruthy();
  });

  it("assigns the selected roles and reports success", async () => {
    const user = userEvent.setup();
    render(<AddUserRole userId="u1" projectKey="p1" />);
    await openDialog(user);

    await user.click(screen.getAllByRole("checkbox")[0]);
    const include = screen.getByRole("button", { name: "Include" }) as HTMLButtonElement;
    expect(include.disabled).toBe(false);
    await user.click(include);

    await waitFor(() => expect(h.addRoles).toHaveBeenCalledWith(["role_1"]));
    expect(h.showSuccessToast).toHaveBeenCalledWith({
      description: "New role assigned successfully",
    });
  });

  it("unchecking a role removes it from the selection", async () => {
    const user = userEvent.setup();
    render(<AddUserRole userId="u1" projectKey="p1" />);
    await openDialog(user);

    const first = screen.getAllByRole("checkbox")[0];
    await user.click(first);
    await user.click(first);

    expect((screen.getByRole("button", { name: "Include" }) as HTMLButtonElement).disabled).toBe(
      true,
    );
  });

  it("surfaces a backend error when the assignment fails", async () => {
    const user = userEvent.setup();
    h.addRoles.mockResolvedValue({ isSuccess: false, errors: { role: "exists" } });
    render(<AddUserRole userId="u1" projectKey="p1" />);
    await openDialog(user);

    await user.click(screen.getAllByRole("checkbox")[0]);
    await user.click(screen.getByRole("button", { name: "Include" }));

    await waitFor(() =>
      expect(h.showErrorToast).toHaveBeenCalledWith({ errors: { role: "exists" } }),
    );
  });

  it("falls back to a generic error when the assignment throws", async () => {
    const user = userEvent.setup();
    h.addRoles.mockRejectedValue(new Error("boom"));
    render(<AddUserRole userId="u1" projectKey="p1" />);
    await openDialog(user);

    await user.click(screen.getAllByRole("checkbox")[0]);
    await user.click(screen.getByRole("button", { name: "Include" }));

    await waitFor(() =>
      expect(h.showErrorToast).toHaveBeenCalledWith({ errors: "Something went wrong" }),
    );
  });

  it("disables checkboxes for roles the user already holds", async () => {
    const user = userEvent.setup();
    h.slugs = ["role_2"];
    render(<AddUserRole userId="u1" projectKey="p1" />);
    await openDialog(user);

    const checkboxes = screen.getAllByRole("checkbox");
    expect((checkboxes[1] as HTMLButtonElement).disabled).toBe(true);
    expect(checkboxes[1].getAttribute("data-state")).toBe("checked");
  });

  it("shows the empty state when no roles are returned", async () => {
    const user = userEvent.setup();
    setRoles(0, 0);
    render(<AddUserRole userId="u1" projectKey="p1" />);
    await openDialog(user);
    expect(screen.getByText("No roles found")).toBeTruthy();
  });

  it("passes the search term into the roles query", async () => {
    const user = userEvent.setup();
    render(<AddUserRole userId="u1" projectKey="p1" />);
    await openDialog(user);

    await user.type(screen.getByPlaceholderText("Search by roles name"), "adm");
    await waitFor(() =>
      expect(h.useGetRoles).toHaveBeenLastCalledWith(
        expect.objectContaining({ filter: { search: "adm" } }),
      ),
    );
  });
});
