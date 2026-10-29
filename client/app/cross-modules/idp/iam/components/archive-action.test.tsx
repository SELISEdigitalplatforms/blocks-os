import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

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

const h = vi.hoisted(() => ({
  role: { data: undefined as unknown, isLoading: false, isError: false },
  permission: { data: undefined as unknown, isLoading: false, isError: false },
  roleSpy: vi.fn(),
  permissionSpy: vi.fn(),
  successToast: vi.fn(),
  errorToast: vi.fn(),
}));

// See the mock for why the tooltip barrel cannot be imported under jsdom.
vi.mock(
  "@/components/ui-kits/tooltip/tooltip",
  () => import("@/test-utils/__mocks__/tooltip.mock"),
);

vi.mock("@/hooks/use-toast", () => ({
  showSuccessToast: (...a: unknown[]) => h.successToast(...a),
  showErrorToast: (...a: unknown[]) => h.errorToast(...a),
}));

vi.mock("../hooks/use-archive-impact", () => ({
  useRoleArchiveImpact: (id: string, opts: { enabled: boolean }) => {
    h.roleSpy(id, opts);
    return h.role;
  },
  usePermissionArchiveImpact: (id: string, opts: { enabled: boolean }) => {
    h.permissionSpy(id, opts);
    return h.permission;
  },
}));

import { ArchiveAction } from "./archive-action";

const roleImpact = (overrides: Record<string, unknown> = {}) => ({
  isSuccess: true,
  slug: "manager",
  name: "Manager",
  isMultiOrgEnabled: true,
  organizationCount: 2,
  affectedUserCount: 3,
  activeUserCount: 3,
  blocked: false,
  blockingReason: null,
  ...overrides,
});

const permissionImpact = (overrides: Record<string, unknown> = {}) => ({
  isSuccess: true,
  resource: "reports::export",
  name: "Export",
  isMultiOrgEnabled: true,
  organizationCount: 2,
  affectedUserCount: 2,
  roleBindingCount: 3,
  blocked: false,
  blockingReason: null,
  ...overrides,
});

const renderAction = (props: Partial<Parameters<typeof ArchiveAction>[0]> = {}) => {
  const archive = props.archive ?? vi.fn().mockResolvedValue({ isSuccess: true });
  render(
    <ArchiveAction
      entity="role"
      name="Manager"
      itemId="r1"
      isPending={false}
      {...props}
      archive={archive}
    />,
  );
  return archive;
};

const openDialog = async () => {
  await userEvent.click(screen.getByRole("button", { name: /^Archive role|^Archive permission/ }));
};

const confirmButton = () => screen.getByRole("button", { name: "Archive" });

describe("ArchiveAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.role = { data: undefined, isLoading: false, isError: false };
    h.permission = { data: undefined, isLoading: false, isError: false };
  });

  it("does not fetch impact while the dialog is closed", () => {
    renderAction();

    // One ArchiveAction renders per row, so an unguarded query would fire one cross-organization
    // aggregate per row on every page load.
    expect(h.roleSpy).toHaveBeenCalledWith("r1", { enabled: false });
  });

  it("fetches impact once opened", async () => {
    renderAction();

    await openDialog();

    expect(h.roleSpy).toHaveBeenLastCalledWith("r1", { enabled: true });
  });

  it("archives in one click and sends no consent when nothing is affected", async () => {
    h.role = {
      data: roleImpact({ organizationCount: 0, affectedUserCount: 0, activeUserCount: 0 }),
      isLoading: false,
      isError: false,
    };
    const archive = renderAction();

    await openDialog();

    expect(screen.queryByRole("checkbox")).toBeNull();
    await userEvent.click(confirmButton());

    expect(archive).toHaveBeenCalledWith({ id: "r1", confirmRevokeFromUsers: false });
  });

  it("requires consent before confirming when users are affected", async () => {
    h.role = { data: roleImpact(), isLoading: false, isError: false };
    const archive = renderAction();

    await openDialog();

    expect(screen.getByText(/2 other organizations/)).toBeTruthy();
    expect(screen.getAllByText(/3 users/).length).toBeGreaterThan(0);
    // It must be impossible to confirm a revocation without agreeing to it.
    expect((confirmButton() as HTMLButtonElement).disabled).toBe(true);

    await userEvent.click(screen.getByRole("checkbox"));
    expect((confirmButton() as HTMLButtonElement).disabled).toBe(false);

    await userEvent.click(confirmButton());
    expect(archive).toHaveBeenCalledWith({ id: "r1", confirmRevokeFromUsers: true });
  });

  it("keeps the consent checkbox at its own size next to the wrapping label", async () => {
    // Without `shrink-0` the flex row squeezes the 16px box, and ticking it widens the box again --
    // a visible jump on click. Pinned because the class is otherwise trivially droppable.
    h.role = { data: roleImpact(), isLoading: false, isError: false };
    renderAction();
    await openDialog();

    const consent = screen.getByRole("checkbox");
    expect(consent.className).toContain("shrink-0");
    await userEvent.click(consent);
    expect(consent.className).toContain("shrink-0");
  });

  it("requires consent for an inactive-only holder too", async () => {
    // The backend scrub is unconditional over the organization's users, so an inactive holder
    // loses the assignment just as permanently. Gating on activeUserCount would take consent for
    // a strictly smaller consequence than the one delivered.
    h.role = {
      data: roleImpact({ affectedUserCount: 1, activeUserCount: 0 }),
      isLoading: false,
      isError: false,
    };
    renderAction();

    await openDialog();

    expect(screen.getByRole("checkbox")).toBeTruthy();
    expect((confirmButton() as HTMLButtonElement).disabled).toBe(true);
  });

  it("omits organization wording for a single-organization tenant", async () => {
    h.role = {
      data: roleImpact({ isMultiOrgEnabled: false, organizationCount: 0, affectedUserCount: 1 }),
      isLoading: false,
      isError: false,
    };
    renderAction();

    await openDialog();

    expect(screen.queryByText(/organization/i)).toBeNull();
    expect(screen.getAllByText(/1 user/).length).toBeGreaterThan(0);
  });

  it("states that access ends at next sign-in rather than immediately", async () => {
    h.role = { data: roleImpact(), isLoading: false, isError: false };
    renderAction();

    await openDialog();

    // Roles are stamped into the access token, and no token_version bump happens, so promising
    // instant revocation would overstate what the system does.
    expect(screen.getByText(/until they next sign in/i)).toBeTruthy();
  });

  it("refuses a blocked role, showing the reason and no consent control", async () => {
    h.role = {
      data: roleImpact({ blocked: true, blockingReason: "Role_Has_Child_Roles" }),
      isLoading: false,
      isError: false,
    };
    renderAction();

    await openDialog();

    expect(screen.getByText(/has child roles/i)).toBeTruthy();
    expect(screen.queryByRole("checkbox")).toBeNull();
    expect((confirmButton() as HTMLButtonElement).disabled).toBe(true);
    // The counts still render: the dialog explains the refusal rather than just stating it.
    expect(screen.getAllByText(/3 users/).length).toBeGreaterThan(0);
  });

  it("disables confirming while the impact is loading", async () => {
    h.role = { data: undefined, isLoading: true, isError: false };
    renderAction();

    await openDialog();

    expect(screen.getByTestId("archive-impact-loading")).toBeTruthy();
    expect((confirmButton() as HTMLButtonElement).disabled).toBe(true);
  });

  it("still allows a plain archive when the impact request fails", async () => {
    h.role = { data: undefined, isLoading: false, isError: true };
    const archive = renderAction();

    await openDialog();

    // An unavailable preview must not make archiving impossible.
    expect(screen.getByText(/could not be loaded/i)).toBeTruthy();
    expect((confirmButton() as HTMLButtonElement).disabled).toBe(false);

    await userEvent.click(confirmButton());
    expect(archive).toHaveBeenCalledWith({ id: "r1", confirmRevokeFromUsers: false });
  });

  it("resets consent when the dialog is reopened", async () => {
    h.role = { data: roleImpact(), isLoading: false, isError: false };
    renderAction();

    await openDialog();
    await userEvent.click(screen.getByRole("checkbox"));
    expect((confirmButton() as HTMLButtonElement).disabled).toBe(false);

    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    await openDialog();

    // Consent is never carried over: what the user agreed to must be what they were just shown.
    expect(screen.getByRole("checkbox").getAttribute("data-state")).toBe("unchecked");
    expect((confirmButton() as HTMLButtonElement).disabled).toBe(true);
  });

  it("uses permission-specific copy naming direct grants and role references", async () => {
    h.permission = { data: permissionImpact(), isLoading: false, isError: false };
    renderAction({ entity: "permission", name: "Export", itemId: "p1" });

    await openDialog();

    // Direct User.Permissions grants and Permission.Roles bindings are different populations, and
    // only the first mints a token claim -- so they are described separately.
    expect(screen.getByText(/granted directly to 2 users/)).toBeTruthy();
    expect(screen.getByText(/referenced by 3 roles/)).toBeTruthy();
  });

  it("keeps the dialog open and toasts the mapped reason when the archive fails", async () => {
    h.role = {
      data: roleImpact({ affectedUserCount: 0, organizationCount: 0 }),
      isLoading: false,
      isError: false,
    };
    const archive = vi.fn().mockRejectedValue({
      errors: { dependency: "Role_Has_Active_User_Assignments" },
    });
    renderAction({ archive });

    await openDialog();
    await userEvent.click(confirmButton());

    await waitFor(() => expect(h.errorToast).toHaveBeenCalledTimes(1));
    expect(screen.getByRole("button", { name: "Archive" })).toBeTruthy();
    expect(h.successToast).not.toHaveBeenCalled();
  });
});
