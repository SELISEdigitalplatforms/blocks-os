import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { User } from "@blocks-idp/iam/models/user";

const h = vi.hoisted(() => ({
  navigate: vi.fn(),
  setSortQueryParams: vi.fn(),
}));

vi.mock("react-router", () => ({ useNavigate: () => h.navigate }));
vi.mock("./users-filter-toolbar", () => ({
  useUsersSortQueryParams: () => ({
    sortQueryParams: { property: "FirstName", isDescending: false },
    setSortQueryParams: h.setSortQueryParams,
  }),
}));

import { UsersTable } from "./users-table";

const users = [
  {
    itemId: "u-1",
    firstName: "Ada",
    lastName: "Lovelace",
    email: "ada@example.com",
    logInCount: 5,
    lastLoggedInTime: "2024-05-01T10:00:00Z",
    active: true,
  },
  {
    itemId: "u-2",
    firstName: "Alan",
    lastName: "Turing",
    email: "alan@example.com",
    logInCount: 0,
    lastLoggedInTime: "",
    active: false,
  },
] as unknown as User[];

describe("UsersTable", () => {
  beforeEach(() => vi.clearAllMocks());

  it("shows loading skeletons and no table while loading", () => {
    const { container } = render(<UsersTable users={[]} isLoading />);
    expect(container.querySelector("table")).toBeNull();
  });

  it("shows the empty state when there are no users", () => {
    render(<UsersTable users={[]} isLoading={false} />);
    expect(screen.getByText("No results found.")).toBeTruthy();
  });

  it("renders user rows with name, email and status", () => {
    render(<UsersTable users={users} isLoading={false} />);
    expect(screen.getByText("Ada Lovelace")).toBeTruthy();
    expect(screen.getByText("alan@example.com")).toBeTruthy();
    expect(screen.getByText("Active")).toBeTruthy();
    expect(screen.getByText("Inactive")).toBeTruthy();
  });

  it("renders a dash for an invalid last-login date", () => {
    render(<UsersTable users={users} isLoading={false} />);
    const turingRow = screen.getByText("Alan Turing").closest("tr") as HTMLElement;
    expect(within(turingRow).getByText("-")).toBeTruthy();
  });

  it("navigates to the user detail page on row click", async () => {
    const user = userEvent.setup();
    render(<UsersTable users={users} isLoading={false} />);

    await user.click(screen.getByText("Ada Lovelace"));
    expect(h.navigate).toHaveBeenCalledWith("/services/iam/user-detail/u-1");
  });
});
