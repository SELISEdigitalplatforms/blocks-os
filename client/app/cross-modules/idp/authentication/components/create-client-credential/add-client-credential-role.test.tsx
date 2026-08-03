import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  useGetRoles: vi.fn(),
}));

vi.mock("@seliseblocks/genesis-os", () => ({
  useProjectStore: () => ({ selectedProject: { tenantId: "tenant-1" } }),
}));
vi.mock("@blocks-idp/iam/hooks/use-roles", () => ({
  useGetRoles: (...args: unknown[]) => h.useGetRoles(...args),
}));

import { AddClientCredentialRole } from "./add-client-credential-role";

const makeRole = (i: number) => ({ itemId: `role-${i}`, name: `Role ${i}`, slug: `role_${i}` });

const setRoles = (count: number, totalCount = count) => {
  h.useGetRoles.mockReturnValue({
    data: {
      data: Array.from({ length: count }, (_, i) => makeRole(i + 1)),
      totalCount,
    },
    isLoading: false,
  });
};

const openDialog = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(screen.getByRole("button", { name: "Assign Role" }));
  return screen.findByRole("heading", { name: "Assign roles" });
};

describe("AddClientCredentialRole", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setRoles(3);
  });

  it("lists the available roles once open", async () => {
    const user = userEvent.setup();
    render(<AddClientCredentialRole selectedSlugs={[]} onAdd={vi.fn()} />);
    await openDialog(user);
    expect(screen.getByText("Role 1")).toBeTruthy();
    expect(screen.getByText("role_3")).toBeTruthy();
  });

  it("adds the pending slugs through onAdd", async () => {
    const user = userEvent.setup();
    const onAdd = vi.fn();
    render(<AddClientCredentialRole selectedSlugs={[]} onAdd={onAdd} />);
    await openDialog(user);

    await user.click(screen.getAllByRole("checkbox")[0]);
    await user.click(screen.getByRole("button", { name: "Add" }));

    expect(onAdd).toHaveBeenCalledWith(["role_1"]);
  });

  it("keeps Add disabled until a role is picked", async () => {
    const user = userEvent.setup();
    render(<AddClientCredentialRole selectedSlugs={[]} onAdd={vi.fn()} />);
    await openDialog(user);
    expect((screen.getByRole("button", { name: "Add" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("unchecking a role removes it from the pending set", async () => {
    const user = userEvent.setup();
    render(<AddClientCredentialRole selectedSlugs={[]} onAdd={vi.fn()} />);
    await openDialog(user);

    const first = screen.getAllByRole("checkbox")[0];
    await user.click(first);
    await user.click(first);
    expect((screen.getByRole("button", { name: "Add" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("disables checkboxes for roles already assigned", async () => {
    const user = userEvent.setup();
    render(<AddClientCredentialRole selectedSlugs={["role_2"]} onAdd={vi.fn()} />);
    await openDialog(user);
    expect((screen.getAllByRole("checkbox")[1] as HTMLButtonElement).disabled).toBe(true);
  });

  it("shows the empty state when no roles are returned", async () => {
    const user = userEvent.setup();
    setRoles(0, 0);
    render(<AddClientCredentialRole selectedSlugs={[]} onAdd={vi.fn()} />);
    await openDialog(user);
    expect(screen.getByText("No roles are found")).toBeTruthy();
  });

  it("passes the search term into the roles query", async () => {
    const user = userEvent.setup();
    render(<AddClientCredentialRole selectedSlugs={[]} onAdd={vi.fn()} />);
    await openDialog(user);

    await user.type(screen.getByPlaceholderText("Search by role name"), "adm");
    await waitFor(() =>
      expect(h.useGetRoles).toHaveBeenLastCalledWith(
        expect.objectContaining({ filter: { search: "adm" } }),
        expect.anything(),
      ),
    );
  });
});
