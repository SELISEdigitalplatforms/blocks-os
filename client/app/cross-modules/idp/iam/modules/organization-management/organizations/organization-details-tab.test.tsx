import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { IOrganization } from "@blocks-idp/iam/models/organization";

const h = vi.hoisted(() => ({ roles: [] as { slug: string; name: string }[] }));

vi.mock("@blocks-idp/iam/hooks/use-roles", () => ({
  useGetRoles: () => ({ data: { data: h.roles } }),
}));

import { OrganizationDetailsTab } from "./organization-details-tab";

const org = {
  description: "An org",
  isDisabled: false,
  websiteUrl: "https://acme.test",
  email: "acme@test.com",
  phoneNumber: "12345",
  createdDate: "2022-01-01T00:00:00Z",
  lastUpdatedDate: "2022-02-01T00:00:00Z",
  defaultRoleForMembers: ["admin"],
} as unknown as IOrganization;

beforeEach(() => {
  vi.clearAllMocks();
  h.roles = [{ slug: "admin", name: "Administrator" }];
});

describe("OrganizationDetailsTab", () => {
  it("renders the core organization details", () => {
    render(<OrganizationDetailsTab organization={org} />);
    expect(screen.getByText("An org")).toBeTruthy();
    expect(screen.getByText("Active")).toBeTruthy();
    expect(screen.getByText("acme@test.com")).toBeTruthy();
    expect(screen.getByText("12345")).toBeTruthy();
    expect(screen.getByRole("link", { name: /acme.test/ }).getAttribute("href")).toBe(
      "https://acme.test",
    );
  });

  it("resolves default role slugs to their display names", () => {
    render(<OrganizationDetailsTab organization={org} />);
    expect(screen.getByText("Administrator")).toBeTruthy();
  });

  it("shows the disabled status", () => {
    render(<OrganizationDetailsTab organization={{ ...org, isDisabled: true } as IOrganization} />);
    expect(screen.getByText("Disabled")).toBeTruthy();
  });

  it("falls back to the raw slug when a role name is unknown", () => {
    h.roles = [];
    render(<OrganizationDetailsTab organization={org} />);
    expect(screen.getByText("admin")).toBeTruthy();
  });
});
