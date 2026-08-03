import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  tabId: "overview",
  setTabId: vi.fn(),
  userById: {} as Record<string, unknown>,
}));

vi.mock("nuqs", () => ({
  useQueryState: (_key: string, opts: { defaultValue: string }) => [h.tabId || opts.defaultValue, h.setTabId],
}));
vi.mock("../user-profile-sidebar", () => ({
  UserProfileSidebar: () => <div data-testid="sidebar" />,
}));
vi.mock("@blocks-idp/iam/modules/user-management/update-user", () => ({
  UpdateUser: () => <div data-testid="update-user" />,
}));
vi.mock("@/components/breadcrumb/breadcrumb", () => ({ default: () => <div data-testid="breadcrumb" /> }));
vi.mock("@/components/copy-to-clipboard-button", () => ({
  CopyToClipboardButton: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock("@blocks-idp/iam/hooks/use-user", () => ({
  useGetUserById: () => h.userById,
}));

import { UserProfileShell } from "./user-profile-shell";

const tabs = [
  { value: "overview", label: "Overview", render: () => <div>overview-content</div> },
  { value: "security", label: "Security", render: () => <div>security-content</div> },
];

beforeEach(() => {
  vi.clearAllMocks();
  h.tabId = "overview";
  h.userById = { data: { data: { firstName: "Ada", lastName: "Lovelace", email: "ada@x.com" } } };
});

describe("UserProfileShell", () => {
  it("renders the profile heading with the display name and email", () => {
    render(<UserProfileShell id="u1" projectKey="p1" tabs={tabs} />);
    expect(screen.getByText("Ada Lovelace")).toBeTruthy();
    expect(screen.getByText("ada@x.com")).toBeTruthy();
    expect(screen.getByTestId("sidebar")).toBeTruthy();
  });

  it("renders the tab triggers and the active tab content", () => {
    render(<UserProfileShell id="u1" projectKey="p1" tabs={tabs} />);
    expect(screen.getAllByText("Overview").length).toBeGreaterThan(0);
    expect(screen.getByText("overview-content")).toBeTruthy();
  });

  it("falls back to the Profile heading when the user has no name", () => {
    h.userById = { data: { data: { firstName: "", lastName: "", email: "" } } };
    render(<UserProfileShell id="u1" projectKey="p1" tabs={tabs} />);
    expect(screen.getByText("Profile")).toBeTruthy();
  });

  it("renders the edit-user trigger and the right slot", () => {
    render(
      <UserProfileShell
        id="u1"
        projectKey="p1"
        tabs={tabs}
        rightSlot={<div data-testid="right-slot" />}
      />,
    );
    expect(screen.getByTestId("update-user")).toBeTruthy();
    expect(screen.getAllByTestId("right-slot").length).toBeGreaterThan(0);
  });
});
