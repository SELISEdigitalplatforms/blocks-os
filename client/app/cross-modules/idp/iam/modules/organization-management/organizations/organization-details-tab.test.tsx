import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { IOrganization } from "@blocks-idp/iam/models/organization";

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

  it("shows the disabled status", () => {
    render(<OrganizationDetailsTab organization={{ ...org, isDisabled: true } as IOrganization} />);
    expect(screen.getByText("Disabled")).toBeTruthy();
  });

  it("no longer shows the default role for new members", () => {
    render(<OrganizationDetailsTab organization={org} />);
    expect(screen.queryByText("Default role for new members")).toBeNull();
    expect(screen.queryByText("admin")).toBeNull();
  });
});
