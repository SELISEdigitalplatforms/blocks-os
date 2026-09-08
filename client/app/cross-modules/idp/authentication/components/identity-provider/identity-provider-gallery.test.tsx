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
  googleEntries: [],
  microsoftEntries: [],
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
        googleEntries={[googleEntry]}
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

  it("shows Not configured + Add for an unconfigured social provider", async () => {
    const user = userEvent.setup();
    const onSelectGoogle = vi.fn();
    render(<IdentityProviderGallery {...baseProps} onSelectGoogle={onSelectGoogle} />);
    expect(screen.getAllByText("Not configured")).toHaveLength(2);
    expect(screen.queryAllByTestId("idp-entry")).toHaveLength(0);
    await user.click(screen.getByRole("button", { name: /Add Google/ }));
    expect(onSelectGoogle).toHaveBeenCalled();
  });

  it("lists every configured entry inline under its social card, with a count", () => {
    render(
      <IdentityProviderGallery
        {...baseProps}
        googleEntries={[
          { ...googleEntry, displayName: "Google Prod" },
          { ...googleEntry, itemId: "idp-google-2", displayName: "Google Staging" },
        ]}
      />,
    );
    const entries = screen.getAllByTestId("idp-entry");
    expect(entries).toHaveLength(2);
    expect(screen.getByText("Google Prod")).toBeTruthy();
    expect(screen.getByText("Google Staging")).toBeTruthy();
    expect(screen.getByText("2 configured")).toBeTruthy();
    // Microsoft is untouched by Google's entries.
    expect(screen.getAllByText("Not configured")).toHaveLength(1);
  });

  it("collapses and re-expands a card's entry list from its count summary", async () => {
    const user = userEvent.setup();
    render(
      <IdentityProviderGallery
        {...baseProps}
        byosEntries={[byosEntry, { ...byosEntry, itemId: "idp-byos-2", displayName: "Auth0 Stg" }]}
      />,
    );
    const summary = screen.getByRole("button", { name: /2 configured/ });
    expect(summary.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getAllByTestId("idp-entry")).toHaveLength(2);

    await user.click(summary);
    expect(summary.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryAllByTestId("idp-entry")).toHaveLength(0);

    await user.click(summary);
    expect(screen.getAllByTestId("idp-entry")).toHaveLength(2);
  });

  it("Add stays available on a social card that already has entries", async () => {
    const user = userEvent.setup();
    const onSelectGoogle = vi.fn();
    render(
      <IdentityProviderGallery
        {...baseProps}
        googleEntries={[googleEntry]}
        onSelectGoogle={onSelectGoogle}
      />,
    );
    await user.click(screen.getByRole("button", { name: /Add Google/ }));
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
