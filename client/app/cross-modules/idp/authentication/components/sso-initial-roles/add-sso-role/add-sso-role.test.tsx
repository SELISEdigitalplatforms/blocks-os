import { cleanup, render, screen, waitFor } from "@testing-library/react";
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

// Radix dialog/checkbox rely on pointer-capture / scroll APIs jsdom does not implement.
if (!Element.prototype.hasPointerCapture) {
  Element.prototype.hasPointerCapture = () => false;
}
if (!Element.prototype.releasePointerCapture) {
  Element.prototype.releasePointerCapture = () => {};
}
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {};
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let rolesResult: any = { data: undefined, isLoading: false };

vi.mock("@seliseblocks/blocks-kit", () => ({
  useProjectStore: () => ({ selectedProject: { tenantId: "tenant-1" } }),
}));

vi.mock("@blocks-idp/iam/hooks/use-roles", () => ({
  useGetRoles: () => rolesResult,
}));

vi.mock("@/components/filter-toolbar", () => ({
  FilterControls: {
    SearchInput: (props: { value: string; onChange: (value: string) => void }) => (
      <input
        aria-label="search-roles"
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
      />
    ),
  },
}));

const { AddSSORole } = await import("./add-sso-role");

const role = (slug: string): IRole =>
  ({ itemId: slug, name: `${slug}-name`, slug, description: "" }) as IRole;

describe("AddSSORole", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    rolesResult = { data: undefined, isLoading: false };
  });

  afterEach(() => {
    cleanup();
  });

  it("renders a trigger button and opens the assign dialog", async () => {
    const user = userEvent.setup();
    rolesResult = { data: { data: [], totalCount: 0 }, isLoading: false };
    render(<AddSSORole roles={[]} onAdd={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: /Assign Role/i }));

    expect(await screen.findByText("Assign roles")).toBeTruthy();
  });

  it("shows an empty message when no roles are returned", async () => {
    const user = userEvent.setup();
    rolesResult = { data: { data: [], totalCount: 0 }, isLoading: false };
    render(<AddSSORole roles={[]} onAdd={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: /Assign Role/i }));

    expect(await screen.findByText("No roles are found")).toBeTruthy();
  });

  it("lists returned roles and adds the selected one", async () => {
    const user = userEvent.setup();
    const onAdd = vi.fn();
    rolesResult = {
      data: { data: [role("admin"), role("editor")], totalCount: 2 },
      isLoading: false,
    };
    render(<AddSSORole roles={[]} onAdd={onAdd} />);

    await user.click(screen.getByRole("button", { name: /Assign Role/i }));
    expect(await screen.findByText("admin-name")).toBeTruthy();

    const checkboxes = await screen.findAllByRole("checkbox");
    await user.click(checkboxes[0]);
    await user.click(screen.getByRole("button", { name: "Add" }));

    await waitFor(() => {
      expect(onAdd).toHaveBeenCalledTimes(1);
    });
    expect(onAdd.mock.calls[0][0]).toEqual([role("admin")]);
  });
});
