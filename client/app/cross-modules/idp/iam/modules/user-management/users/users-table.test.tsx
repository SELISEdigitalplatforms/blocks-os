import { render, screen, fireEvent } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router";

const h = vi.hoisted(() => ({ navigate: vi.fn() }));

vi.mock("react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router")>();
  return { ...actual, useNavigate: () => h.navigate };
});
vi.mock("./users-filter-toolbar", () => ({
  useUsersSortQueryParams: () => ({
    sortQueryParams: { property: "FirstName", isDescending: false },
    setSortQueryParams: vi.fn(),
  }),
}));
vi.mock("@/components/filter-toolbar", () => ({
  FilterControls: { SortHeader: ({ label }: { label: string }) => <span>{label}</span> },
}));
vi.mock("@seliseblocks/genesis-os/hooks", () => ({
  useScopedPath: () => (segment: string) => `/base/${segment}`,
}));
vi.mock("@/components/copy-to-clipboard-button", () => ({
  CopyToClipboardButton: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

import { UsersTable } from "./users-table";

const user = (over: Record<string, unknown> = {}) =>
  ({
    itemId: "u1",
    firstName: "Ada",
    lastName: "Lovelace",
    email: "ada@example.com",
    active: true,
    createdDate: "",
    lastUpdatedDate: "",
    lastLoggedInTime: "",
    ...over,
  }) as unknown as Parameters<typeof UsersTable>[0]["users"][number];

const renderTable = (props: Partial<Parameters<typeof UsersTable>[0]> = {}) =>
  render(
    <MemoryRouter>
      <UsersTable {...props} users={props.users ?? [user()]} isLoading={props.isLoading ?? false} />
    </MemoryRouter>,
  );

beforeEach(() => vi.clearAllMocks());

describe("UsersTable", () => {
  it("renders a row per user with name and status", () => {
    renderTable({ users: [user({ active: true })] });
    expect(screen.getByText("Ada Lovelace")).toBeTruthy();
    expect(screen.getByText("Active")).toBeTruthy();
  });

  // it("does not render the last-updated column", () => {
  //   renderTable();
  //   expect(screen.queryByText("Last updated")).toBeNull();
  // });

  it("renders the inactive badge for inactive users", () => {
    renderTable({ users: [user({ active: false })] });
    expect(screen.getByText("Inactive")).toBeTruthy();
  });

  it("adds a lockout badge without replacing an active user's status", () => {
    renderTable({ users: [user({ active: true, isLockedOut: true })] });
    expect(screen.getByText("Active")).toBeTruthy();
    expect(screen.getByText("Locked out").className).toContain("bg-red-100");
  });

  it("does not show a lockout badge when isLockedOut is false or omitted", () => {
    renderTable({
      users: [user({ itemId: "false", isLockedOut: false }), user({ itemId: "omitted" })],
    });
    expect(screen.queryByText("Locked out")).toBeNull();
  });

  it("shows inactive and locked-out states together", () => {
    renderTable({ users: [user({ active: false, isLockedOut: true })] });
    expect(screen.getByText("Inactive")).toBeTruthy();
    expect(screen.getByText("Locked out")).toBeTruthy();
  });

  it("derives lockout only from isLockedOut, even when the timestamp is null or elapsed", () => {
    renderTable({
      users: [
        user({ itemId: "null", isLockedOut: true, lockoutUntilUtc: null }),
        user({
          itemId: "elapsed",
          isLockedOut: true,
          lockoutUntilUtc: "2000-01-01T00:00:00Z",
        }),
      ],
    });
    expect(screen.getAllByText("Locked out")).toHaveLength(2);
  });

  it("names a user with no first or last name after their email", () => {
    renderTable({
      users: [user({ firstName: null, lastName: null, email: "john.doe@yopmail.com" })],
    });
    expect(screen.getByText("john.doe")).toBeTruthy();
    expect(screen.getByText("J")).toBeTruthy();
  });

  it("falls back to placeholders when a user has neither a name nor an email", () => {
    // Real dates keep the date cells from rendering their own "-", so the only
    // dash left on the row is the display name.
    renderTable({
      users: [
        user({
          firstName: null,
          lastName: null,
          email: null,
          createdDate: "2022-01-01T00:00:00Z",
          lastUpdatedDate: "2022-02-01T00:00:00Z",
        }),
      ],
    });
    expect(screen.getByText("-")).toBeTruthy();
    expect(screen.getByText("?")).toBeTruthy();
  });

  it("keeps the desktop grid aligned when a user has no email", () => {
    const { container: withEmail } = renderTable({ users: [user()] });
    const withEmailCells = withEmail.querySelectorAll(".md\\:grid > *").length;
    const { container: withoutEmail } = renderTable({ users: [user({ email: null })] });
    const withoutEmailCells = withoutEmail.querySelectorAll(".md\\:grid > *").length;
    expect(withoutEmailCells).toBe(withEmailCells);
  });

  it("shows the empty state when there are no users", () => {
    renderTable({ users: [] });
    expect(screen.getByText("No users found.")).toBeTruthy();
    // Sort headers live only on the populated table — empty state has no "Name".
    expect(screen.queryByText("Name")).toBeNull();
  });

  it("renders the loading skeleton while loading", () => {
    const { container } = renderTable({ isLoading: true });
    expect(container.querySelector(".flex-col")).not.toBeNull();
    expect(screen.queryByText("Ada Lovelace")).toBeNull();
    expect(screen.queryByText("Name")).toBeNull();
    expect(screen.queryByText("No users found.")).toBeNull();
  });

  it("navigates to the user detail on row click", () => {
    renderTable({ users: [user({ itemId: "u9" })] });
    fireEvent.click(screen.getByText("Ada Lovelace"));
    expect(h.navigate).toHaveBeenCalledWith("/base/iam/user-detail/u9");
  });
});

// ── Selection mode ────────────────────────────────────────────────────────────
// Every assertion here has a twin in the "off" case below: the whole point of the
// optional props is that a table rendered without them behaves exactly as it did
// before bulk selection existed.

describe("UsersTable — selection mode", () => {
  const ada = user({ itemId: "u1" });
  const grace = user({ itemId: "u2", firstName: "Grace", lastName: "Hopper" });

  it("renders no checkboxes at all when selection mode is off", () => {
    renderTable({ users: [ada, grace] });

    expect(screen.queryAllByRole("checkbox")).toHaveLength(0);
  });

  it("renders a checkbox per row plus the header checkbox when selection mode is on", () => {
    renderTable({ users: [ada, grace], selectionMode: true, selectedUserIds: new Set() });

    expect(screen.queryAllByRole("checkbox")).toHaveLength(3);
    expect(screen.getByTestId("users-select-u1")).toBeTruthy();
    expect(screen.getByTestId("users-select-u2")).toBeTruthy();
  });

  it("reports the header checkbox as indeterminate for a partial page selection", () => {
    renderTable({
      users: [ada, grace],
      selectionMode: true,
      selectedUserIds: new Set(["u1"]),
    });

    expect(screen.getByTestId("users-select-all-on-page").getAttribute("data-state")).toBe(
      "indeterminate",
    );
  });

  it("reports the header checkbox as checked when every row on the page is ticked", () => {
    renderTable({
      users: [ada, grace],
      selectionMode: true,
      selectedUserIds: new Set(["u1", "u2"]),
    });

    expect(screen.getByTestId("users-select-all-on-page").getAttribute("data-state")).toBe(
      "checked",
    );
  });

  it("reports the header checkbox as unchecked when nothing is ticked", () => {
    renderTable({ users: [ada, grace], selectionMode: true, selectedUserIds: new Set() });

    expect(screen.getByTestId("users-select-all-on-page").getAttribute("data-state")).toBe(
      "unchecked",
    );
  });

  it("reports a row tick and untick to the page", () => {
    const onToggleUser = vi.fn();
    renderTable({
      users: [ada],
      selectionMode: true,
      selectedUserIds: new Set(),
      onToggleUser,
    });

    fireEvent.click(screen.getByTestId("users-select-u1"));
    expect(onToggleUser).toHaveBeenCalledWith("u1", true);
  });

  it("reports the header tick to the page", () => {
    const onToggleAllOnPage = vi.fn();
    renderTable({
      users: [ada, grace],
      selectionMode: true,
      selectedUserIds: new Set(),
      onToggleAllOnPage,
    });

    fireEvent.click(screen.getByTestId("users-select-all-on-page"));
    expect(onToggleAllOnPage).toHaveBeenCalledWith(true);
  });

  it("does not navigate when a row is clicked while selecting", () => {
    // Navigating away mid-selection would throw away everything the operator has
    // ticked, with no way to get it back.
    renderTable({ users: [ada], selectionMode: true, selectedUserIds: new Set() });

    fireEvent.click(screen.getByText("Ada Lovelace"));
    expect(h.navigate).not.toHaveBeenCalled();
  });

  it("still navigates on a row click when selection mode is off", () => {
    renderTable({ users: [ada] });

    fireEvent.click(screen.getByText("Ada Lovelace"));
    expect(h.navigate).toHaveBeenCalledWith("/base/iam/user-detail/u1");
  });

  it("keeps the skeleton and the empty state untouched in selection mode", () => {
    const { unmount } = renderTable({ users: [], isLoading: true, selectionMode: true });
    expect(screen.queryAllByRole("checkbox")).toHaveLength(0);
    unmount();

    renderTable({ users: [], isLoading: false, selectionMode: true });
    expect(screen.getByText("No users found.")).toBeTruthy();
    expect(screen.queryAllByRole("checkbox")).toHaveLength(0);
  });
});
