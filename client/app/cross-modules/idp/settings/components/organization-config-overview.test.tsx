import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { OrganizationConfigOverview } from "./organization-config-overview";

const config = (over: Record<string, unknown> = {}) =>
  ({
    itemId: "cfg-1",
    isMultiOrgEnabled: true,
    allowCreationFromCloud: true,
    allowCreationFromConstruct: false,
    allowOrgCreationFromSignup: true,
    allowOrgCreationFromPortal: false,
    ...over,
  }) as never;

describe("OrganizationConfigOverview", () => {
  it("renders the multi-org sources with an enabled count", () => {
    render(<OrganizationConfigOverview config={config()} />);
    expect(screen.getByText("Multi-org enabled")).toBeTruthy();
    expect(screen.getByText("2 of 4 sources enabled")).toBeTruthy();
    expect(screen.getByText("Cloud")).toBeTruthy();
    expect(screen.getByText("Portal")).toBeTruthy();
  });

  it("shows the config id", () => {
    render(<OrganizationConfigOverview config={config()} />);
    expect(screen.getByText("cfg-1")).toBeTruthy();
  });

  it("renders the single-organization mode message when multi-org is disabled", () => {
    render(<OrganizationConfigOverview config={config({ isMultiOrgEnabled: false })} />);
    expect(screen.getByText("Single organization")).toBeTruthy();
    expect(screen.getByText("Single-organization mode")).toBeTruthy();
  });

  it("shows a dash when there is no config id", () => {
    render(<OrganizationConfigOverview config={config({ itemId: "" })} />);
    expect(screen.getByText("—")).toBeTruthy();
  });
});
