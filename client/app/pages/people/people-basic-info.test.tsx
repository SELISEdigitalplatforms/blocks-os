import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { User } from "@blocks-idp/iam/models/user";
import { PeopleBasicInfo } from "./people-basic-info";

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

describe("PeopleBasicInfo", () => {
  it("renders name, email and joined roles for a populated user", () => {
    const user = {
      firstName: "Ada",
      lastName: "Lovelace",
      email: "ada@example.com",
      roles: { grp: ["Admin", "Editor"] },
    } as unknown as User;

    render(<PeopleBasicInfo user={user} />);

    expect(screen.getByText("Basic Information")).toBeTruthy();
    expect(screen.getByText(/Ada/)).toBeTruthy();
    expect(screen.getByText("ada@example.com")).toBeTruthy();
    expect(screen.getByText("Admin, Editor")).toBeTruthy();
  });

  it("falls back to dashes when no user is provided", () => {
    render(<PeopleBasicInfo />);

    expect(screen.getByText("Basic Information")).toBeTruthy();
    // Email and role both render the "-" placeholder.
    expect(screen.getAllByText("-").length).toBeGreaterThanOrEqual(2);
  });
});
