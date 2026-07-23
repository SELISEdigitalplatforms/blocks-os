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

// The tooltip ui-kit re-exports from blocks-kit, which imports motion-utils and
// touches process.env at module load; a passthrough keeps the tree renderable.
vi.mock("@/components/ui-kits/tooltip/tooltip", () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipTrigger: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
  TooltipContent: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
  TooltipProvider: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
}));

vi.mock("./remove-membership", () => ({
  RemoveMembership: () => <div data-testid="remove-membership" />,
}));

vi.mock("./edit-membership", () => ({
  EditMembership: () => <div data-testid="edit-membership" />,
}));

import { UserMembershipsList } from "./user-memberships-list";
import { IMembership } from "@blocks-idp/iam/models/user";

const orgNameMap = new Map<string, string>([["org-1", "Acme"]]);

const membership: IMembership = {
  organizationId: "org-1",
  roles: ["admin", "editor"],
  permissions: ["p1", "p2", "p3", "p4", "p5", "p6"],
};

const baseProps = {
  orgNameMap,
  userId: "user-1",
  projectKey: "p1",
};

describe("UserMembershipsList", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders loading skeletons and no table while loading", () => {
    const { container } = render(
      <UserMembershipsList memberships={[]} isLoading {...baseProps} />,
    );
    expect(container.querySelector("table")).toBeNull();
    expect(screen.queryByText("No organization memberships found")).toBeNull();
  });

  it("shows the empty-state message when there are no memberships", () => {
    render(
      <UserMembershipsList
        memberships={[]}
        isLoading={false}
        {...baseProps}
      />,
    );
    expect(
      screen.getByText("No organization memberships found"),
    ).toBeTruthy();
  });

  it("resolves the org name, joins roles and truncates permission badges", () => {
    render(
      <UserMembershipsList
        memberships={[membership]}
        isLoading={false}
        {...baseProps}
      />,
    );
    // Org name resolved via the map
    expect(screen.getByText("Acme")).toBeTruthy();
    // Roles joined
    expect(screen.getByText("admin, editor")).toBeTruthy();
    // First four permissions rendered as badges
    expect(screen.getByText("p1")).toBeTruthy();
    expect(screen.getByText("p4")).toBeTruthy();
    // Overflow badge for the remaining two
    expect(screen.getByText("+2")).toBeTruthy();
  });

  it("falls back to the org id and a dash when name/roles are missing", () => {
    render(
      <UserMembershipsList
        memberships={[{ organizationId: "org-unknown", roles: [], permissions: [] }]}
        isLoading={false}
        {...baseProps}
      />,
    );
    // No map entry -> falls back to raw org id
    expect(screen.getByText("org-unknown")).toBeTruthy();
    // Empty roles and empty permissions both render a dash placeholder.
    expect(screen.getAllByText("-")).toHaveLength(2);
  });

  it("opens the actions menu with Configure and Unassign options", async () => {
    const user = userEvent.setup();
    render(
      <UserMembershipsList
        memberships={[membership]}
        isLoading={false}
        {...baseProps}
      />,
    );
    await user.click(screen.getByRole("button"));
    expect(screen.getByText("Configure")).toBeTruthy();
    expect(screen.getByText("Unassign User")).toBeTruthy();
  });
});
