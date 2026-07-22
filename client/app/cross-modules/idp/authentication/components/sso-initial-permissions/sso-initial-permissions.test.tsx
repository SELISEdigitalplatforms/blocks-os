import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { IPermission } from "@blocks-idp/iam/models/permission";

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

const NEW_PERMISSION = {
  itemId: "new",
  name: "New Permission",
  resource: "new-resource",
  description: "",
} as IPermission;

vi.mock("./add-sso-permission", () => ({
  AddSSOPermission: ({
    onAdd,
  }: {
    onAdd: (permissions: IPermission[]) => void;
  }) => (
    <button type="button" onClick={() => onAdd([NEW_PERMISSION])}>
      mock-add-permission
    </button>
  ),
}));

vi.mock("./sso-permissions-list", () => ({
  SSOPermissionsList: ({
    permissions,
    onDelete,
  }: {
    permissions: IPermission[];
    onDelete: (permission: IPermission) => void;
  }) => (
    <div data-testid="permissions-list">
      {permissions.map((permission) => (
        <button
          key={permission.resource}
          type="button"
          onClick={() => onDelete(permission)}
        >
          delete-{permission.resource}
        </button>
      ))}
    </div>
  ),
}));

const { SSOInitialPermissions } = await import("./sso-initial-permissions");

const makePermission = (resource: string): IPermission =>
  ({ itemId: resource, name: resource, resource, description: "" }) as IPermission;

describe("SSOInitialPermissions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("renders the empty state when there are no permissions", () => {
    render(<SSOInitialPermissions permissions={[]} onChange={vi.fn()} />);
    expect(screen.getByText("No permissions added")).toBeTruthy();
    expect(screen.queryByTestId("permissions-list")).toBeNull();
  });

  it("renders the permissions list with a count badge", () => {
    render(
      <SSOInitialPermissions
        permissions={[makePermission("read"), makePermission("write")]}
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByTestId("permissions-list")).toBeTruthy();
    expect(screen.getByText("2")).toBeTruthy();
  });

  it("appends the selected permission when one is added", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const existing = makePermission("read");
    render(
      <SSOInitialPermissions permissions={[existing]} onChange={onChange} />,
    );

    await user.click(screen.getByText("mock-add-permission"));

    expect(onChange).toHaveBeenCalledWith([existing, NEW_PERMISSION]);
  });

  it("removes a permission by resource when deleted", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const read = makePermission("read");
    const write = makePermission("write");
    render(
      <SSOInitialPermissions
        permissions={[read, write]}
        onChange={onChange}
      />,
    );

    await user.click(screen.getByText("delete-read"));

    expect(onChange).toHaveBeenCalledWith([write]);
  });
});
