import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

// blocks-kit's theme store reads matchMedia at import time, which jsdom does not provide.
vi.stubGlobal("matchMedia", (query: string) => ({
  matches: false,
  media: query,
  onchange: null,
  addListener: vi.fn(),
  removeListener: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  dispatchEvent: vi.fn(),
}));

vi.stubGlobal(
  "ResizeObserver",
  class {
    observe() {}
    unobserve() {}
    disconnect() {}
  },
);

import { UserPermissionsList } from "./user-permissions-list";
import { IPermission } from "@blocks-idp/iam/models/permission";

const makePermission = (over: Partial<IPermission>): IPermission =>
  ({
    itemId: "perm-1",
    name: "Manage Billing",
    type: 1,
    description: "",
    resource: "billing",
    resourceGroup: "",
    projectKey: "p1",
    tags: [],
    roles: [],
    dependentPermissions: [],
    isArchived: false,
    isBuiltIn: false,
    language: null,
    organizationIds: [],
    permissionSeverity: 1,
    ...over,
  }) as IPermission;

const baseProps = { userId: "user-1", onRemovePermission: vi.fn() };

describe("UserPermissionsList", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders skeletons and no empty message while loading", () => {
    render(<UserPermissionsList permissions={[]} isLoading {...baseProps} />);
    expect(screen.queryByText("No permission found")).toBeNull();
    expect(screen.queryByLabelText("Remove role")).toBeNull();
  });

  it("shows the empty-state message when there are no permissions", () => {
    render(<UserPermissionsList permissions={[]} isLoading={false} {...baseProps} />);
    expect(screen.getByText("No permission found")).toBeTruthy();
  });

  it("renders permission name and resource for each permission", () => {
    render(
      <UserPermissionsList
        permissions={[makePermission({ name: "Manage Billing", resource: "billing" })]}
        isLoading={false}
        {...baseProps}
      />,
    );
    expect(screen.getByText("Manage Billing")).toBeTruthy();
    expect(screen.getByText("billing")).toBeTruthy();
  });

  it("invokes onRemovePermission with the resource when remove is clicked", async () => {
    const user = userEvent.setup();
    const onRemovePermission = vi.fn();
    render(
      <UserPermissionsList
        permissions={[makePermission({ resource: "users" })]}
        isLoading={false}
        userId="user-1"
        onRemovePermission={onRemovePermission}
      />,
    );
    await user.click(screen.getByLabelText("Remove role"));
    expect(onRemovePermission).toHaveBeenCalledWith("users");
  });
});
