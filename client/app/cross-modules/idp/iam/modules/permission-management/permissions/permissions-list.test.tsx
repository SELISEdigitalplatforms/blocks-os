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
  Link: ({ to, children }: { to: string; children: React.ReactNode }) => (
    <a href={to} data-testid="edit-link">
      {children}
    </a>
  ),
}));

vi.mock("@seliseblocks/genesis-os/hooks", () => ({
  useScopedPath: () => (path: string) => `/scoped/${path}`,
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

const archivePermission = vi.fn();
const archivePending = { value: false, perCall: [] as boolean[] };
const useDeletePermissionSpy = vi.fn();
vi.mock("@blocks-idp/iam/hooks/use-permission", () => ({
  useDeletePermission: () => {
    useDeletePermissionSpy();
    // perCall gives each row its own pending value, which is the only way to tell a per-row hook
    // from one shared flag.
    const pending = archivePending.perCall.length
      ? (archivePending.perCall.shift() ?? false)
      : archivePending.value;
    return { mutateAsync: archivePermission, isPending: pending };
  },
}));

vi.mock("./permissions-filter-toolbar", () => ({
  usePermissionsSortQuaryParams: () => ({
    sortQueryParams: { property: "Name", isDescending: false },
    setSortQueryParams: vi.fn(),
  }),
}));

vi.mock("@/components/filter-toolbar", () => ({
  FilterControls: {
    SortHeader: ({ label }: { label: string }) => <span>{label}</span>,
  },
}));

import { PermissionsList } from "./permissions-list";
import { IPermission, PermissionSeverityLevel } from "@blocks-idp/iam/models/permission";

const customPermission = {
  itemId: "perm-custom",
  name: "Manage Billing",
  type: 1,
  description: "",
  resource: "billing",
  resourceGroup: "finance",
  projectKey: "p1",
  tags: [],
  roles: ["admin", "owner"],
  dependentPermissions: [],
  isArchived: false,
  isBuiltIn: false,
  language: null,
  organizationIds: [],
  permissionSeverity: PermissionSeverityLevel.Critical,
} as IPermission;

const builtInPermission = {
  ...customPermission,
  itemId: "perm-builtin",
  name: "Read Users",
  resource: "users",
  roles: [],
  isBuiltIn: true,
  permissionSeverity: PermissionSeverityLevel.Low,
} as IPermission;

describe("PermissionsList", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders loading skeletons and no table while loading", () => {
    // C5. Asserting only "no table" would be satisfied by `return null`, so the skeleton itself and
    // its row count are pinned.
    const { container } = render(<PermissionsList permissions={[]} isLoading />);
    expect(container.querySelector("table")).toBeNull();
    expect(container.querySelectorAll(".animate-pulse")).toHaveLength(5);
  });

  it("shows the empty-state message for no permissions", () => {
    const { container } = render(<PermissionsList permissions={[]} isLoading={false} />);
    expect(screen.getByText("No permission found. Please create new permission.")).toBeTruthy();
    // No skeleton and no per-row actions on the empty state.
    expect(container.querySelectorAll(".animate-pulse")).toHaveLength(0);
    expect(screen.queryByRole("button", { name: /^Archive permission/ })).toBeNull();
  });

  it("renders permission rows with name, resource, source, severity and role count", () => {
    render(
      <PermissionsList permissions={[customPermission, builtInPermission]} isLoading={false} />,
    );
    expect(screen.getByText("Manage Billing")).toBeTruthy();
    expect(screen.getByText("Read Users")).toBeTruthy();
    expect(screen.getByText("billing")).toBeTruthy();
    // isBuiltIn column
    expect(screen.getByText("Custom")).toBeTruthy();
    expect(screen.getByText("Built In")).toBeTruthy();
    // severity badges
    expect(screen.getByText("Critical")).toBeTruthy();
    expect(screen.getByText("Low")).toBeTruthy();
    // roles count for the custom permission (2 roles)
    expect(screen.getByText("2")).toBeTruthy();
  });

  it("only renders an edit link for custom (non built-in) permissions", () => {
    render(
      <PermissionsList permissions={[customPermission, builtInPermission]} isLoading={false} />,
    );
    const links = screen.getAllByTestId("edit-link");
    expect(links).toHaveLength(1);
    // Full equality, including the /scoped prefix. `toContain("perm-custom")` passed just as
    // happily when the link was hard-coded to the unscoped /app/iam route -- and the row click
    // that used to supply the scope no longer fires, because the actions cell stops propagation.
    expect(links[0].getAttribute("href")).toBe("/scoped/iam/permission-detail/perm-custom");
  });

  it("navigates to the permission detail page when a row is clicked", async () => {
    const user = userEvent.setup();
    render(<PermissionsList permissions={[customPermission]} isLoading={false} />);
    await user.click(screen.getByText("Manage Billing"));
    expect(navigate).toHaveBeenCalledWith("/scoped/iam/permission-detail/perm-custom");
  });
});

describe("PermissionsList archive action", () => {
  const renderList = (permissions: IPermission[]) =>
    render(<PermissionsList permissions={permissions} isLoading={false} />);
  const trash = (name = "Manage Billing") =>
    screen.getByRole("button", { name: `Archive permission ${name}` });

  beforeEach(() => {
    vi.clearAllMocks();
    archivePending.value = false;
    archivePermission.mockResolvedValue({ isSuccess: true });
  });

  it("renders an archive action for every permission, built-in included", () => {
    // C8's unit-testable half. Archiving a permission requires the caller to be in the default
    // organization, but no client-side signal for that exists, so the action cannot be hidden --
    // the rejection is what informs the user. The org-dependent behaviour is e2e-only.
    renderList([customPermission, builtInPermission]);
    expect(trash()).toBeTruthy();
    expect(trash("Read Users")).toBeTruthy();
  });

  it("opens a confirm dialog without sending a request", async () => {
    // H4
    const user = userEvent.setup();
    renderList([customPermission]);
    await user.click(trash());
    expect(screen.getByText("Archive this permission?")).toBeTruthy();
    expect(archivePermission).not.toHaveBeenCalled();
  });

  it("cancels without sending a request", async () => {
    // H5
    const user = userEvent.setup();
    renderList([customPermission]);
    await user.click(trash());
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(archivePermission).not.toHaveBeenCalled();
  });

  it("drops the open dialog rather than retargeting it when the list changes underneath", async () => {
    // See the roles-list counterpart: the row remounts and the confirmation closes, so Confirm can
    // never land on a permission the user did not choose.
    const other: IPermission = { ...customPermission, itemId: "perm-other", name: "Manage Users" };
    const user = userEvent.setup();
    const { rerender } = render(
      <PermissionsList permissions={[other, customPermission]} isLoading={false} />,
    );

    await user.click(trash("Manage Billing"));
    expect(screen.getByRole("dialog")).toBeTruthy();

    rerender(<PermissionsList permissions={[customPermission]} isLoading={false} />);

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(archivePermission).not.toHaveBeenCalled();
  });

  it("restores focus to the trash button after cancelling", async () => {
    // MINOR 1. Radix only returns focus if the button is the DialogTrigger; opening via a manual
    // setOpen leaves focus on the document body, which strands keyboard users mid-table.
    const user = userEvent.setup();
    renderList([customPermission]);
    const button = trash();

    await user.click(button);
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(document.activeElement).toBe(button);
  });

  it("does not disable one row's confirm button because another row is archiving", async () => {
    // C4 for permissions, mirroring the roles suite. The hook-call count alone would pass even if
    // every row read the same pending flag.
    archivePending.perCall = [true, false];
    const other: IPermission = { ...customPermission, itemId: "perm-other", name: "Manage Users" };
    const user = userEvent.setup();
    render(<PermissionsList permissions={[customPermission, other]} isLoading={false} />);

    await user.click(trash("Manage Users"));
    const confirm = screen.getByRole("button", { name: "Archive" }) as HTMLButtonElement;
    expect(confirm.disabled).toBe(false);
    expect(screen.queryByRole("button", { name: "Archiving..." })).toBeNull();
  });

  it("archives on confirm, toasts success and closes the dialog", async () => {
    // H1 in full: the call alone said nothing about what the user sees or whether the dialog goes.
    const user = userEvent.setup();
    renderList([customPermission]);
    await user.click(trash());
    await user.click(screen.getByRole("button", { name: "Archive" }));

    expect(archivePermission).toHaveBeenCalledWith(
      expect.objectContaining({ id: "perm-custom" }),
    );
    expect(successToast).toHaveBeenCalled();
    expect(errorToast).not.toHaveBeenCalled();
    expect(screen.queryByText("Archive this permission?")).toBeNull();
  });

  it("never navigates from the trash button, the dialog or its cancel", async () => {
    // H6. This list's Edit is a bare Link and the row itself navigates, so the wrapper has to
    // stop propagation -- including for the portalled dialog's own buttons.
    const user = userEvent.setup();
    renderList([customPermission]);
    await user.click(trash());
    expect(navigate).not.toHaveBeenCalled();
    await user.click(screen.getByText("Archive this permission?"));
    expect(navigate).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(navigate).not.toHaveBeenCalled();
  });

  it("gives every row its own archive mutation", () => {
    // C4, same reasoning as the roles list.
    useDeletePermissionSpy.mockClear();
    renderList([customPermission, builtInPermission]);
    expect(useDeletePermissionSpy).toHaveBeenCalledTimes(2);
  });

  it("shows the pending label while archiving", async () => {
    // C3
    archivePending.value = true;
    const user = userEvent.setup();
    renderList([customPermission]);
    await user.click(trash());
    expect(
      (screen.getByRole("button", { name: "Archiving..." }) as HTMLButtonElement).disabled,
    ).toBe(true);
  });

  it("renders no archive actions in the empty state", () => {
    // C5
    render(<PermissionsList permissions={[]} isLoading={false} />);
    expect(screen.getByText("No permission found. Please create new permission.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /^Archive permission/ })).toBeNull();
  });
});
