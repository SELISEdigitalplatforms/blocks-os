import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  userData: undefined as unknown,
  isUserLoading: false,
  orgsData: { organizations: [{ itemId: "org-1", name: "Org One" }] },
  isOrgsLoading: false,
  listProps: undefined as Record<string, unknown> | undefined,
}));

vi.mock("@blocks-idp/iam/hooks/use-user", () => ({
  useGetUserById: () => ({ data: h.userData, isLoading: h.isUserLoading }),
}));
vi.mock("@blocks-idp/iam/hooks/use-organization", () => ({
  useGetOrganizations: () => ({ data: h.orgsData, isLoading: h.isOrgsLoading }),
}));
vi.mock("./user-memberships-list", () => ({
  UserMembershipsList: (props: Record<string, unknown>) => {
    h.listProps = props;
    const memberships = props.memberships as unknown[];
    return <div data-testid="list">count:{memberships.length}</div>;
  },
}));
vi.mock("./assign-organization", () => ({
  AssignOrganization: () => <div data-testid="assign" />,
}));

import { UserMemberships } from "./user-memberships";

describe("UserMemberships", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.isUserLoading = false;
    h.isOrgsLoading = false;
    h.orgsData = { organizations: [{ itemId: "org-1", name: "Org One" }] };
  });

  it("uses the organizations array from the user when present", () => {
    h.userData = { data: { organizations: [{ organizationId: "org-1", roles: [], permissions: [] }] } };
    render(<UserMemberships id="u1" projectKey="pk" />);
    expect(screen.getByTestId("list").textContent).toBe("count:1");
    const map = h.listProps?.orgNameMap as Map<string, string>;
    expect(map.get("org-1")).toBe("Org One");
  });

  it("falls back to building memberships from organizationIds", () => {
    h.userData = {
      data: {
        organizations: [],
        organizationIds: ["org-1", "org-2"],
        roles: { "org-1": ["admin"] },
        permissions: { "org-2": ["read"] },
      },
    };
    render(<UserMemberships id="u1" projectKey="pk" />);
    expect(screen.getByTestId("list").textContent).toBe("count:2");
    const memberships = h.listProps?.memberships as Array<{ organizationId: string; roles: string[] }>;
    expect(memberships[0]).toMatchObject({ organizationId: "org-1", roles: ["admin"] });
  });

  it("passes a loading flag down while either query is loading", () => {
    h.userData = { data: { organizations: [] } };
    h.isUserLoading = true;
    render(<UserMemberships id="u1" projectKey="pk" />);
    expect(h.listProps?.isLoading).toBe(true);
  });
});
