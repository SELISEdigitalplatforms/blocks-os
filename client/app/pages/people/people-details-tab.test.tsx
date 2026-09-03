import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { User } from "@blocks-idp/iam/models/user";
import { PeopleDetailsTab } from "./people-details-tab";

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

describe("PeopleDetailsTab", () => {
  it("renders the profile image when one is present", () => {
    const user = {
      firstName: "Ada",
      lastName: "Lovelace",
      email: "ada@example.com",
      profileImageUrl: "https://cdn.test/ada.png",
    } as unknown as User;

    render(<PeopleDetailsTab user={user} />);

    const img = screen.getByAltText("Ada Lovelace profile") as HTMLImageElement;
    expect(img.getAttribute("src")).toBe("https://cdn.test/ada.png");
    expect(screen.getByText("ada@example.com")).toBeTruthy();
    expect(screen.getByText("Latest login")).toBeTruthy();
    expect(screen.queryByText("Basic information")).toBeNull();
  });

  it("renders the fallback avatar when no image is available", () => {
    const user = {
      firstName: "Grace",
      lastName: "Hopper",
      email: "grace@example.com",
      profileImageUrl: null,
    } as unknown as User;

    render(<PeopleDetailsTab user={user} />);

    expect(screen.queryByAltText("Profile")).toBeNull();
    expect(screen.getAllByText("grace@example.com")).toHaveLength(1);
    expect(screen.getByLabelText("Profile initials").textContent).toBe("GH");
  });

  it("shows the project membership beside the avatar without repeating the name", () => {
    const user = {
      firstName: "Ada",
      lastName: "Lovelace",
      email: "ada@example.com",
    } as unknown as User;

    render(<PeopleDetailsTab user={user} projectRole="Owner" />);

    expect(screen.getByText("Owner")).toBeTruthy();
    expect(screen.queryAllByText("Ada Lovelace")).toHaveLength(0);
  });
});
