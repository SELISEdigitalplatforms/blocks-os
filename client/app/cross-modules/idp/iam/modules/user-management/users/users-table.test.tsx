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
      <UsersTable users={props.users ?? [user()]} isLoading={props.isLoading ?? false} />
    </MemoryRouter>,
  );

beforeEach(() => vi.clearAllMocks());

describe("UsersTable", () => {
  it("renders a row per user with name and status", () => {
    renderTable({ users: [user({ active: true })] });
    expect(screen.getByText("Ada Lovelace")).toBeTruthy();
    expect(screen.getByText("Active")).toBeTruthy();
  });

  it("renders the inactive badge for inactive users", () => {
    renderTable({ users: [user({ active: false })] });
    expect(screen.getByText("Inactive")).toBeTruthy();
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
  });

  it("renders the loading skeleton while loading", () => {
    const { container } = renderTable({ isLoading: true });
    expect(container.querySelector(".flex-col")).not.toBeNull();
    expect(screen.queryByText("Ada Lovelace")).toBeNull();
  });

  it("navigates to the user detail on row click", () => {
    renderTable({ users: [user({ itemId: "u9" })] });
    fireEvent.click(screen.getByText("Ada Lovelace"));
    expect(h.navigate).toHaveBeenCalledWith("/base/iam/user-detail/u9");
  });
});
