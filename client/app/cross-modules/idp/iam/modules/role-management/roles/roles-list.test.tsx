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

const navigate = vi.fn();

vi.mock("react-router", () => ({
  useNavigate: () => navigate,
}));

vi.mock("@seliseblocks/genesis-os/hooks", () => ({
  useScopedPath: () => (path: string) => `/scoped/${path}`,
}));

vi.mock("./roles-filter-toolbar", () => ({
  useRolesSortQueryParams: () => ({
    sortQueryParams: { property: "Name", isDescending: false },
    setSortQueryParams: vi.fn(),
  }),
}));

vi.mock("@/components/filter-toolbar", () => ({
  FilterControls: {
    SortHeader: ({ label }: { label: string }) => <span>{label}</span>,
  },
}));

const successToast = vi.fn();
const errorToast = vi.fn();
vi.mock("@/hooks/use-toast", () => ({
  showSuccessToast: (...a: unknown[]) => successToast(...a),
  showErrorToast: (...a: unknown[]) => errorToast(...a),
}));

// ArchiveAction now previews the archive's blast radius. These list tests are about the list, not
// the preview, so it is stubbed to "loaded, nothing affected" -- the shape that yields a plain
// one-click confirm with no consent checkbox, exactly as before impact counts existed.
const impactData = { value: undefined as unknown, isLoading: false, isError: false };
vi.mock("@blocks-idp/iam/hooks/use-archive-impact", () => ({
  useRoleArchiveImpact: () => ({
    data: impactData.value,
    isLoading: impactData.isLoading,
    isError: impactData.isError,
  }),
  usePermissionArchiveImpact: () => ({
    data: impactData.value,
    isLoading: impactData.isLoading,
    isError: impactData.isError,
  }),
}));

const archiveRole = vi.fn();
const archivePending = { value: false, perCall: [] as boolean[] };
const useDeleteRoleSpy = vi.fn();
vi.mock("@blocks-idp/iam/hooks/use-roles", () => ({
  useDeleteRole: () => {
    useDeleteRoleSpy();
    // perCall lets a test give each row its own pending value, which is the only way to observe
    // whether the state is really per row rather than shared.
    const pending = archivePending.perCall.length
      ? (archivePending.perCall.shift() ?? false)
      : archivePending.value;
    return { mutateAsync: archiveRole, isPending: pending };
  },
}));

vi.mock("../update-role/update-role", () => ({
  UpdateRole: ({ role }: { role: { name: string } }) => (
    <div data-testid="update-role-dialog">Editing {role.name}</div>
  ),
}));

import { RolesList } from "./roles-list";
import { IRole } from "@blocks-idp/iam/models/role";
import { ARCHIVE_ERROR_MESSAGES } from "@blocks-idp/iam/constants/archive-error-messages";

const role = {
  itemId: "role-1",
  name: "Administrator",
  slug: "administrator",
  description: "Full access role",
  ancestorRoleSlugs: [],
  parentRoleSlug: null,
  canCreateOwn: true,
  count: 7,
  createdFromDefault: false,
  createdDate: "2024-01-01",
  lastUpdatedDate: "2024-01-01",
  createdBy: "system",
  language: null,
  lastUpdatedBy: "system",
  organizationId: "org-1",
  tags: [],
} as IRole;

describe("RolesList", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders loading skeletons and no table while loading", () => {
    // C5. "No table" alone is satisfied by `return null`; the skeleton and its row count are what
    // actually say the loading state renders as it does today.
    const { container } = render(<RolesList roles={[]} isLoading />);
    expect(container.querySelector("table")).toBeNull();
    expect(container.querySelectorAll(".animate-pulse")).toHaveLength(5);
  });

  it("shows the empty-state message for no roles", () => {
    const { container } = render(<RolesList roles={[]} isLoading={false} />);
    expect(screen.getByText("No roles found. Please create new roles.")).toBeTruthy();
    expect(container.querySelectorAll(".animate-pulse")).toHaveLength(0);
    expect(screen.queryByRole("button", { name: /^Archive role/ })).toBeNull();
  });

  it("renders role rows with name, slug, permission count and description", () => {
    render(<RolesList roles={[role]} isLoading={false} />);
    expect(screen.getByText("Administrator")).toBeTruthy();
    expect(screen.getByText("administrator")).toBeTruthy();
    expect(screen.getByText("7")).toBeTruthy();
    expect(screen.getByText("Full access role")).toBeTruthy();
  });

  it("navigates to the role detail page when a row is clicked", async () => {
    const user = userEvent.setup();
    render(<RolesList roles={[role]} isLoading={false} />);
    await user.click(screen.getByText("Administrator"));
    expect(navigate).toHaveBeenCalledWith("/scoped/iam/role-detail/role-1");
  });

  it("opens the update-role dialog when the edit button is clicked", async () => {
    const user = userEvent.setup();
    render(<RolesList roles={[role]} isLoading={false} />);
    expect(screen.queryByTestId("update-role-dialog")).toBeNull();
    // There are two actions per row now, so select the edit button by its accessible name
    // rather than by being the only button.
    await user.click(screen.getByRole("button", { name: "Edit role Administrator" }));
    expect(screen.getByTestId("update-role-dialog")).toBeTruthy();
    expect(screen.getByText("Editing Administrator")).toBeTruthy();
    // Editing must not trigger row navigation.
    expect(navigate).not.toHaveBeenCalled();
  });
});

describe("RolesList archive action", () => {
  const renderList = (roles: IRole[]) => render(<RolesList roles={roles} isLoading={false} />);
  const trash = (name = "Administrator") =>
    screen.getByRole("button", { name: `Archive role ${name}` });

  beforeEach(() => {
    vi.clearAllMocks();
    archivePending.value = false;
    archivePending.perCall = [];
    archiveRole.mockResolvedValue({ isSuccess: true });
  });

  it("renders an archive action for a normal role", () => {
    renderList([role]);
    expect(trash()).toBeTruthy();
  });

  it("hides the archive action for a role copied from the default organization", () => {
    // H3
    renderList([{ ...role, createdFromDefault: true }]);
    expect(screen.queryByRole("button", { name: "Archive role Administrator" })).toBeNull();
  });

  it("opens a confirm dialog without sending a request", async () => {
    // H4
    const user = userEvent.setup();
    renderList([role]);
    await user.click(trash());
    expect(screen.getByText("Archive this role?")).toBeTruthy();
    expect(archiveRole).not.toHaveBeenCalled();
  });

  it("cancels without sending a request", async () => {
    // H5
    const user = userEvent.setup();
    renderList([role]);
    await user.click(trash());
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(archiveRole).not.toHaveBeenCalled();
  });

  it("archives on confirm, toasts success and closes", async () => {
    // H2
    const user = userEvent.setup();
    renderList([role]);
    await user.click(trash());
    await user.click(screen.getByRole("button", { name: "Archive" }));

    expect(archiveRole).toHaveBeenCalledWith(expect.objectContaining({ id: "role-1" }));
    expect(successToast).toHaveBeenCalled();
    expect(errorToast).not.toHaveBeenCalled();
    expect(screen.queryByText("Archive this role?")).toBeNull();
  });

  it("toasts the mapped reason on rejection and keeps the dialog open", async () => {
    // C1. A rejection arrives thrown, so a handler written as `if (!res.isSuccess)` would fall
    // through to the success path -- this is the assertion that catches that.
    archiveRole.mockRejectedValue(
      Object.assign(new Error("bad request"), {
        errors: { dependency: "Role_Has_Child_Roles" },
      }),
    );
    const user = userEvent.setup();
    renderList([role]);
    await user.click(trash());
    await user.click(screen.getByRole("button", { name: "Archive" }));

    expect(successToast).not.toHaveBeenCalled();
    // The raw dictionary and the map, not a pre-mapped array: showErrorToast does the lookup,
    // and handing it an array would collapse to "An unexpected error occurred."
    expect(errorToast).toHaveBeenCalledWith({
      errors: { dependency: "Role_Has_Child_Roles" },
      customMessages: ARCHIVE_ERROR_MESSAGES,
    });
    expect(screen.getByText("Archive this role?")).toBeTruthy();
  });

  it("handles a transport-style failure through the same path", async () => {
    // C2. No special-cased branch: an error with no usable dictionary still produces copy.
    archiveRole.mockRejectedValue(new TypeError("Failed to fetch"));
    const user = userEvent.setup();
    renderList([role]);
    await user.click(trash());
    await user.click(screen.getByRole("button", { name: "Archive" }));

    expect(successToast).not.toHaveBeenCalled();
    expect(errorToast).toHaveBeenCalledWith({
      errors: "Something went wrong while archiving.",
      customMessages: ARCHIVE_ERROR_MESSAGES,
    });
  });

  it("never navigates from the trash button, the dialog or its cancel", async () => {
    // H6. The row navigates on click and React events bubble through the component tree even
    // though the dialog is portalled, so the dialog's own buttons are checked too.
    const user = userEvent.setup();
    renderList([role]);
    await user.click(trash());
    expect(navigate).not.toHaveBeenCalled();

    // Confirm: the click that both mutates and could bubble to the row.
    await user.click(screen.getByRole("button", { name: "Archive" }));
    expect(navigate).not.toHaveBeenCalled();

    // And Cancel on a freshly opened dialog.
    await user.click(trash());
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(navigate).not.toHaveBeenCalled();
  });

  it("drops the open dialog rather than retargeting it when the list changes underneath", async () => {
    // The dangerous shape here would be a row component reused with a stale open=true and a new
    // itemId, so Confirm archives a role the user never picked. Measured behaviour is the safe
    // one: the row remounts and the dialog closes with no archive call. Asserted so that a
    // regression to a reused-and-still-open dialog fails here instead of in production.
    const other: IRole = { ...role, itemId: "role-other", name: "Auditor" };
    const user = userEvent.setup();
    const { rerender } = render(<RolesList roles={[other, role]} isLoading={false} />);

    await user.click(screen.getByRole("button", { name: "Archive role Administrator" }));
    expect(screen.getByRole("dialog")).toBeTruthy();

    // A refetch drops the other row.
    rerender(<RolesList roles={[role]} isLoading={false} />);

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(archiveRole).not.toHaveBeenCalled();
  });

  it("closes the confirmation on any parent re-render (known limitation)", async () => {
    // Documents real behaviour rather than desired behaviour, so it fails loudly if either
    // changes. Root cause is outside this ticket: useSortQueryParams returns a fresh
    // sortQueryParams object every render, which invalidates the columns useMemo, which gives
    // flexRender a new cell function -- a new component type, so the row subtree remounts and the
    // dialog state goes with it. A background refetch therefore dismisses an open confirmation.
    // Benign (nothing is archived, the user re-clicks) but worth fixing where sortQueryParams is
    // memoised, which would also make this assertion flip.
    const user = userEvent.setup();
    const { rerender } = render(<RolesList roles={[role]} isLoading={false} />);

    await user.click(screen.getByRole("button", { name: "Archive role Administrator" }));
    expect(document.querySelector('[role="dialog"]')).toBeTruthy();

    rerender(<RolesList roles={[role]} isLoading={false} />);

    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(archiveRole).not.toHaveBeenCalled();
  });

  it("does not navigate when the trash button is reached by keyboard", async () => {
    // Enter on a button dispatches a click, so the same stopPropagation covers the keyboard path.
    // Worth pinning: this is why there is no separate onKeyDown guard on the actions cell.
    const user = userEvent.setup();
    renderList([role]);

    await user.tab();
    await user.tab();
    await user.keyboard("{Enter}");

    expect(navigate).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toBeTruthy();
  });

  it("gives every row its own archive mutation", () => {
    // C4, part one: a hoisted hook would be called once for the whole list.
    useDeleteRoleSpy.mockClear();
    renderList([role, { ...role, itemId: "role-2", name: "Auditor" }]);
    expect(useDeleteRoleSpy).toHaveBeenCalledTimes(2);
  });

  it("does not disable one row's confirm button because another row is archiving", async () => {
    // C4, part two -- the assertion that actually matters. Row one is mid-archive, row two is
    // idle: row two's confirm must still be usable. Counting hook calls alone would pass even if
    // both rows read the same pending flag.
    archivePending.perCall = [true, false];
    const user = userEvent.setup();
    renderList([role, { ...role, itemId: "role-2", name: "Auditor" }]);

    await user.click(trash("Auditor"));
    const confirm = screen.getByRole("button", { name: "Archive" }) as HTMLButtonElement;
    expect(confirm.disabled).toBe(false);
    expect(screen.queryByRole("button", { name: "Archiving..." })).toBeNull();
  });

  it("shows the pending label while archiving", async () => {
    // C3
    archivePending.value = true;
    const user = userEvent.setup();
    renderList([role]);
    await user.click(trash());
    expect((screen.getByRole("button", { name: "Archiving..." }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("renders no archive actions in the empty state", () => {
    // C5
    render(<RolesList roles={[]} isLoading={false} />);
    expect(screen.getByText("No roles found. Please create new roles.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /^Archive role/ })).toBeNull();
  });

  it("keeps the edit dialog and the archive dialog independent", async () => {
    // C6, both directions -- proving only one of them would leave the other regression open.
    const user = userEvent.setup();
    const { unmount } = renderList([role]);

    await user.click(trash());
    expect(screen.getByText("Archive this role?")).toBeTruthy();
    expect(screen.queryByTestId("update-role-dialog")).toBeNull();
    unmount();

    renderList([role]);
    await user.click(screen.getByRole("button", { name: "Edit role Administrator" }));
    expect(screen.getByTestId("update-role-dialog")).toBeTruthy();
    expect(screen.queryByText("Archive this role?")).toBeNull();
  });
});
