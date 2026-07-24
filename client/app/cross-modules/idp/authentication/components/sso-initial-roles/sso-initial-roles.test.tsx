import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { IRole } from "@blocks-idp/iam/models/role";

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

const NEW_ROLE: IRole = {
  itemId: "new",
  name: "New Role",
  slug: "new-role",
  description: "",
} as IRole;

vi.mock("./add-sso-role", () => ({
  AddSSORole: ({ onAdd }: { onAdd: (roles: IRole[]) => void }) => (
    <button type="button" onClick={() => onAdd([NEW_ROLE])}>
      mock-add-role
    </button>
  ),
}));

vi.mock("./sso-roles-list", () => ({
  SSORolesList: ({ roles, onDelete }: { roles: IRole[]; onDelete: (role: IRole) => void }) => (
    <div data-testid="roles-list">
      {roles.map((role) => (
        <button key={role.slug} type="button" onClick={() => onDelete(role)}>
          delete-{role.slug}
        </button>
      ))}
    </div>
  ),
}));

const { SSOInitialRoles } = await import("./sso-initial-roles");

const makeRole = (slug: string): IRole =>
  ({ itemId: slug, name: slug, slug, description: "" }) as IRole;

describe("SSOInitialRoles", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("renders the empty state when there are no roles", () => {
    render(<SSOInitialRoles roles={[]} onChange={vi.fn()} />);
    expect(screen.getByText("No roles added")).toBeTruthy();
    expect(screen.queryByTestId("roles-list")).toBeNull();
  });

  it("renders the roles list with a count badge", () => {
    render(<SSOInitialRoles roles={[makeRole("admin"), makeRole("editor")]} onChange={vi.fn()} />);
    expect(screen.getByTestId("roles-list")).toBeTruthy();
    expect(screen.getByText("2")).toBeTruthy();
    expect(screen.queryByText("No roles added")).toBeNull();
  });

  it("shows pagination once roles exceed the page size", () => {
    const roles = Array.from({ length: 7 }, (_, i) => makeRole(`role-${i}`));
    render(<SSOInitialRoles roles={roles} onChange={vi.fn()} />);
    expect(screen.getByText(/Showing 1 to 5 of 7 roles/)).toBeTruthy();
  });

  it("appends the selected role when one is added", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const existing = makeRole("admin");
    render(<SSOInitialRoles roles={[existing]} onChange={onChange} />);

    await user.click(screen.getByText("mock-add-role"));

    expect(onChange).toHaveBeenCalledWith([existing, NEW_ROLE]);
  });

  it("removes a role by slug when deleted", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const admin = makeRole("admin");
    const editor = makeRole("editor");
    render(<SSOInitialRoles roles={[admin, editor]} onChange={onChange} />);

    await user.click(screen.getByText("delete-admin"));

    expect(onChange).toHaveBeenCalledWith([editor]);
  });
});
