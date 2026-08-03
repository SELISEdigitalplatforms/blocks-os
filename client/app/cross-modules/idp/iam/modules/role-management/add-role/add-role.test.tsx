import { render, screen, waitFor } from "@testing-library/react";
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

const openDialog = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(screen.getByRole("button", { name: "Add Role" }));
  return screen.findByRole("heading", { name: "Add Role" });
};

describe("AddRole", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.isPending = false;
    h.mutateAsync.mockResolvedValue({ isSuccess: true });
  });

  it("auto-derives the slug from the name until the slug is edited", async () => {
    const user = userEvent.setup();
    render(<AddRole />);
    await openDialog(user);

    await user.type(screen.getByPlaceholderText("Enter name"), "Cloud Admin");
    expect((screen.getByPlaceholderText("Enter slug") as HTMLInputElement).value).toBe(
      "cloud_admin",
    );
  });

  it("stops syncing the slug once it has been manually edited", async () => {
    const user = userEvent.setup();
    render(<AddRole />);
    await openDialog(user);

    const slug = screen.getByPlaceholderText("Enter slug");
    await user.type(slug, "custom_slug");
    await user.type(screen.getByPlaceholderText("Enter name"), "Cloud Admin");

    expect((slug as HTMLInputElement).value).toBe("custom_slug");
  });

  it("submits the new role and reports success", async () => {
    const user = userEvent.setup();
    render(<AddRole />);
    await openDialog(user);

    await user.type(screen.getByPlaceholderText("Enter name"), "Support");
    await user.type(screen.getByPlaceholderText("Enter description"), "Support staff");
    await user.click(screen.getByRole("button", { name: "Add" }));

    await waitFor(() => expect(h.mutateAsync).toHaveBeenCalledTimes(1));
    expect(h.mutateAsync).toHaveBeenCalledWith({
      name: "Support",
      slug: "support",
      description: "Support staff",
    });
    expect(h.showSuccessToast).toHaveBeenCalledWith({ description: "Role added successfully" });
  });

  it("keeps Add disabled until the form is dirty", async () => {
    const user = userEvent.setup();
    render(<AddRole />);
    await openDialog(user);
    expect((screen.getByRole("button", { name: "Add" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("shows a Forbidden message on a 403 response", async () => {
    const user = userEvent.setup();
    h.mutateAsync.mockRejectedValue({ status: 403, errors: {} });
    render(<AddRole />);
    await openDialog(user);

    await user.type(screen.getByPlaceholderText("Enter name"), "Support");
    await user.click(screen.getByRole("button", { name: "Add" }));

    await waitFor(() =>
      expect(h.showErrorToast).toHaveBeenCalledWith({
        title: "Forbidden",
        errors: "You are not allowed to perform this action.",
      }),
    );
  });

  it("maps structured http errors from a non-403 response", async () => {
    const user = userEvent.setup();
    h.mutateAsync.mockRejectedValue({ status: 409, errors: { slug: "duplicate" } });
    render(<AddRole />);
    await openDialog(user);

    await user.type(screen.getByPlaceholderText("Enter name"), "Support");
    await user.click(screen.getByRole("button", { name: "Add" }));

    await waitFor(() =>
      expect(h.showErrorToast).toHaveBeenCalledWith({ errors: { slug: "duplicate" } }),
    );
  });

  it("maps a plain error object that only carries errors", async () => {
    const user = userEvent.setup();
    h.mutateAsync.mockRejectedValue({ errors: { name: "taken" } });
    render(<AddRole />);
    await openDialog(user);

    await user.type(screen.getByPlaceholderText("Enter name"), "Support");
    await user.click(screen.getByRole("button", { name: "Add" }));

    await waitFor(() =>
      expect(h.showErrorToast).toHaveBeenCalledWith({ errors: { name: "taken" } }),
    );
  });
});
