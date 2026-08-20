import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

type StoreShape = {
  role: { itemId?: string; name?: string; slug?: string; organizationId?: string } | null;
  isEditMode: boolean;
  isInitialized: boolean;
  permissionMap: Map<string, { itemId: string; modified: boolean; changeState: string }>;
  discardChanges: ReturnType<typeof vi.fn>;
  commitChanges: ReturnType<typeof vi.fn>;
  changeEditMode: ReturnType<typeof vi.fn>;
};

const h = vi.hoisted(() => ({
  store: null as unknown,
  mutateAsync: vi.fn(),
  isPending: false,
  showSuccessToast: vi.fn(),
  showErrorToast: vi.fn(),
  isMultiOrgEnabled: false,
}));

vi.mock("@seliseblocks/genesis-os", () => ({
  useProjectStore: () => ({ selectedProject: { tenantId: "tenant-1" } }),
}));
vi.mock("@/hooks/use-toast", () => ({
  showSuccessToast: (...args: unknown[]) => h.showSuccessToast(...args),
  showErrorToast: (...args: unknown[]) => h.showErrorToast(...args),
}));
vi.mock("@/components/breadcrumb/breadcrumb", () => ({
  default: () => <nav data-testid="breadcrumb" />,
}));
vi.mock("./permissions-selection-panel", () => ({
  PermissionsSelectionPanel: () => <div data-testid="panel" />,
}));
vi.mock("./role-details-state", () => ({
  RoleDetailsProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useRoleDetailsStore: (selector: (s: StoreShape) => unknown) => selector(h.store as StoreShape),
}));
vi.mock("@blocks-idp/iam/hooks/use-roles", () => ({
  useSetRoles: () => ({ isPending: h.isPending, mutateAsync: h.mutateAsync }),
}));
// The propagation consent control is gated on this: single-org tenants must never see it, and
// must never send the field. Defaults to disabled so the existing tests describe that tenant.
vi.mock("@blocks-idp/iam/hooks/use-organization", () => ({
  useGetOrganizationConfig: () => ({ data: { isMultiOrgEnabled: h.isMultiOrgEnabled } }),
}));

import { RoleDetailsContainer } from "./role-details";

const baseStore = (overrides: Partial<StoreShape> = {}): StoreShape => ({
  role: { itemId: "role-1", name: "Admin", slug: "admin", organizationId: "org-1" },
  isEditMode: false,
  isInitialized: true,
  permissionMap: new Map([
    ["p1", { itemId: "p1", modified: true, changeState: "added" }],
    ["p2", { itemId: "p2", modified: true, changeState: "removed" }],
    ["p3", { itemId: "p3", modified: false, changeState: "unchanged" }],
  ]),
  discardChanges: vi.fn(),
  commitChanges: vi.fn(),
  changeEditMode: vi.fn(),
  ...overrides,
});

describe("RoleDetailsContainer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.isPending = false;
    h.mutateAsync = vi.fn().mockResolvedValue({});
    h.store = baseStore();
  });

  it("shows the skeleton until the store is initialized", () => {
    h.store = baseStore({ isInitialized: false });
    render(<RoleDetailsContainer />);
    expect(screen.queryByText("Edit Permissions")).toBeNull();
    expect(screen.queryByTestId("panel")).toBeNull();
  });

  it("renders the panel and an Edit button in view mode", async () => {
    const store = baseStore();
    h.store = store;
    render(<RoleDetailsContainer />);
    expect(screen.getByTestId("panel")).toBeTruthy();
    await userEvent.click(screen.getByText("Edit Permissions"));
    expect(store.changeEditMode).toHaveBeenCalledWith(true);
  });

  it("shows Discard and Save actions in edit mode and discards on demand", async () => {
    const store = baseStore({ isEditMode: true });
    h.store = store;
    render(<RoleDetailsContainer />);
    await userEvent.click(screen.getByText("Discard"));
    expect(store.discardChanges).toHaveBeenCalledTimes(1);
  });

  it("saves the added and removed permissions and commits on success", async () => {
    const store = baseStore({ isEditMode: true });
    h.store = store;
    render(<RoleDetailsContainer />);
    await userEvent.click(screen.getByText("Save Changes"));
    await waitFor(() =>
      expect(h.mutateAsync).toHaveBeenCalledWith({
        addPermissions: ["p1"],
        removePermissions: ["p2"],
        organizationId: "org-1",
        slug: "admin",
      }),
    );
    expect(store.commitChanges).toHaveBeenCalledTimes(1);
    expect(h.showSuccessToast).toHaveBeenCalledTimes(1);
  });

  it("does not call the mutation when nothing changed", async () => {
    const store = baseStore({
      isEditMode: true,
      permissionMap: new Map([["p3", { itemId: "p3", modified: false, changeState: "unchanged" }]]),
    });
    h.store = store;
    render(<RoleDetailsContainer />);
    await userEvent.click(screen.getByText("Save Changes"));
    expect(h.mutateAsync).not.toHaveBeenCalled();
    expect(store.commitChanges).not.toHaveBeenCalled();
  });

  it("surfaces an error toast when the mutation rejects", async () => {
    const store = baseStore({ isEditMode: true });
    h.store = store;
    h.mutateAsync = vi.fn().mockRejectedValue({ errors: { general: "nope" } });
    render(<RoleDetailsContainer />);
    await userEvent.click(screen.getByText("Save Changes"));
    await waitFor(() => expect(h.showErrorToast).toHaveBeenCalledTimes(1));
    expect(store.commitChanges).not.toHaveBeenCalled();
  });

  describe("cross-organization propagation consent", () => {
    const label = "Apply this change to all organizations";

    it("is not offered to a single-organization tenant", async () => {
      h.isMultiOrgEnabled = false;
      h.store = baseStore({ isEditMode: true });
      h.mutateAsync = vi.fn().mockResolvedValue({});

      render(<RoleDetailsContainer />);

      expect(screen.queryByLabelText(label)).toBeNull();

      await userEvent.click(screen.getByText("Save Changes"));

      // The field must be absent, not false: a single-org tenant's payload stays byte-for-byte
      // what it was before this feature existed.
      const payload = h.mutateAsync.mock.calls[0][0];
      expect(payload).not.toHaveProperty("propagateToAllOrganizations");
    });

    it("is offered unchecked to a multi-organization tenant and omitted until ticked", async () => {
      h.isMultiOrgEnabled = true;
      h.store = baseStore({ isEditMode: true });
      h.mutateAsync = vi.fn().mockResolvedValue({});

      render(<RoleDetailsContainer />);

      const checkbox = screen.getByLabelText(label);
      expect(checkbox.getAttribute("data-state")).toBe("unchecked");

      await userEvent.click(screen.getByText("Save Changes"));

      expect(h.mutateAsync.mock.calls[0][0]).not.toHaveProperty("propagateToAllOrganizations");
    });

    it("sends the flag once the box is ticked", async () => {
      h.isMultiOrgEnabled = true;
      h.store = baseStore({ isEditMode: true });
      h.mutateAsync = vi.fn().mockResolvedValue({});

      render(<RoleDetailsContainer />);
      await userEvent.click(screen.getByLabelText(label));
      await userEvent.click(screen.getByText("Save Changes"));

      expect(h.mutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({ propagateToAllOrganizations: true }),
      );
    });
  });
});
