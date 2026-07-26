import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({ settingsTab: "auth-config", setSettingsTab: vi.fn() }));

vi.mock("nuqs", () => ({ useQueryState: () => [h.settingsTab, h.setSettingsTab] }));
vi.mock("@blocks-idp/settings/components/settings-tab-actions", () => ({
  SettingsTabActionsProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SettingsTabActionsSlot: () => <div data-testid="actions-slot" />,
}));
vi.mock("@blocks-idp/settings/pages/tabs/auth-config-tab", () => ({
  AuthConfigTab: () => <div data-testid="auth-tab" />,
}));
vi.mock("@blocks-idp/settings/pages/tabs/iam-config-tab", () => ({
  IamConfigTab: () => <div data-testid="iam-tab" />,
}));
vi.mock("@blocks-idp/settings/pages/tabs/organization-config-tab", () => ({
  OrganizationConfigTab: () => <div data-testid="org-tab" />,
}));
vi.mock("@blocks-idp/settings/pages/tabs/signup-settings-tab", () => ({
  SignupSettingsTab: () => <div data-testid="signup-tab" />,
}));

import { IdpSettingsPage } from "./settings-page";

describe("IdpSettingsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.settingsTab = "auth-config";
  });

  it("renders the tab list and the active auth tab content", () => {
    render(<IdpSettingsPage />);
    expect(screen.getAllByText("Auth").length).toBeGreaterThan(0);
    expect(screen.getByTestId("auth-tab")).toBeTruthy();
    expect(screen.getByTestId("actions-slot")).toBeTruthy();
  });

  it("reflects a different active tab from the query state", () => {
    h.settingsTab = "signup-settings";
    render(<IdpSettingsPage />);
    expect(screen.getByTestId("signup-tab")).toBeTruthy();
  });

  it("falls back to the auth tab for an invalid query value", () => {
    h.settingsTab = "nonsense";
    render(<IdpSettingsPage />);
    expect(screen.getByTestId("auth-tab")).toBeTruthy();
  });

  it("changes the tab when a tab trigger is clicked", async () => {
    const user = userEvent.setup();
    render(<IdpSettingsPage />);
    await user.click(screen.getByRole("tab", { name: "IAM" }));
    expect(h.setSettingsTab).toHaveBeenCalledWith("iam-config");
  });
});
