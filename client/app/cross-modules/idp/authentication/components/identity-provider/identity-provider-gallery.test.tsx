import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { IdentityProviderGallery } from "./identity-provider-gallery";
import type { IdentityProvider } from "@blocks-idp/authentication/models/identity-provider.model";

const googleEntry = {
  itemId: "idp-google",
  providerType: "social",
  provider: "google",
  displayName: "Google",
  isActive: true,
} as unknown as IdentityProvider;

const baseProps = {
  showHowItWorks: false,
  onSelectGoogle: vi.fn(),
  onSelectMicrosoft: vi.fn(),
  onSelectBlocksOidc: vi.fn(),
  onSelectByos: vi.fn(),
};

describe("IdentityProviderGallery", () => {
  it("shows How it works only when there is nothing configured yet", () => {
    const { rerender } = render(<IdentityProviderGallery {...baseProps} showHowItWorks />);
    expect(screen.getByText("How it works")).toBeTruthy();

    rerender(<IdentityProviderGallery {...baseProps} showHowItWorks={false} />);
    expect(screen.queryByText("How it works")).toBeNull();
  });

  it("always renders both gallery sections", () => {
    render(<IdentityProviderGallery {...baseProps} />);
    expect(screen.getByText("Social logins")).toBeTruthy();
    expect(screen.getByText("Enterprise & custom")).toBeTruthy();
    expect(screen.getByText("Google")).toBeTruthy();
    expect(screen.getByText("Microsoft")).toBeTruthy();
    expect(screen.getByText("Blocks OIDC")).toBeTruthy();
    expect(screen.getByText("Bring your own SSO")).toBeTruthy();
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

  it("opens a blank add dialog for Blocks OIDC and BYOS regardless of existing entries", async () => {
    const user = userEvent.setup();
    const onSelectBlocksOidc = vi.fn();
    const onSelectByos = vi.fn();
    render(
      <IdentityProviderGallery
        {...baseProps}
        onSelectBlocksOidc={onSelectBlocksOidc}
        onSelectByos={onSelectByos}
      />,
    );
    const configureButtons = screen.getAllByRole("button", { name: "Configure" });
    expect(configureButtons).toHaveLength(2);
    await user.click(configureButtons[0]);
    expect(onSelectBlocksOidc).toHaveBeenCalled();
    await user.click(configureButtons[1]);
    expect(onSelectByos).toHaveBeenCalled();
  });
});
