import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router";
import type { User } from "@blocks-idp/iam/models/user";

const h = vi.hoisted(() => ({ navigate: vi.fn() }));

vi.mock("react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router")>();
  return { ...actual, useNavigate: () => h.navigate };
});

vi.mock("./organization-users-filter-toolbar", () => ({
  useOrganizationUsersSortQueryParams: () => ({
    sortQueryParams: { property: "", isDescending: false },
    setSortQueryParams: vi.fn(),
  }),
}));

vi.mock("@/components/filter-toolbar", () => ({
  FilterControls: {
    SortHeader: ({ label }: { label: string }) => <span>{label}</span>,
  },
}));

vi.mock("@/components/copy-to-clipboard-button", () => ({
  CopyToClipboardButton: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
}));

import { OrganizationUsersTable } from "./organization-users-table";

const user = (over: Partial<User> = {}): User =>
  ({
    itemId: "u-1",
    firstName: "Grace",
    lastName: "Hopper",
    email: "grace@example.com",
    logInCount: 12,
    lastLoggedInTime: "2024-05-01T10:00:00.000Z",
    active: true,
    ...over,
  }) as User;

const renderTable = (props: Parameters<typeof OrganizationUsersTable>[0]) =>
  render(
    <MemoryRouter>
      <OrganizationUsersTable {...props} />
    </MemoryRouter>,
  );

describe("OrganizationUsersTable", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders loading skeletons while loading", () => {
    const { container } = renderTable({ users: [], isLoading: true });
    expect(container.querySelectorAll(".animate-pulse").length).toBeGreaterThan(0);
    expect(screen.queryByText("No results found.")).toBeNull();
  });

  it("shows the empty state when there are no users", () => {
    renderTable({ users: [], isLoading: false });
    expect(screen.getByText("No results found.")).toBeTruthy();
  });

  it("renders a row with name, email, login count and an active status badge", () => {
    renderTable({ users: [user()], isLoading: false });
    expect(screen.getByText("Grace Hopper")).toBeTruthy();
    expect(screen.getByText("grace@example.com")).toBeTruthy();
    expect(screen.getByText("12")).toBeTruthy();
    expect(screen.getByText("Active")).toBeTruthy();
  });

  it("renders an inactive badge and a dash for an invalid last-login date", () => {
    renderTable({
      users: [user({ active: false, lastLoggedInTime: "" })],
      isLoading: false,
    });
    expect(screen.getByText("Inactive")).toBeTruthy();
  });

  it("navigates to the user detail route when a row is clicked", async () => {
    const clicker = userEvent.setup();
    renderTable({ users: [user({ itemId: "u-99" })], isLoading: false });
    await clicker.click(screen.getByText("Grace Hopper"));
    expect(h.navigate).toHaveBeenCalledWith("/services/iam/user-detail/u-99");
  });
});
