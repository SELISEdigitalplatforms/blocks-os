import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  configQuery: {},
  roles: { isPending: false, isError: false },
  perms: { isPending: false, isError: false },
  tabState: { showLoader: false, showError: false, data: { some: "config" } },
}));

vi.mock("@blocks-idp/iam/hooks/use-permission", () => ({ useGetPermissions: () => h.perms }));
vi.mock("@blocks-idp/iam/hooks/use-roles", () => ({ useGetRoles: () => h.roles }));
vi.mock("@blocks-idp/settings/hooks/use-settings-config", () => ({
  useSettingsSignUpSetting: () => h.configQuery,
}));
vi.mock("@blocks-idp/settings/hooks/use-settings-tenant-id", () => ({
  useSettingsTenantId: () => "tenant-1",
}));
vi.mock("@blocks-idp/settings/hooks/use-settings-tab-query", () => ({
  getSettingsTabQueryState: () => h.tabState,
}));
vi.mock("@blocks-idp/settings/components/config-error-state", () => ({
  ConfigErrorState: () => <div data-testid="error-state" />,
}));
vi.mock("@blocks-idp/settings/components/settings-tab-loading-state", () => ({
  SignupTabLoadingState: () => <div data-testid="loading-state" />,
}));
vi.mock("@blocks-idp/settings/components/signup-settings-form", () => ({
  SignupSettingsForm: ({ config }: { config: unknown }) => (
    <div data-testid="signup-form">{JSON.stringify(config)}</div>
  ),
}));

import { SignupSettingsTab } from "./signup-settings-tab";

describe("SignupSettingsTab", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.roles = { isPending: false, isError: false };
    h.perms = { isPending: false, isError: false };
    h.tabState = { showLoader: false, showError: false, data: { some: "config" } };
  });

  it("renders the form when everything has loaded successfully", () => {
    render(<SignupSettingsTab />);
    expect(screen.getByTestId("signup-form").textContent).toContain("config");
  });

  it("renders the loading state while any query is pending", () => {
    h.roles = { isPending: true, isError: false };
    render(<SignupSettingsTab />);
    expect(screen.getByTestId("loading-state")).toBeTruthy();
  });

  it("renders the error state when a query errors", () => {
    h.perms = { isPending: false, isError: true };
    render(<SignupSettingsTab />);
    expect(screen.getByTestId("error-state")).toBeTruthy();
  });

  it("renders the error state when there is no config data", () => {
    h.tabState = { showLoader: false, showError: false, data: null as never };
    render(<SignupSettingsTab />);
    expect(screen.getByTestId("error-state")).toBeTruthy();
  });
});
