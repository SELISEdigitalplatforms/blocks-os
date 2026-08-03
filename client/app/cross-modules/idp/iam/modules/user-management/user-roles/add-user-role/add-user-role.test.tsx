import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Tooltip re-exports blocks-kit (process.env at load); passthrough keeps it renderable.
vi.mock("@/components/ui-kits/tooltip/tooltip", () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipContent: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock("@seliseblocks/genesis-os", () => ({
  useProjectStore: () => ({ selectedProject: { tenantId: "tenant-1" } }),
}));

const h = vi.hoisted(() => ({
  rolesResult: {} as Record<string, unknown>,
  addRoles: vi.fn(),
  slugs: [] as string[],
  isPending: false,
  showError: vi.fn(),
  showSuccess: vi.fn(),
}));

vi.mock("@blocks-idp/iam/hooks/use-roles", () => ({
  useGetRoles: () => h.rolesResult,
}));
vi.mock("@blocks-idp/iam/hooks/use-user", () => ({
  useUserRoles: () => ({ isPending: h.isPending, addRoles: h.addRoles, slugs: h.slugs }),
}));
vi.mock("@/hooks/use-toast", () => ({
  showErrorToast: (arg: unknown) => h.showError(arg),
  showSuccessToast: (arg: unknown) => h.showSuccess(arg),
}));
vi.mock("@/components/filter-toolbar", () => ({
  FilterControls: {
    SearchInput: ({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) => (
      <input aria-label="search" placeholder={placeholder} value={value} onChange={(e) => onChange(e.target.value)} />
    ),
  },
}));

import { AddUserRole } from "./add-user-role";

const renderCmp = () => render(<AddUserRole userId="u1" projectKey="p1" />);

beforeEach(() => {
  vi.clearAllMocks();
  h.isPending = false;
  h.slugs = [];
  h.rolesResult = {
    data: {
      data: [
        { itemId: "r1", name: "Admin", slug: "admin" },
        { itemId: "r2", name: "Viewer", slug: "viewer" },
      ],
      totalCount: 2,
    },
    isLoading: false,
  };
});

describe("AddUserRole", () => {
  it("renders the assign trigger", () => {
    renderCmp();
    expect(screen.getByText("Assign Role")).toBeTruthy();
  });

  it("disables the trigger when the user already has 5 roles", () => {
    h.slugs = ["a", "b", "c", "d", "e"];
    renderCmp();
    expect((screen.getByText("Assign Role").closest("button") as HTMLButtonElement).disabled).toBe(true);
  });

  it("shows the empty state inside the dialog when there are no roles", async () => {
    h.rolesResult = { data: { data: [], totalCount: 0 }, isLoading: false };
    renderCmp();
    fireEvent.click(screen.getByText("Assign Role"));
    await waitFor(() => expect(screen.getByText("No roles found")).toBeTruthy());
  });

  it("selects a role and assigns it", async () => {
    h.addRoles.mockResolvedValue({ isSuccess: true });
    renderCmp();
    fireEvent.click(screen.getByText("Assign Role"));
    await waitFor(() => expect(screen.getByText("Admin")).toBeTruthy());
    fireEvent.click(screen.getAllByRole("checkbox")[0]);
    fireEvent.click(screen.getByRole("button", { name: "Include" }));
    await waitFor(() => expect(h.addRoles).toHaveBeenCalledWith(["admin"]));
    await waitFor(() => expect(h.showSuccess).toHaveBeenCalled());
  });

  it("shows an error toast when the assign request fails", async () => {
    h.addRoles.mockResolvedValue({ isSuccess: false, errors: "bad" });
    renderCmp();
    fireEvent.click(screen.getByText("Assign Role"));
    await waitFor(() => expect(screen.getByText("Admin")).toBeTruthy());
    fireEvent.click(screen.getAllByRole("checkbox")[0]);
    fireEvent.click(screen.getByRole("button", { name: "Include" }));
    await waitFor(() => expect(h.showError).toHaveBeenCalledWith({ errors: "bad" }));
  });

  it("shows the mapped error toast when assigning throws structured errors", async () => {
    h.addRoles.mockRejectedValue({ errors: { role: "thrown" } });
    renderCmp();
    fireEvent.click(screen.getByText("Assign Role"));
    await waitFor(() => expect(screen.getByText("Admin")).toBeTruthy());
    fireEvent.click(screen.getAllByRole("checkbox")[0]);
    fireEvent.click(screen.getByRole("button", { name: "Include" }));
    await waitFor(() => expect(h.showError).toHaveBeenCalledWith({ errors: { role: "thrown" } }));
  });

  it("shows a generic error toast when assigning throws a plain value", async () => {
    h.addRoles.mockRejectedValue("nope");
    renderCmp();
    fireEvent.click(screen.getByText("Assign Role"));
    await waitFor(() => expect(screen.getByText("Admin")).toBeTruthy());
    fireEvent.click(screen.getAllByRole("checkbox")[0]);
    fireEvent.click(screen.getByRole("button", { name: "Include" }));
    await waitFor(() => expect(h.showError).toHaveBeenCalledWith({ errors: "Something went wrong" }));
  });

  it("toggles a role selection off when unchecked", async () => {
    renderCmp();
    fireEvent.click(screen.getByText("Assign Role"));
    await waitFor(() => expect(screen.getByText("Admin")).toBeTruthy());
    const checkbox = screen.getAllByRole("checkbox")[0];
    fireEvent.click(checkbox);
    fireEvent.click(checkbox);
    // Include should be disabled again once nothing is selected.
    await waitFor(() =>
      expect((screen.getByRole("button", { name: "Include" }) as HTMLButtonElement).disabled).toBe(true),
    );
  });

  it("prevents selecting beyond the five-role maximum", async () => {
    h.slugs = ["a", "b", "c", "d"];
    renderCmp();
    fireEvent.click(screen.getByText("Assign Role"));
    await waitFor(() => expect(screen.getByText("Admin")).toBeTruthy());
    const boxes = screen.getAllByRole("checkbox");
    fireEvent.click(boxes[0]);
    fireEvent.click(boxes[1]);
    // The second selection is blocked by the max-role guard.
    expect(boxes[1].getAttribute("aria-checked")).toBe("false");
  });

  it("resets its state when the dialog is closed", async () => {
    renderCmp();
    fireEvent.click(screen.getByText("Assign Role"));
    await waitFor(() => expect(screen.getByText("Admin")).toBeTruthy());
    fireEvent.keyDown(document.body, { key: "Escape" });
    await waitFor(() => expect(screen.queryByText("Admin")).toBeNull());
  });
});
