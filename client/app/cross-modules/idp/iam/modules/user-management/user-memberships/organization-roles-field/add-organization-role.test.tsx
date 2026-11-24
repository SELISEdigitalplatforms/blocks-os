import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("@blocks-idp/iam/hooks/use-grant-scope", () => import("@/test-utils/__mocks__/grant-scope.mock"));
import { createWrapper } from "@/test-utils/test-providers/query-client";
import { IRole } from "@blocks-idp/iam/models/role";

// Tooltip re-exports blocks-kit (process.env at load); passthrough keeps it renderable.
vi.mock("@/components/ui-kits/tooltip/tooltip", () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipContent: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div className={className}>{children}</div>
  ),
  TooltipProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock("@seliseblocks/genesis-os", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@seliseblocks/genesis-os")>()),
  useProjectStore: () => ({ selectedProject: { tenantId: "tenant-1" } }),
}));

const h = vi.hoisted(() => ({
  showErrorToast: vi.fn(),
  roles: [
    { itemId: "role-1", name: "System User", slug: "clouduser", description: "" },
    { itemId: "role-2", name: "Test", slug: "test", description: "" },
  ] as IRole[],
  /** Overrides the picker's role list for a single test; `null` falls back to `roles`. */
  assignable: null as IRole[] | null,
}));

vi.mock("@/hooks/use-toast", () => ({
  showErrorToast: h.showErrorToast,
}));

vi.mock("@blocks-idp/iam/hooks/use-roles", () => ({
  useGetAssignableRoles: () => {
    const list = h.assignable ?? h.roles;
    return { data: { data: list, totalCount: list.length }, isLoading: false };
  },
}));


import { AddOrganizationRole } from "./add-organization-role";
import { OrganizationRolesField } from "./organization-roles-field";

const openDialog = () => {
  fireEvent.click(screen.getByRole("button", { name: /manage roles/i }));
};

beforeEach(() => {
  vi.clearAllMocks();
  h.assignable = null;
});

describe("AddOrganizationRole", () => {
  it("shows the minimum-role requirement beside the modal title", async () => {
    render(
      <AddOrganizationRole roles={[h.roles[0]]} onChange={vi.fn()} />,
      { wrapper: createWrapper() },
    );

    openDialog();
    expect(await screen.findByPlaceholderText("Search by role name")).toBeTruthy();

    // The OS tooltip primitive is stubbed to a passthrough (it re-exports from
    // genesis-os, which pulls in modules jsdom cannot load), so assert on the
    // trigger and the rendered requirement text rather than Radix's own
    // role="tooltip" node.
    const infoButton = await screen.findByRole("button", {
      name: /role assignment requirement/i,
    });
    expect(infoButton).toBeTruthy();
    expect(
      screen.getAllByText(
        "At least one role must remain assigned to this user to access resources.",
      ).length,
    ).toBeGreaterThan(0);
  });

  it("prevents the final assigned role from being deselected", async () => {
    const onChange = vi.fn();
    const onSave = vi.fn();

    render(
      <AddOrganizationRole
        roles={[h.roles[0]]}
        onChange={onChange}
        onSave={onSave}
      />,
      { wrapper: createWrapper() },
    );

    openDialog();
    expect((await screen.findByLabelText("1 role selected") as HTMLElement).textContent).toBe("1 selected");

    fireEvent.click(screen.getByRole("checkbox", { name: /deselect system user/i }));

    await waitFor(() => {
      expect((screen.getByLabelText("1 role selected") as HTMLElement).textContent).toBe("1 selected");
      expect(h.showErrorToast).toHaveBeenCalledWith({
        errors: "At least one role must remain assigned to this user to access resources.",
      });
    });
    expect((screen.getByRole("button", { name: /^add$/i }) as HTMLButtonElement).disabled).toBe(true);
    expect(onChange).not.toHaveBeenCalled();
    expect(onSave).not.toHaveBeenCalled();
  });

  it("discards role removals when cancelled", async () => {
    const onChange = vi.fn();
    const onSave = vi.fn();

    render(
      <AddOrganizationRole
        roles={[h.roles[0]]}
        onChange={onChange}
        onSave={onSave}
      />,
      { wrapper: createWrapper() },
    );

    openDialog();
    fireEvent.click(await screen.findByRole("checkbox", { name: /deselect system user/i }));
    fireEvent.click(screen.getByRole("button", { name: /cancel/i }));

    expect(onChange).not.toHaveBeenCalled();
    expect(onSave).not.toHaveBeenCalled();
  });

  it("discards staged changes when closed with the top-right close button", async () => {
    const onChange = vi.fn();
    const onSave = vi.fn();

    render(
      <AddOrganizationRole
        roles={[h.roles[0]]}
        onChange={onChange}
        onSave={onSave}
      />,
      { wrapper: createWrapper() },
    );

    openDialog();
    fireEvent.click(await screen.findByRole("checkbox", { name: /deselect system user/i }));
    fireEvent.click(screen.getByRole("button", { name: /^close$/i }));

    expect(onChange).not.toHaveBeenCalled();
    expect(onSave).not.toHaveBeenCalled();

    openDialog();
    expect(
      (await screen.findByRole("checkbox", { name: /deselect system user/i })).getAttribute(
        "data-state",
      ),
    ).toBe("checked");
  });

  it("commits the complete staged selection only after Add is clicked", async () => {
    const onChange = vi.fn();
    const onSave = vi.fn();

    render(
      <AddOrganizationRole
        roles={[h.roles[0]]}
        onChange={onChange}
        onSave={onSave}
      />,
      { wrapper: createWrapper() },
    );

    openDialog();
    fireEvent.click(await screen.findByRole("checkbox", { name: /select test/i }));
    fireEvent.click(screen.getByRole("checkbox", { name: /deselect system user/i }));

    expect(onChange).not.toHaveBeenCalled();
    expect(onSave).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: /^add$/i }));

    expect(onChange).toHaveBeenCalledWith([h.roles[1]]);
    await waitFor(() => expect(onSave).toHaveBeenCalledOnce());
  });

  it("lets more than five roles be selected and saved (IAM enforces no role cap)", async () => {
    const many = Array.from({ length: 7 }, (_, i) => ({
      itemId: `many-${i + 1}`,
      name: `Role ${i + 1}`,
      slug: `role_${i + 1}`,
      description: "",
    })) as IRole[];
    h.assignable = many;
    const onChange = vi.fn();
    const onSave = vi.fn();

    render(
      <AddOrganizationRole roles={[many[0]]} onChange={onChange} onSave={onSave} />,
      { wrapper: createWrapper() },
    );

    openDialog();
    for (const role of many.slice(1)) {
      const box = await screen.findByRole("checkbox", { name: `Select ${role.name}` });
      expect((box as HTMLButtonElement).disabled).toBe(false);
      fireEvent.click(box);
    }

    expect((await screen.findByLabelText("7 roles selected") as HTMLElement).textContent).toBe("7 selected");
    fireEvent.click(screen.getByRole("button", { name: /^add$/i }));

    expect(onChange).toHaveBeenCalledWith(many);
    await waitFor(() => expect(onSave).toHaveBeenCalledOnce());
  });
});

describe("OrganizationRolesField", () => {
  it("shows the minimum-role requirement beside the Roles title", async () => {
    render(
      <OrganizationRolesField roles={[h.roles[0]]} onChange={vi.fn()} />,
      { wrapper: createWrapper() },
    );

    const infoButton = screen.getByRole("button", {
      name: /role assignment requirement/i,
    });
    expect(infoButton).toBeTruthy();
    expect(
      await screen.findAllByText(
        "At least one role must remain assigned to this user to access resources.",
      ),
    ).not.toHaveLength(0);
  });

  it("prevents removing the final table role and skips saving", async () => {
    const onChange = vi.fn();
    const onSave = vi.fn();

    render(
      <OrganizationRolesField
        roles={[h.roles[0]]}
        onChange={onChange}
        onSave={onSave}
      />,
      { wrapper: createWrapper() },
    );

    fireEvent.click(screen.getByRole("button", { name: /remove system user/i }));
    fireEvent.click(await screen.findByRole("button", { name: /^yes$/i }));

    expect(h.showErrorToast).toHaveBeenCalledWith({
      errors: "At least one role must remain assigned to this user to access resources.",
    });
    expect(onChange).not.toHaveBeenCalled();
    expect(onSave).not.toHaveBeenCalled();
  });

  it("still removes and saves a table role when another role remains", async () => {
    const onChange = vi.fn();
    const onSave = vi.fn();

    render(
      <OrganizationRolesField
        roles={h.roles}
        onChange={onChange}
        onSave={onSave}
      />,
      { wrapper: createWrapper() },
    );

    fireEvent.click(screen.getByRole("button", { name: /remove system user/i }));
    fireEvent.click(await screen.findByRole("button", { name: /^yes$/i }));

    const updateRoles = onChange.mock.calls[0][0] as (roles: IRole[]) => IRole[];
    expect(updateRoles(h.roles)).toEqual([h.roles[1]]);
    expect(h.showErrorToast).not.toHaveBeenCalled();
    await waitFor(() => expect(onSave).toHaveBeenCalledOnce());
  });
});
