import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  config: undefined as { isMultiOrgEnabled: boolean } | undefined,
  isConfigLoading: false,
  user: undefined as { data: Record<string, unknown> } | undefined,
  isUserLoading: false,
}));

vi.mock("@blocks-idp/iam/hooks/use-organization", () => ({
  useGetOrganizationConfig: () => ({ data: h.config, isLoading: h.isConfigLoading }),
}));
vi.mock("@blocks-idp/iam/hooks/use-user", () => ({
  useGetUserById: () => ({ data: h.user, isLoading: h.isUserLoading }),
}));
vi.mock("./single-org-access", () => ({
  SingleOrgAccess: () => <div data-testid="single-org" />,
}));
vi.mock("./multi-org-access", () => ({
  MultiOrgAccess: () => <div data-testid="multi-org" />,
}));

import { UserAccessTab } from "./user-access-tab";

beforeEach(() => {
  vi.clearAllMocks();
  h.config = { isMultiOrgEnabled: false };
  h.isConfigLoading = false;
  h.user = { data: { organizationIds: [] } };
  h.isUserLoading = false;
});

describe("UserAccessTab", () => {
  it("H5: renders skeletons while config or user data loads", () => {
    h.isConfigLoading = true;
    const { container } = render(<UserAccessTab userId="u1" projectKey="p1" />);
    expect(container.querySelectorAll("[class*='animate-pulse']").length).toBeGreaterThan(0);
    expect(screen.queryByTestId("multi-org")).toBeNull();
    expect(screen.queryByTestId("single-org")).toBeNull();
  });

  it("H5: renders skeletons while user data loads (no premature flash)", () => {
    h.isUserLoading = true;
    render(<UserAccessTab userId="u1" projectKey="p1" />);
    expect(screen.queryByTestId("multi-org")).toBeNull();
    expect(screen.queryByTestId("single-org")).toBeNull();
  });

  it("H1: multi-org enabled with multiple orgs shows multi-org view", () => {
    h.config = { isMultiOrgEnabled: true };
    h.user = { data: { organizationIds: ["o1", "o2"] } };
    render(<UserAccessTab userId="u1" projectKey="p1" />);
    expect(screen.getByTestId("multi-org")).toBeTruthy();
    expect(screen.queryByTestId("single-org")).toBeNull();
  });

  it("H2: multi-org enabled with exactly one org still shows multi-org view", () => {
    h.config = { isMultiOrgEnabled: true };
    h.user = { data: { organizationIds: ["o1"] } };
    render(<UserAccessTab userId="u1" projectKey="p1" />);
    expect(screen.getByTestId("multi-org")).toBeTruthy();
    expect(screen.queryByTestId("single-org")).toBeNull();
  });

  it("H3 / C1: multi-org disabled with one default org hides organizations section", () => {
    h.config = { isMultiOrgEnabled: false };
    h.user = { data: { organizationIds: ["default"] } };
    render(<UserAccessTab userId="u1" projectKey="p1" />);
    expect(screen.getByTestId("single-org")).toBeTruthy();
    expect(screen.queryByTestId("multi-org")).toBeNull();
  });

  it("H3 / C1: multi-org disabled with stale/multiple org ids still hides organizations section", () => {
    h.config = { isMultiOrgEnabled: false };
    h.user = { data: { organizationIds: ["o1", "o2"] } };
    render(<UserAccessTab userId="u1" projectKey="p1" />);
    expect(screen.getByTestId("single-org")).toBeTruthy();
    expect(screen.queryByTestId("multi-org")).toBeNull();
  });

  it("H4: switching from enabled tenant to disabled tenant hides organizations section", () => {
    h.config = { isMultiOrgEnabled: true };
    h.user = { data: { organizationIds: ["o1", "o2"] } };
    const { rerender } = render(<UserAccessTab userId="u1" projectKey="p1" />);
    expect(screen.getByTestId("multi-org")).toBeTruthy();

    h.config = { isMultiOrgEnabled: false };
    rerender(<UserAccessTab userId="u1" projectKey="p1" />);
    expect(screen.getByTestId("single-org")).toBeTruthy();
    expect(screen.queryByTestId("multi-org")).toBeNull();

    h.config = { isMultiOrgEnabled: true };
    rerender(<UserAccessTab userId="u1" projectKey="p1" />);
    expect(screen.getByTestId("multi-org")).toBeTruthy();
  });

  it("C2: fails closed when config returns no data (isMultiOrgEnabled defaults to false)", () => {
    h.config = undefined;
    h.user = { data: { organizationIds: ["o1", "o2", "o3"] } };
    render(<UserAccessTab userId="u1" projectKey="p1" />);
    expect(screen.getByTestId("single-org")).toBeTruthy();
    expect(screen.queryByTestId("multi-org")).toBeNull();
  });

  it("C4: multi-org enabled with zero orgs/roles still renders multi-org view (flag is primary gate)", () => {
    h.config = { isMultiOrgEnabled: true };
    h.user = { data: { organizationIds: [], OrganizationsRoles: {} } };
    render(<UserAccessTab userId="u1" projectKey="p1" />);
    expect(screen.getByTestId("multi-org")).toBeTruthy();
    expect(screen.queryByTestId("single-org")).toBeNull();
  });

  it("renders the single-org view when multi-org is disabled and no orgs exist", () => {
    h.config = { isMultiOrgEnabled: false };
    h.user = { data: { organizationIds: [] } };
    render(<UserAccessTab userId="u1" projectKey="p1" />);
    expect(screen.getByTestId("single-org")).toBeTruthy();
    expect(screen.queryByTestId("multi-org")).toBeNull();
  });
});
