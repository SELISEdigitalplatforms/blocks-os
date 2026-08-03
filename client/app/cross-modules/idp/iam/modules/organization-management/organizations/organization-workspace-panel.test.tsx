import { render, screen, fireEvent } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  organizationResult: {} as Record<string, unknown>,
  getOrganizationByIdArgs: vi.fn(),
  selectedProject: { tenantId: "tenant-1" } as { tenantId: string } | null,
  memberCount: 0,
  tab: "details",
  setTab: vi.fn(),
}));

vi.mock("nuqs", () => ({
  useQueryState: (_key: string, opts: { defaultValue: string }) => [
    h.tab || opts.defaultValue,
    h.setTab,
  ],
}));
vi.mock("@blocks-idp/iam/hooks/use-organization", () => ({
  useGetOrganizationById: (args: unknown) => {
    h.getOrganizationByIdArgs(args);
    return h.organizationResult;
  },
}));
vi.mock("@seliseblocks/genesis-os", () => ({
  useProjectStore: () => ({ selectedProject: h.selectedProject }),
}));
vi.mock("@/components/ui-kits/skeleton/skeleton", () => ({
  Skeleton: ({ className }: { className?: string }) => (
    <div data-testid="skeleton" className={className} />
  ),
}));
vi.mock("@/components/ui-kits/tabs/tabs", () => ({
  Tabs: ({ children, value, onValueChange }: {
    children: React.ReactNode;
    value: string;
    onValueChange: (next: string) => void;
  }) => (
    <div data-testid="tabs" data-value={value}>
      {children}
      <button data-testid="change-tab" onClick={() => onValueChange("members")}>
        change tab
      </button>
    </div>
  ),
  TabsList: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  TabsTrigger: ({ children }: { children: React.ReactNode }) => (
    <button type="button">{children}</button>
  ),
  TabsContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  underlineTabsListClass: "tabs-list",
  underlineTabTriggerClass: "tab-trigger",
}));
vi.mock("@/components/copy-to-clipboard-button/copy-to-clipboard-button", () => ({
  CopyToClipboardButton: ({ textToCopy, children }: {
    textToCopy: string;
    children: React.ReactNode;
  }) => <div data-copy={textToCopy}>{children}</div>,
}));
vi.mock("@blocks-idp/iam/modules/organization-management/organization-users", () => ({
  OrganizationUsers: ({ organizationId, action }: {
    organizationId: string;
    action: React.ReactNode;
  }) => (
    <div data-testid="org-users">
      users:{organizationId}
      {action}
    </div>
  ),
  InviteOrganizationUser: ({ organizationId }: { organizationId: string }) => (
    <div data-testid="invite-user">invite:{organizationId}</div>
  ),
}));
vi.mock("./organization-actions-menu", () => ({
  OrganizationActions: ({ organization }: { organization: { itemId: string } }) => (
    <div data-testid="org-actions">actions:{organization.itemId}</div>
  ),
}));
vi.mock("./organization-details-tab", () => ({
  OrganizationDetailsTab: ({ organization }: { organization: { itemId: string } }) => (
    <div data-testid="org-details">details:{organization.itemId}</div>
  ),
}));
vi.mock("./organization-member-count", () => ({
  useOrganizationMemberCount: () => ({ count: h.memberCount, isLoading: false }),
}));

import { OrganizationWorkspacePanel } from "./organization-workspace-panel";

const organization = (over: Record<string, unknown> = {}) => ({
  itemId: "org-1",
  name: "Acme Inc",
  email: "ops@acme.test",
  logoUrl: null,
  ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  h.selectedProject = { tenantId: "tenant-1" };
  h.memberCount = 4;
  h.tab = "details";
  h.organizationResult = {
    data: { organization: organization() },
    isLoading: false,
  };
});

describe("OrganizationWorkspacePanel", () => {
  it("queries the organization with the selected project tenant", () => {
    render(<OrganizationWorkspacePanel organizationId="org-1" />);
    expect(h.getOrganizationByIdArgs).toHaveBeenCalledWith({
      itemId: "org-1",
      projectKey: "tenant-1",
    });
  });

  it("falls back to an empty project key when no project is selected", () => {
    h.selectedProject = null;
    render(<OrganizationWorkspacePanel organizationId="org-1" />);
    expect(h.getOrganizationByIdArgs).toHaveBeenCalledWith({
      itemId: "org-1",
      projectKey: "",
    });
  });

  it("renders skeletons instead of the organization while it loads", () => {
    h.organizationResult = { data: undefined, isLoading: true };
    render(<OrganizationWorkspacePanel organizationId="org-1" />);
    expect(screen.getAllByTestId("skeleton").length).toBeGreaterThan(0);
    expect(screen.queryByText("Acme Inc")).toBeNull();
    expect(screen.queryByTestId("org-actions")).toBeNull();
  });

  it("renders the loading state when the response carries no organization", () => {
    h.organizationResult = { data: { organization: undefined }, isLoading: false };
    render(<OrganizationWorkspacePanel organizationId="org-1" />);
    expect(screen.getAllByTestId("skeleton").length).toBeGreaterThan(0);
  });

  it("offers a back control in the loading state only when onBack is given", () => {
    h.organizationResult = { data: undefined, isLoading: true };
    const onBack = vi.fn();
    const { unmount } = render(
      <OrganizationWorkspacePanel organizationId="org-1" onBack={onBack} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Organizations" }));
    expect(onBack).toHaveBeenCalledTimes(1);
    unmount();

    render(<OrganizationWorkspacePanel organizationId="org-1" />);
    expect(screen.queryByRole("button", { name: "Organizations" })).toBeNull();
  });

  it("renders the organization header, tabs and member count", () => {
    render(<OrganizationWorkspacePanel organizationId="org-1" />);
    expect(screen.getByText("Acme Inc")).toBeTruthy();
    expect(screen.getByText("ops@acme.test")).toBeTruthy();
    expect(screen.getByText(/Organization ID: org-1/)).toBeTruthy();
    expect(screen.getByText("Members (4)")).toBeTruthy();
    expect(screen.getByTestId("org-actions").textContent).toContain("actions:org-1");
    expect(screen.getByTestId("org-details").textContent).toContain("details:org-1");
    expect(screen.getByTestId("org-users").textContent).toContain("users:org-1");
    expect(screen.getByTestId("invite-user").textContent).toContain("invite:org-1");
  });

  it("renders the logo when the organization has one", () => {
    h.organizationResult = {
      data: { organization: organization({ logoUrl: "https://cdn.test/acme.png" }) },
      isLoading: false,
    };
    const { container } = render(<OrganizationWorkspacePanel organizationId="org-1" />);
    const img = container.querySelector("img");
    expect(img).not.toBeNull();
    expect(img?.getAttribute("src")).toBe("https://cdn.test/acme.png");
    expect(img?.getAttribute("alt")).toBe("Acme Inc");
  });

  it("omits the logo image and the email row when the organization has neither", () => {
    h.organizationResult = {
      data: { organization: organization({ logoUrl: null, email: "" }) },
      isLoading: false,
    };
    const { container } = render(<OrganizationWorkspacePanel organizationId="org-1" />);
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector('[data-copy="ops@acme.test"]')).toBeNull();
    expect(container.querySelector('[data-copy="org-1"]')).not.toBeNull();
  });

  it("shows the back control on the loaded panel and reports the press", () => {
    const onBack = vi.fn();
    render(<OrganizationWorkspacePanel organizationId="org-1" onBack={onBack} />);
    fireEvent.click(screen.getByRole("button", { name: "Organizations" }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it("omits the back control on the loaded panel when onBack is not given", () => {
    render(<OrganizationWorkspacePanel organizationId="org-1" />);
    expect(screen.queryByRole("button", { name: "Organizations" })).toBeNull();
  });

  it("persists the active tab through the query string", () => {
    render(<OrganizationWorkspacePanel organizationId="org-1" />);
    expect(screen.getByTestId("tabs").getAttribute("data-value")).toBe("details");
    fireEvent.click(screen.getByTestId("change-tab"));
    expect(h.setTab).toHaveBeenCalledWith("members");
  });
});
