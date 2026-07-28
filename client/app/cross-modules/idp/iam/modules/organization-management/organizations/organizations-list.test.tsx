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

const navigate = vi.fn();

vi.mock("react-router", () => ({
  useNavigate: () => navigate,
}));

vi.mock("./organizations-filter-toolbar", () => ({
  useOrganizationsSortQueryParams: () => ({
    sortQueryParams: { property: "Name", isDescending: false },
    setSortQueryParams: vi.fn(),
  }),
}));

vi.mock("../update-organization", () => ({
  UpdateOrganization: () => <div data-testid="update-organization" />,
}));

vi.mock("../toggle-organization-status", () => ({
  ToggleOrganizationStatus: () => <div data-testid="toggle-organization" />,
}));

import { OrganizationsList } from "./organizations-list";
import { IOrganization } from "@blocks-idp/iam/models/organization";

const makeOrg = (over: Partial<IOrganization>): IOrganization =>
  ({
    itemId: "org-1",
    name: "Acme",
    isEnable: true,
    createdDate: "2024-01-01",
    lastUpdatedDate: "2024-01-01",
    createdBy: "system",
    lastUpdatedBy: "system",
    language: null,
    organizationIds: [],
    tags: [],
    ...over,
  }) as IOrganization;

const enabledOrg = makeOrg({ itemId: "org-1", name: "Acme", isEnable: true });
const defaultOrg = makeOrg({
  itemId: "default",
  name: "Default Org",
  isEnable: false,
});

describe("OrganizationsList", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders loading skeletons and no table while loading", () => {
    const { container } = render(<OrganizationsList organizations={[]} isLoading />);
    expect(container.querySelector("table")).toBeNull();
  });

  it("shows the empty-state message for no organizations", () => {
    render(<OrganizationsList organizations={[]} isLoading={false} />);
    expect(screen.getByText("No organizations found")).toBeTruthy();
  });

  it("renders active and disabled status badges", () => {
    render(<OrganizationsList organizations={[enabledOrg, defaultOrg]} isLoading={false} />);
    expect(screen.getByText("Acme")).toBeTruthy();
    expect(screen.getByText("Default Org")).toBeTruthy();
    expect(screen.getByText("Active")).toBeTruthy();
    expect(screen.getByText("Disabled")).toBeTruthy();
  });

  it("hides the actions menu for the default organization only", () => {
    render(<OrganizationsList organizations={[enabledOrg, defaultOrg]} isLoading={false} />);
    // Only the non-default org exposes an actions (dropdown) trigger button.
    expect(screen.getAllByRole("button")).toHaveLength(1);
  });

  it("navigates to the organization detail page when a row is clicked", async () => {
    const user = userEvent.setup();
    render(<OrganizationsList organizations={[enabledOrg]} isLoading={false} />);
    await user.click(screen.getByText("Acme"));
    expect(navigate).toHaveBeenCalledWith("/services/iam/organization-detail/org-1");
  });
});
