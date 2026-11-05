import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router";

const h = vi.hoisted(() => ({
  useGetAuthOidcCredential: vi.fn(),
}));

vi.mock("@seliseblocks/genesis-os", async (importOriginal) => {
  const Passthrough = ({ children }: { children?: React.ReactNode }) => <>{children}</>;
  return {
    ...(await importOriginal<typeof import("@seliseblocks/genesis-os")>()),
    useProjectStore: () => ({ selectedProject: { tenantId: "tenant-1" } }),
    Tooltip: Passthrough,
    TooltipTrigger: Passthrough,
    TooltipContent: Passthrough,
    TooltipProvider: Passthrough,
  };
});
vi.mock("@seliseblocks/genesis-os/hooks", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@seliseblocks/genesis-os/hooks")>()),
  useScopedPath: () => (path: string) => `/app/${path}`,
}));
vi.mock("@blocks-idp/authentication/hooks/use-auth-oidc", () => ({
  useSaveAuthOidc: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useGetAuthOidcCredential: (args: unknown, enabled: boolean) =>
    h.useGetAuthOidcCredential(args, enabled),
}));
vi.mock("@blocks-idp/authentication/hooks/use-auth-config", () => ({
  useGetAuthConfig: () => ({ data: undefined }),
}));
vi.mock("@blocks-idp/authentication/hooks/use-login-policy", () => ({
  useGetTenantLoginPolicy: () => ({ data: undefined }),
}));
vi.mock("@blocks-idp/authentication/hooks/use-identity-provider", () => ({
  useGetIdentityProviders: () => ({ data: undefined }),
}));
vi.mock("@/hooks/use-toast", () => ({ showErrorToast: vi.fn(), showSuccessToast: vi.fn() }));

import { OidcClientPage } from "./oidc-client-page";
import { oidcClientPath } from "./oidc-client-route";

const credential = (overrides: Record<string, unknown> = {}) => ({
  oIDCClientCredential: {
    itemId: "e070a1b2c3d4d334",
    clientDisplayName: "Blocks Test",
    createdDate: "2026-11-03T10:00:00Z",
    redirectUris: ["https://blocks-test.example.com/login/callback"],
    scope: "openid",
    isActive: true,
    requirePkce: true,
    isAutoRedirect: false,
    isDeviceFlowClient: false,
    registerAsIdentityProvider: true,
    allowedResponseTypes: ["code"],
    ...overrides,
  },
  loginPolicy: { method: "default", providers: "selected", selectedProviderIds: ["g1", "m1"] },
});

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={[`/app/${oidcClientPath("e070a1b2c3d4d334")}`]}>
      <Routes>
        <Route path="/app/secret-management/oidc/clients/:clientId" element={<OidcClientPage />} />
      </Routes>
    </MemoryRouter>,
  );

describe("OidcClientPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.useGetAuthOidcCredential.mockReturnValue({ data: credential(), isLoading: false });
  });

  it("loads the client named in the route", () => {
    renderPage();
    expect(h.useGetAuthOidcCredential).toHaveBeenCalledWith(
      { projectKey: "tenant-1", clientId: "e070a1b2c3d4d334" },
      true,
    );
  });

  it("heads the page with the client's name, status, kind, masked id and created date", () => {
    renderPage();
    const header = screen.getByRole("banner");
    expect(within(header).getByRole("heading", { level: 1, name: "Blocks Test" })).toBeTruthy();
    expect(within(header).getByText("Active")).toBeTruthy();
    expect(within(header).getByText("Web application")).toBeTruthy();
    expect(within(header).getByText("e070********d334")).toBeTruthy();
    expect(within(header).getByText("Created 03 Nov 2026")).toBeTruthy();
    expect(within(header).queryByText("e070a1b2c3d4d334")).toBeNull();
  });

  it("lists one section per concern, with a way back to the list", () => {
    renderPage();
    const nav = screen.getByRole("navigation", { name: "Sections" });
    expect(
      within(nav)
        .getAllByRole("button")
        .map((b) => b.textContent),
    ).toEqual([
      "General",
      "Redirect URI(s)",
      "Sign-in",
      "Token lifetimes",
      "Security",
      "Identity Provider",
    ]);
    expect(screen.getByRole("link", { name: /OIDC clients/ }).getAttribute("href")).toBe(
      "/app/secret-management/oidc",
    );
  });

  it("drops the browser-only sections for a device-flow client", () => {
    h.useGetAuthOidcCredential.mockReturnValue({
      data: credential({ isDeviceFlowClient: true }),
      isLoading: false,
    });
    renderPage();
    const nav = screen.getByRole("navigation", { name: "Sections" });
    expect(
      within(nav)
        .getAllByRole("button")
        .map((b) => b.textContent),
    ).toEqual(["General", "Token lifetimes", "Security"]);
  });

  it("shows a placeholder while the client loads", () => {
    h.useGetAuthOidcCredential.mockReturnValue({ data: undefined, isLoading: true });
    renderPage();
    expect(screen.getByLabelText("Loading OIDC client")).toBeTruthy();
  });

  it("says so when the client cannot be loaded", () => {
    h.useGetAuthOidcCredential.mockReturnValue({ data: undefined, isLoading: false });
    renderPage();
    expect(screen.getByText("This OIDC client could not be loaded")).toBeTruthy();
    expect(screen.getByRole("link", { name: "OIDC clients" })).toBeTruthy();
  });
});
