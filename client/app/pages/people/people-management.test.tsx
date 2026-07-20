import { render, screen } from "@testing-library/react";
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
  people: {
    isLoading: false,
    data: undefined as
      | {
          peoples: Array<{ peopleDetails: { email?: string } }>;
          isOwner: boolean;
        }
      | undefined,
  },
}));

vi.mock("@/hooks/use-people", () => ({
  useGetPeople: () => h.people,
}));

// Isolate the component under test from its data-fetching children.
vi.mock("./people-list", () => ({
  PeopleList: () => <div>people list</div>,
}));

vi.mock("./invite-people", () => ({
  InvitePeople: ({
    existingEmails,
    isViewerOwner,
  }: {
    existingEmails: string[];
    isViewerOwner: boolean;
  }) => (
    <div>
      <span data-testid="existing-emails">{existingEmails.join(",")}</span>
      <span data-testid="is-owner">{String(isViewerOwner)}</span>
    </div>
  ),
}));

import { PeopleManagement } from "./people-management";

describe("PeopleManagement", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.people = { isLoading: false, data: undefined };
  });

  it("shows the loading skeleton and no header while fetching", () => {
    h.people = { isLoading: true, data: undefined };
    render(<PeopleManagement />);
    expect(screen.queryByText("People")).toBeNull();
    expect(screen.queryByText("people list")).toBeNull();
  });

  it("renders the header and forwards existing emails / owner flag to InvitePeople", () => {
    h.people = {
      isLoading: false,
      data: {
        isOwner: true,
        peoples: [
          { peopleDetails: { email: "ADA@example.com" } },
          { peopleDetails: { email: "grace@example.com" } },
          { peopleDetails: { email: undefined } },
        ],
      },
    };

    render(<PeopleManagement />);

    expect(screen.getByText("People")).toBeTruthy();
    expect(screen.getByText("people list")).toBeTruthy();
    // Emails are lowercased and undefined entries filtered out.
    expect(screen.getByTestId("existing-emails").textContent).toBe(
      "ada@example.com,grace@example.com",
    );
    expect(screen.getByTestId("is-owner").textContent).toBe("true");
  });
});
