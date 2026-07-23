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

vi.mock("./delete-sso-permission", () => ({
  DeleteSSOPermission: ({
    permission,
    onDelete,
  }: {
    permission: IPermission;
    onDelete: (permission: IPermission) => void;
  }) => (
    <button type="button" onClick={() => onDelete(permission)}>
      delete-{permission.resource}
    </button>
  ),
}));

const { SSOPermissionsList } = await import("./sso-permissions-list");

const makePermission = (resource: string): IPermission =>
  ({
    itemId: resource,
    name: `${resource}-name`,
    resource,
    description: "",
  }) as IPermission;

describe("SSOPermissionsList", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("renders an empty message when there are no permissions", () => {
    render(<SSOPermissionsList permissions={[]} onDelete={vi.fn()} />);
    expect(screen.getByText("No permissions found")).toBeTruthy();
  });

  it("renders a row per permission with name and resource", () => {
    render(
      <SSOPermissionsList
        permissions={[makePermission("read"), makePermission("write")]}
        onDelete={vi.fn()}
      />,
    );
    expect(screen.getByText("read-name")).toBeTruthy();
    expect(screen.getByText("write-name")).toBeTruthy();
    expect(screen.getByText("read")).toBeTruthy();
    expect(screen.getByText("write")).toBeTruthy();
  });

  it("forwards deletions through the delete control", async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn();
    const read = makePermission("read");
    render(<SSOPermissionsList permissions={[read]} onDelete={onDelete} />);

    await user.click(screen.getByText("delete-read"));

    expect(onDelete).toHaveBeenCalledWith(read);
  });
});
