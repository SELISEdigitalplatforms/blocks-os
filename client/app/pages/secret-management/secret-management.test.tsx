import { render, screen } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  pathname: "/app/proj/secret-management/secret",
  captchaData: undefined as unknown,
  externalIdpData: undefined as unknown,
  clientsData: [] as unknown[],
  brandingActions: undefined as unknown,
  toast: vi.fn(),
}));

vi.mock("react-router", () => ({
  useLocation: () => ({ pathname: h.pathname }),
  Outlet: () => <div data-testid="outlet" />,
}));
vi.mock("@seliseblocks/genesis-os", () => ({
  useProjectStore: () => ({ selectedProject: { tenantId: "tenant-1" } }),
}));
vi.mock("@seliseblocks/genesis-os/hooks", () => ({
  useScopedPath: () => (p: string) => `/app/proj/${p}`,
}));
vi.mock("@blocks-idp/captcha/hooks/use-captcha-config", () => ({
  useGetCaptchaConfig: () => ({ data: h.captchaData }),
}));
vi.mock("@blocks-idp/authentication/hooks/use-identifier", () => ({
  useGetSavedPublicCertificates: () => ({ data: h.externalIdpData }),
}));
vi.mock("@blocks-idp/authentication/hooks/use-auth-clients", () => ({
  useListAuthClientCredentials: () => ({ data: h.clientsData }),
}));
vi.mock("@/hooks/use-toast", () => ({ toast: (...a: unknown[]) => h.toast(...a) }));
vi.mock("nuqs", () => {
  const parser = { withDefault: (d: unknown) => ({ defaultValue: d }) };
  return {
    parseAsBoolean: parser,
    parseAsString: parser,
    useQueryState: (_k: string, opts: { defaultValue: unknown }) =>
      React.useState(opts.defaultValue),
  };
});
vi.mock("@blocks-idp/authentication/contexts/oidc-branding-header-context", () => ({
  OidcBrandingHeaderProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useOidcBrandingHeaderOptional: () => (h.brandingActions ? { actions: h.brandingActions } : null),
}));
vi.mock("@/cross-modules/secrets/components/secret-form-modal/create-secret-button", () => ({
  CreateSecretButton: () => <div data-testid="create-secret-button" />,
}));
vi.mock("@blocks-idp/authentication/components/create-client-credential/create-client-credential", () => ({
  CreateClientCredential: () => <div data-testid="create-client-credential" />,
}));
vi.mock("@blocks-identifier/components/add-service/add-service", () => ({
  AddService: () => <div data-testid="add-service" />,
}));
vi.mock("@blocks-idp/authentication/components/create-oidc", () => ({
  CreateOIDC: () => <div data-testid="create-oidc" />,
}));
vi.mock("@blocks-idp/captcha/modals/configure-captcha-modal", () => ({
  ConfigureCaptchaModal: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock("@blocks-utilities/components/magic-url-config-dialog/configure-magic-url-modal", () => ({
  ConfigureMagicUrlModal: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock("@/components/page-header/page-header", () => ({
  PageHeader: ({ title, actions }: { title: string; actions: React.ReactNode }) => (
    <div>
      <h1>{title}</h1>
      <div>{actions}</div>
    </div>
  ),
}));
vi.mock("@/components/breadcrumb/breadcrumb", () => ({ default: () => <nav /> }));
// The captcha/magic-url actions wrap DialogTrigger; the real Dialog wrapper is
// mocked away above, so provide a context-free trigger passthrough.
vi.mock("@/components/ui-kits/dialog/dialog", () => ({
  DialogTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

import SecretManagementLayout from "./secret-management";

describe("SecretManagementLayout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.pathname = "/app/proj/secret-management/secret";
    h.captchaData = undefined;
    h.externalIdpData = undefined;
    h.clientsData = [];
    h.brandingActions = undefined;
  });

  it("renders the page header and outlet for a known nav item", () => {
    render(<SecretManagementLayout />);
    expect(screen.getByText("Secret")).toBeTruthy();
    expect(screen.getByTestId("outlet")).toBeTruthy();
    // The secret page shows the create-secret action.
    expect(screen.getByTestId("create-secret-button")).toBeTruthy();
  });

  it("shows the OIDC create action on the oidc page", () => {
    h.pathname = "/app/proj/secret-management/oidc";
    render(<SecretManagementLayout />);
    expect(screen.getByTestId("create-oidc")).toBeTruthy();
  });

  it("shows the add-service action and setup guide on my-services", () => {
    h.pathname = "/app/proj/secret-management/my-services";
    render(<SecretManagementLayout />);
    expect(screen.getByTestId("add-service")).toBeTruthy();
    expect(screen.getByText("Setup Guide")).toBeTruthy();
  });

  it("renders the client credential dialog on the client-credentials page", () => {
    h.pathname = "/app/proj/secret-management/client-credentials";
    render(<SecretManagementLayout />);
    expect(screen.getByTestId("create-client-credential")).toBeTruthy();
  });

  it("shows an edit action when an external idp is already configured", () => {
    h.pathname = "/app/proj/secret-management/external-idp";
    h.externalIdpData = { isConfigured: true };
    render(<SecretManagementLayout />);
    expect(screen.getByText("Edit")).toBeTruthy();
    expect(screen.getByText("Map JWT Claim")).toBeTruthy();
  });

  it("shows an add action when no external idp is configured", () => {
    h.pathname = "/app/proj/secret-management/external-idp";
    h.externalIdpData = { isConfigured: false };
    render(<SecretManagementLayout />);
    expect(screen.getByText("Add")).toBeTruthy();
  });

  it("shows the Add Configuration action when captcha is not yet configured", () => {
    h.pathname = "/app/proj/secret-management/captcha";
    h.captchaData = undefined;
    render(<SecretManagementLayout />);
    expect(screen.getByText("Add Configuration")).toBeTruthy();
  });

  it("hides the Add Configuration action once captcha is configured", () => {
    h.pathname = "/app/proj/secret-management/captcha";
    h.captchaData = { provider: "recaptcha", isEnable: true, captchaKey: "key", secretId: "sec-1" };
    render(<SecretManagementLayout />);
    expect(screen.queryByText("Add Configuration")).toBeNull();
  });

  it("renders the branding save/undo actions in branding mode", () => {
    h.pathname = "/app/proj/secret-management/oidc/client-9/branding";
    h.brandingActions = { onSave: vi.fn(), onUndo: vi.fn(), isBusy: false, isDirty: true };
    render(<SecretManagementLayout />);
    expect(screen.getByText("Save")).toBeTruthy();
    expect(screen.getByText("Undo")).toBeTruthy();
  });

  it("disables the branding save/undo actions when nothing is dirty", () => {
    h.pathname = "/app/proj/secret-management/oidc/client-9/branding";
    h.brandingActions = { onSave: vi.fn(), onUndo: vi.fn(), isBusy: false, isDirty: false };
    render(<SecretManagementLayout />);
    expect((screen.getByText("Save").closest("button") as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByText("Undo").closest("button") as HTMLButtonElement).disabled).toBe(true);
  });

  it("enables the branding save/undo actions when dirty", () => {
    h.pathname = "/app/proj/secret-management/oidc/client-9/branding";
    h.brandingActions = { onSave: vi.fn(), onUndo: vi.fn(), isBusy: false, isDirty: true };
    render(<SecretManagementLayout />);
    expect((screen.getByText("Save").closest("button") as HTMLButtonElement).disabled).toBe(false);
    expect((screen.getByText("Undo").closest("button") as HTMLButtonElement).disabled).toBe(false);
  });
});
