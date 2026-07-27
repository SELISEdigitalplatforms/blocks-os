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

const navigate = vi.fn();

vi.mock("react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router")>();
  return { ...actual, useNavigate: () => navigate };
});

vi.mock("@seliseblocks/blocks-kit/hooks", () => ({
  useScopedPath: () => (path: string) => `/app/tenant-1/${path}`,
}));

vi.mock("./delete-sso-role", () => ({
  DeleteSSORole: ({ role, onDelete }: { role: IRole; onDelete: (role: IRole) => void }) => (
    <button type="button" onClick={() => onDelete(role)}>
      delete-{role.slug}
    </button>
  ),
}));

const { SSORolesList } = await import("./sso-roles-list");

const makeRole = (slug: string, itemId: string): IRole =>
  ({ itemId, name: `${slug}-name`, slug, description: "" }) as IRole;

describe("SSORolesList", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("renders an empty message when there are no roles", () => {
    render(<SSORolesList roles={[]} onDelete={vi.fn()} />);
    expect(screen.getByText("No roles found")).toBeTruthy();
  });

  it("renders a row per role with name and slug", () => {
    render(
      <SSORolesList
        roles={[makeRole("admin", "r1"), makeRole("editor", "r2")]}
        onDelete={vi.fn()}
      />,
    );
    expect(screen.getByText("admin-name")).toBeTruthy();
    expect(screen.getByText("editor-name")).toBeTruthy();
    expect(screen.getByText("admin")).toBeTruthy();
    expect(screen.getByText("editor")).toBeTruthy();
  });

  it("navigates to the role detail on row click", async () => {
    const user = userEvent.setup();
    render(<SSORolesList roles={[makeRole("admin", "r1")]} onDelete={vi.fn()} />);

    await user.click(screen.getByText("admin-name"));

    expect(navigate).toHaveBeenCalledWith("/app/tenant-1/idp/role-detail/r1");
  });

  it("forwards deletions through the delete control", async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn();
    const admin = makeRole("admin", "r1");
    render(<SSORolesList roles={[admin]} onDelete={onDelete} />);

    await user.click(screen.getByText("delete-admin"));

    expect(onDelete).toHaveBeenCalledWith(admin);
  });
});
