import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

vi.mock("./identity-provider-entry-item", () => ({
  ProviderEntryItem: ({ item }: { item: { itemId?: string; displayName: string } }) => (
    <div data-testid="idp-entry" data-item-id={item.itemId}>
      {item.displayName}
    </div>
  ),
}));

import { IdentityProviderGallery } from "./identity-provider-gallery";
import type { IdentityProvider } from "@blocks-idp/authentication/models/identity-provider.model";

const googleEntry = {
  itemId: "idp-google",
  providerType: "social",
  provider: "google",
  displayName: "Google",
  isActive: true,
} as unknown as IdentityProvider;

const byosEntry = {
  itemId: "idp-byos",
  providerType: "byos",
  provider: "okta-prod",
  displayName: "Okta Prod",
  isActive: true,
} as unknown as IdentityProvider;

const blocksOidcEntry = {
  itemId: "idp-blocks",
  providerType: "blocks-oidc",
  provider: "sibling-project",
  displayName: "Sibling Project",
  isActive: true,
} as unknown as IdentityProvider;

const baseProps = {
  blocksOidcEntries: [],
  byosEntries: [],
  onSelectGoogle: vi.fn(),
  onSelectMicrosoft: vi.fn(),
  onSelectBlocksOidc: vi.fn(),
  onSelectByos: vi.fn(),
};

describe("IdentityProviderGallery", () => {
  it("always shows the federated sign-in explainer, configured or not", () => {
    const { rerender } = render(<IdentityProviderGallery {...baseProps} />);
    expect(screen.getByText("How a federated sign-in works")).toBeTruthy();
    expect(screen.getByText("Your user")).toBeTruthy();
    expect(screen.getByText("Blocks OS")).toBeTruthy();
    expect(screen.getByText("Identity provider")).toBeTruthy();

    rerender(
      <IdentityProviderGallery
        {...baseProps}
        googleEntry={googleEntry}
        byosEntries={[byosEntry]}
      />,
    );
    expect(screen.getByText("How a federated sign-in works")).toBeTruthy();
  });

  it("always renders both gallery sections, with their hint copy", () => {
    render(<IdentityProviderGallery {...baseProps} />);
    expect(screen.getByText("Social logins")).toBeTruthy();
    expect(
      screen.getByText("Pick a provider to configure it — no forms to hunt through."),
    ).toBeTruthy();
    expect(screen.getByText("Enterprise & custom")).toBeTruthy();
    expect(screen.getByText("For providers that aren't a public social login.")).toBeTruthy();
    expect(screen.getByText("Google")).toBeTruthy();
    expect(screen.getByText("Microsoft")).toBeTruthy();
    expect(screen.getByText("Blocks OIDC")).toBeTruthy();
    expect(screen.getByText("Bring your own SSO")).toBeTruthy();
  });

  it("shows capability tags on each social card", () => {
    render(<IdentityProviderGallery {...baseProps} />);
    expect(screen.getByText("OAuth 2.0 / OIDC")).toBeTruthy();
    expect(screen.getByText("Entra ID")).toBeTruthy();
    expect(screen.getAllByText("Client ID + Secret")).toHaveLength(2);
  });

  it("shows Not configured + Configure for an unconfigured social provider", async () => {
    const user = userEvent.setup();
    const onSelectGoogle = vi.fn();
    render(<IdentityProviderGallery {...baseProps} onSelectGoogle={onSelectGoogle} />);
    expect(screen.getAllByText("Not configured").length).toBeGreaterThan(0);
    await user.click(screen.getByRole("button", { name: "Configure Google" }));
    expect(onSelectGoogle).toHaveBeenCalled();
  });

  it("shows Connected + Manage for a configured social provider", async () => {
    const user = userEvent.setup();
    const onSelectGoogle = vi.fn();
    render(
      <IdentityProviderGallery
        {...baseProps}
        googleEntry={googleEntry}
        onSelectGoogle={onSelectGoogle}
      />,
    );
    expect(screen.getByText("Connected")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Manage" }));
    expect(onSelectGoogle).toHaveBeenCalled();
  });

  it("shows no configured entries and just an Add action for empty enterprise types", () => {
    render(<IdentityProviderGallery {...baseProps} />);
    expect(screen.queryAllByTestId("idp-entry")).toHaveLength(0);
    expect(screen.getByRole("button", { name: /Add Blocks OIDC/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Add Bring your own SSO/ })).toBeTruthy();
  });

  it("lists each configured entry inline under its enterprise type card", () => {
    render(
      <IdentityProviderGallery
        {...baseProps}
        blocksOidcEntries={[blocksOidcEntry]}
        byosEntries={[byosEntry, { ...byosEntry, itemId: "idp-byos-2", displayName: "Auth0 Stg" }]}
      />,
    );
    const entries = screen.getAllByTestId("idp-entry");
    expect(entries).toHaveLength(3);
    expect(screen.getByText("Sibling Project")).toBeTruthy();
    expect(screen.getByText("Okta Prod")).toBeTruthy();
    expect(screen.getByText("Auth0 Stg")).toBeTruthy();
    expect(screen.getByText("1 configured")).toBeTruthy();
    expect(screen.getByText("2 configured")).toBeTruthy();
  });

  it("Add opens a blank add dialog for that type regardless of existing entries", async () => {
    const user = userEvent.setup();
    const onSelectBlocksOidc = vi.fn();
    const onSelectByos = vi.fn();
    render(
      <IdentityProviderGallery
        {...baseProps}
        blocksOidcEntries={[blocksOidcEntry]}
        byosEntries={[byosEntry]}
        onSelectBlocksOidc={onSelectBlocksOidc}
        onSelectByos={onSelectByos}
      />,
    );
    await user.click(screen.getByRole("button", { name: /Add Blocks OIDC/ }));
    expect(onSelectBlocksOidc).toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: /Add Bring your own SSO/ }));
    expect(onSelectByos).toHaveBeenCalled();
  });
});
