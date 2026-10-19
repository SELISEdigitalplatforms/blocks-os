import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  saveOidc: vi.fn(),
  isPending: false,
  useGetAuthOidcCredential: vi.fn(),
  showErrorToast: vi.fn(),
  showSuccessToast: vi.fn(),
}));

vi.mock("@seliseblocks/genesis-os", () => {
  const Passthrough = ({ children }: { children?: React.ReactNode }) => <>{children}</>;
  return {
    useProjectStore: () => ({ selectedProject: { tenantId: "tenant-1" } }),
    Tooltip: Passthrough,
    TooltipTrigger: Passthrough,
    TooltipContent: Passthrough,
    TooltipProvider: Passthrough,
  };
});
vi.mock("@blocks-idp/authentication/hooks/use-auth-oidc", () => ({
  useSaveAuthOidc: () => ({ mutateAsync: h.saveOidc, isPending: h.isPending }),
  useGetAuthOidcCredential: (args: unknown, enabled: boolean) =>
    h.useGetAuthOidcCredential(args, enabled),
}));
vi.mock("@/hooks/use-toast", () => ({
  showErrorToast: h.showErrorToast,
  showSuccessToast: h.showSuccessToast,
}));

import { CreateOIDC } from "./create-oidc";

const WEB_HELPER = "For browser-based apps.";
const MOBILE_HELPER =
  "For iOS and Android apps. Uses a public client with PKCE, and the app receives tokens in the token response.";
const WEB_APP_SCHEME_MESSAGE = "Mobile app redirect URIs need the Mobile app application type.";
const MOBILE_INVALID_MESSAGE =
  "Enter an HTTPS URL or a mobile app URI such as com.example.app://callback.";
const HTTPS_MESSAGE =
  "Enter a valid HTTPS URL with a public domain (e.g. https://example.com/callback). Localhost may use HTTP.";
const WEB_PLACEHOLDER = "https://example.com/oidc";
const MOBILE_PLACEHOLDER = "com.example.app://callback";

type User = ReturnType<typeof userEvent.setup>;

const mockCredential = (overrides: Record<string, unknown> = {}) =>
  h.useGetAuthOidcCredential.mockReturnValue({
    data: {
      oIDCClientCredential: {
        clientDisplayName: "Existing",
        redirectUris: ["https://existing.example.com/cb"],
        scope: "openid",
        isActive: true,
        requirePkce: true,
        isAutoRedirect: false,
        isDeviceFlowClient: false,
        registerAsIdentityProvider: true,
        allowedResponseTypes: ["code"],
        ...overrides,
      },
    },
    isLoading: false,
  });

const openCreate = async (user: User) => {
  render(<CreateOIDC />);
  await user.click(screen.getByRole("button", { name: /Create/i }));
  await screen.findByRole("heading", { name: "New OIDC Client" });
};

const openEdit = async (user: User) => {
  render(<CreateOIDC itemId="oidc-1" />);
  await user.click(screen.getByRole("button", { name: "Edit" }));
  await waitFor(() => expect(screen.getByDisplayValue("Existing")).toBeTruthy());
};

const radio = (name: "Web application" | "Mobile app") => screen.getByRole("radio", { name });
const isChecked = (el: HTMLElement) => el.getAttribute("aria-checked") === "true";
const uriInput = (idx = 0) =>
  screen
    .getAllByRole("textbox")
    .filter((el) => el.getAttribute("name") === `redirectUris.${idx}.value`)[0] as HTMLInputElement;
const submitButton = (name: "Add" | "Update" = "Add") =>
  screen.getByRole("button", { name }) as HTMLButtonElement;
const lastPayload = () => h.saveOidc.mock.calls[0][0];

describe("CreateOIDC", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.isPending = false;
    h.saveOidc.mockResolvedValue({ isSuccess: true });
    h.useGetAuthOidcCredential.mockReturnValue({ data: undefined, isLoading: false });
  });

  it("opens the create dialog from the Create trigger", async () => {
    const user = userEvent.setup();
    render(<CreateOIDC />);
    await user.click(screen.getByRole("button", { name: /Create/i }));
    expect(await screen.findByRole("heading", { name: "New OIDC Client" })).toBeTruthy();
    expect(screen.getByText("Enter details to generate a new key")).toBeTruthy();
  });

  it("blocks submission and flags the redirect URI when it is empty", async () => {
    const user = userEvent.setup();
    render(<CreateOIDC />);
    await user.click(screen.getByRole("button", { name: /Create/i }));
    await user.type(screen.getByPlaceholderText("Enter client name"), "My App");
    // Touch the redirect URI field to trigger onChange validation
    await user.click(screen.getByPlaceholderText("https://example.com/oidc"));
    await user.keyboard("a");
    await user.keyboard("{Backspace}");
    await user.click(screen.getByRole("button", { name: "Add" }));
    expect(await screen.findByText("Redirect URI is required")).toBeTruthy();
    expect(h.saveOidc).not.toHaveBeenCalled();
  });

  it("shows Device Flow before Redirect URI(s)", async () => {
    const user = userEvent.setup();
    render(<CreateOIDC />);
    await user.click(screen.getByRole("button", { name: /Create/i }));

    const deviceFlowLabel = screen.getByText("Device Flow");
    const redirectLabel = screen.getByText("Redirect URI(s)");

    expect(
      deviceFlowLabel.compareDocumentPosition(redirectLabel) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("creates a device-flow OIDC client without auth-code response metadata", async () => {
    const user = userEvent.setup();
    render(<CreateOIDC />);
    await user.click(screen.getByRole("button", { name: /Create/i }));
    await user.type(screen.getByPlaceholderText("Enter client name"), "My App");
    await user.click(screen.getByLabelText("Generate this OIDC client only for device flow"));
    expect(screen.queryByText("Redirect URI(s)")).toBeNull();
    expect(screen.queryByText("Auto Redirect")).toBeNull();
    await user.click(screen.getByRole("button", { name: "Add" }));

    await waitFor(() => expect(h.saveOidc).toHaveBeenCalledTimes(1));
    const payload = h.saveOidc.mock.calls[0][0];
    expect(payload.clientDisplayName).toBe("My App");
    expect(payload.redirectUris).toEqual([]);
    expect(payload.isDeviceFlowClient).toBe(true);
    expect(payload.allowedResponseTypes).toEqual([]);
    expect(payload.isAutoRedirect).toBe(false);
    expect(h.showSuccessToast).toHaveBeenCalledWith({
      description: "OIDC Client created successfully",
    });
  });

  it("creates a standard OIDC client with code response metadata", async () => {
    const user = userEvent.setup();
    render(<CreateOIDC />);
    await user.click(screen.getByRole("button", { name: /Create/i }));
    await user.type(screen.getByPlaceholderText("Enter client name"), "My App");
    await user.type(
      screen.getByPlaceholderText("https://example.com/oidc"),
      "https://app.example.com/callback",
    );
    await user.click(screen.getByRole("button", { name: "Add" }));

    await waitFor(() => expect(h.saveOidc).toHaveBeenCalledTimes(1));
    const payload = h.saveOidc.mock.calls[0][0];
    expect(payload.redirectUris).toEqual(["https://app.example.com/callback"]);
    expect(payload.isDeviceFlowClient).toBe(false);
    expect(payload.allowedResponseTypes).toEqual(["code"]);
    expect(payload).not.toHaveProperty("clientBrandColor");
    expect(payload).not.toHaveProperty("clientLogoUrl");
  });

  it("restores Auto Redirect unchecked after Device Flow is turned back off", async () => {
    const user = userEvent.setup();
    render(<CreateOIDC />);
    await user.click(screen.getByRole("button", { name: /Create/i }));
    await user.click(screen.getByLabelText("Redirect automatically after authentication"));
    expect(
      screen
        .getByLabelText("Redirect automatically after authentication")
        .getAttribute("aria-checked"),
    ).toBe("true");

    const deviceFlow = screen.getByLabelText("Generate this OIDC client only for device flow");
    await user.click(deviceFlow);
    expect(screen.queryByText("Auto Redirect")).toBeNull();

    await user.click(deviceFlow);
    expect(
      screen
        .getByLabelText("Redirect automatically after authentication")
        .getAttribute("aria-checked"),
    ).toBe("false");
  });

  it("adds another redirect URI input on demand", async () => {
    const user = userEvent.setup();
    render(<CreateOIDC />);
    await user.click(screen.getByRole("button", { name: /Create/i }));
    const before = screen.getAllByPlaceholderText("https://example.com/oidc").length;
    await user.click(screen.getByRole("button", { name: /Add Redirect URI/i }));
    expect(screen.getAllByPlaceholderText("https://example.com/oidc").length).toBe(before + 1);
  });

  it("loads and edits an existing OIDC client", async () => {
    const user = userEvent.setup();
    h.useGetAuthOidcCredential.mockReturnValue({
      data: {
        oIDCClientCredential: {
          clientDisplayName: "Existing OIDC",
          redirectUris: ["https://existing.example.com/cb"],
          scope: "openid",
          isActive: true,
          requirePkce: true,
          isDeviceFlowClient: true,
          isAutoRedirect: true,
        },
      },
      isLoading: false,
    });
    render(<CreateOIDC itemId="oidc-1" />);
    await user.click(screen.getByRole("button", { name: "Edit" }));
    expect(await screen.findByRole("heading", { name: "Edit OIDC Client" })).toBeTruthy();
    await waitFor(() => expect(screen.getByDisplayValue("Existing OIDC")).toBeTruthy());
    expect(screen.queryByDisplayValue("https://existing.example.com/cb")).toBeNull();
    expect(
      screen
        .getByLabelText("Generate this OIDC client only for device flow")
        .getAttribute("aria-checked"),
    ).toBe("true");
    expect(screen.queryByText("Auto Redirect")).toBeNull();

    await user.click(screen.getByRole("button", { name: "Update" }));
    await waitFor(() => expect(h.saveOidc).toHaveBeenCalledTimes(1));
    expect(h.saveOidc.mock.calls[0][0].itemId).toBe("oidc-1");
    expect(h.saveOidc.mock.calls[0][0].isDeviceFlowClient).toBe(true);
    expect(h.saveOidc.mock.calls[0][0].allowedResponseTypes).toEqual([]);
    expect(h.saveOidc.mock.calls[0][0].isAutoRedirect).toBe(false);
    expect(h.saveOidc.mock.calls[0][0]).not.toHaveProperty("clientBrandColor");
    expect(h.saveOidc.mock.calls[0][0]).not.toHaveProperty("clientLogoUrl");
    expect(h.showSuccessToast).toHaveBeenCalledWith({
      description: "OIDC Client updated successfully",
    });
  });

  it("surfaces a server error when the save is not successful", async () => {
    const user = userEvent.setup();
    h.saveOidc.mockResolvedValue({ isSuccess: false, error: "bad request" });
    render(<CreateOIDC />);
    await user.click(screen.getByRole("button", { name: /Create/i }));
    await user.type(screen.getByPlaceholderText("Enter client name"), "My App");
    await user.type(
      screen.getByPlaceholderText("https://example.com/oidc"),
      "https://app.example.com/callback",
    );
    await user.click(screen.getByRole("button", { name: "Add" }));
    await waitFor(() => expect(h.showErrorToast).toHaveBeenCalledWith({ errors: "bad request" }));
  });

  describe("application type", () => {
    it("H1: create opens with Web application selected and the Web helper line", async () => {
      const user = userEvent.setup();
      await openCreate(user);
      expect(screen.getByText("Application type")).toBeTruthy();
      expect(isChecked(radio("Web application"))).toBe(true);
      expect(isChecked(radio("Mobile app"))).toBe(false);
      expect(radio("Web application").id).toBe("applicationType-web");
      expect(radio("Mobile app").id).toBe("applicationType-mobile");
      expect(screen.getByText(WEB_HELPER)).toBeTruthy();
      expect(screen.queryByText(MOBILE_HELPER)).toBeNull();
      expect(screen.getByPlaceholderText(WEB_PLACEHOLDER)).toBeTruthy();
    });

    it("places Application type between Device Flow and Redirect URI(s)", async () => {
      const user = userEvent.setup();
      await openCreate(user);
      const deviceFlow = screen.getByText("Device Flow");
      const appType = screen.getByText("Application type");
      const redirect = screen.getByText("Redirect URI(s)");
      expect(
        deviceFlow.compareDocumentPosition(appType) & Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
      expect(
        appType.compareDocumentPosition(redirect) & Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
    });

    it("H2: Mobile locks PKCE, hides Identity Provider, swaps placeholder and helper", async () => {
      const user = userEvent.setup();
      await openCreate(user);
      await user.click(radio("Mobile app"));
      expect(isChecked(radio("Mobile app"))).toBe(true);
      const pkce = screen.getByLabelText("Required for mobile apps");
      expect(pkce.getAttribute("aria-checked")).toBe("true");
      expect((pkce as HTMLButtonElement).disabled).toBe(true);
      expect(screen.getByText("Required for mobile apps").className).toContain(
        "cursor-not-allowed text-sm text-muted-foreground",
      );
      expect(screen.queryByText("Identity Provider")).toBeNull();
      expect(screen.getByPlaceholderText(MOBILE_PLACEHOLDER)).toBeTruthy();
      expect(screen.queryByPlaceholderText(WEB_PLACEHOLDER)).toBeNull();
      expect(screen.getByText(MOBILE_HELPER)).toBeTruthy();
      expect(screen.queryByText(WEB_HELPER)).toBeNull();
    });

    it("H3 / Example 2: saves a Mobile app client with an app-scheme URI", async () => {
      const user = userEvent.setup();
      await openCreate(user);
      await user.type(screen.getByPlaceholderText("Enter client name"), "Klax");
      await user.click(radio("Mobile app"));
      await user.type(uriInput(), "com.klaxai.app://login/callback");
      await user.click(submitButton());
      await waitFor(() => expect(h.saveOidc).toHaveBeenCalledTimes(1));
      expect(lastPayload()).toMatchObject({
        clientDisplayName: "Klax",
        clientType: "public",
        useTokensCookie: false,
        requirePkce: true,
        registerAsIdentityProvider: false,
        redirectUris: ["com.klaxai.app://login/callback"],
        isDeviceFlowClient: false,
        itemId: "",
      });
      expect(h.showSuccessToast).toHaveBeenCalledWith({
        description: "OIDC Client created successfully",
      });
    });

    it("H4: Mobile accepts an https redirect URI on a public domain", async () => {
      const user = userEvent.setup();
      await openCreate(user);
      await user.type(screen.getByPlaceholderText("Enter client name"), "Klax");
      await user.click(radio("Mobile app"));
      await user.type(uriInput(), "https://klax.example.com/callback");
      expect(screen.queryByText(MOBILE_INVALID_MESSAGE)).toBeNull();
      await user.click(submitButton());
      await waitFor(() => expect(h.saveOidc).toHaveBeenCalledTimes(1));
      expect(lastPayload().redirectUris).toEqual(["https://klax.example.com/callback"]);
      expect(lastPayload().clientType).toBe("public");
    });

    it("H5 / Example 1: saves a new Web client as confidential with cookie delivery", async () => {
      const user = userEvent.setup();
      await openCreate(user);
      await user.type(screen.getByPlaceholderText("Enter client name"), "Portal");
      await user.type(uriInput(), "https://portal.example.com/callback");
      await user.click(submitButton());
      await waitFor(() => expect(h.saveOidc).toHaveBeenCalledTimes(1));
      expect(lastPayload()).toEqual({
        redirectUris: ["https://portal.example.com/callback"],
        scope: "openid",
        isAutoRedirect: false,
        isActive: true,
        clientType: "confidential",
        useTokensCookie: true,
        requirePkce: true,
        registerAsIdentityProvider: true,
        isDeviceFlowClient: false,
        allowedResponseTypes: ["code"],
        itemId: "",
        clientDisplayName: "Portal",
      });
    });

    it("H6 / Example 6: edit of a stored public, no-cookie client preselects Mobile app", async () => {
      const user = userEvent.setup();
      mockCredential({
        clientType: "public",
        useTokensCookie: false,
        isDeviceFlowClient: false,
        registerAsIdentityProvider: false,
      });
      await openEdit(user);
      expect(isChecked(radio("Mobile app"))).toBe(true);
      expect(screen.getByLabelText("Required for mobile apps").getAttribute("aria-checked")).toBe(
        "true",
      );
      expect(screen.queryByText("Identity Provider")).toBeNull();
    });

    it.each([
      ["public + cookie", { clientType: "public", useTokensCookie: true }],
      ["confidential + no cookie", { clientType: "confidential", useTokensCookie: false }],
      ["null client type", { clientType: null, useTokensCookie: false }],
      ["missing fields", {}],
    ])("H7: edit of a %s client preselects Web application", async (_label, stored) => {
      const user = userEvent.setup();
      mockCredential(stored);
      await openEdit(user);
      expect(isChecked(radio("Web application"))).toBe(true);
      expect(screen.getByText("Identity Provider")).toBeTruthy();
    });

    it.each([
      ["confidential", "confidential", false],
      ["null", null, true],
    ])(
      "H8: edit loaded as Web resends the stored %s client type unchanged",
      async (_label, clientType, useTokensCookie) => {
        const user = userEvent.setup();
        mockCredential({ clientType, useTokensCookie });
        await openEdit(user);
        await user.clear(screen.getByDisplayValue("Existing"));
        await user.type(screen.getByPlaceholderText("Enter client name"), "Renamed");
        await user.click(submitButton("Update"));
        await waitFor(() => expect(h.saveOidc).toHaveBeenCalledTimes(1));
        expect(lastPayload()).toHaveProperty("clientType", clientType);
        expect(lastPayload().useTokensCookie).toBe(useTokensCookie);
        expect(lastPayload().clientDisplayName).toBe("Renamed");
        expect(lastPayload().itemId).toBe("oidc-1");
        expect(lastPayload().registerAsIdentityProvider).toBe(true);
      },
    );

    it("C6 / Example 5: edit of a public cookie client as Web resends public and true", async () => {
      const user = userEvent.setup();
      mockCredential({ clientType: "public", useTokensCookie: true });
      await openEdit(user);
      expect(isChecked(radio("Web application"))).toBe(true);
      await user.type(screen.getByDisplayValue("Existing"), " SPA");
      await user.click(submitButton("Update"));
      await waitFor(() => expect(h.saveOidc).toHaveBeenCalledTimes(1));
      expect(lastPayload().clientType).toBe("public");
      expect(lastPayload().useTokensCookie).toBe(true);
    });

    it("C7: a GET without clientType or useTokensCookie preselects Web and resends null and true", async () => {
      const user = userEvent.setup();
      mockCredential();
      await openEdit(user);
      expect(isChecked(radio("Web application"))).toBe(true);
      await user.click(submitButton("Update"));
      await waitFor(() => expect(h.saveOidc).toHaveBeenCalledTimes(1));
      expect(lastPayload()).toHaveProperty("clientType", null);
      expect(lastPayload().useTokensCookie).toBe(true);
    });

    it("H9: switching a loaded Mobile client to Web sends confidential and true", async () => {
      const user = userEvent.setup();
      mockCredential({
        clientType: "public",
        useTokensCookie: false,
        registerAsIdentityProvider: false,
        redirectUris: ["https://klax.example.com/cb"],
      });
      await openEdit(user);
      await user.click(radio("Web application"));
      await user.click(submitButton("Update"));
      await waitFor(() => expect(h.saveOidc).toHaveBeenCalledTimes(1));
      expect(lastPayload().clientType).toBe("confidential");
      expect(lastPayload().useTokensCookie).toBe(true);
      expect(lastPayload().requirePkce).toBe(true);
      expect(lastPayload().registerAsIdentityProvider).toBe(false);
    });

    it("edit still Mobile sends public, false, PKCE and no identity provider", async () => {
      const user = userEvent.setup();
      mockCredential({ clientType: "public", useTokensCookie: false, requirePkce: false });
      await openEdit(user);
      await user.click(submitButton("Update"));
      await waitFor(() => expect(h.saveOidc).toHaveBeenCalledTimes(1));
      expect(lastPayload()).toMatchObject({
        clientType: "public",
        useTokensCookie: false,
        requirePkce: true,
        registerAsIdentityProvider: false,
      });
    });

    it("edit loaded Web switched to Mobile sends the Mobile values", async () => {
      const user = userEvent.setup();
      mockCredential({ clientType: "confidential", useTokensCookie: true });
      await openEdit(user);
      await user.click(radio("Mobile app"));
      await user.click(submitButton("Update"));
      await waitFor(() => expect(h.saveOidc).toHaveBeenCalledTimes(1));
      expect(lastPayload()).toMatchObject({
        clientType: "public",
        useTokensCookie: false,
        requirePkce: true,
        registerAsIdentityProvider: false,
      });
    });

    it("H10: Device Flow hides Application type; create omits clientType and sends cookie delivery", async () => {
      const user = userEvent.setup();
      await openCreate(user);
      await user.type(screen.getByPlaceholderText("Enter client name"), "TV");
      await user.click(screen.getByLabelText("Generate this OIDC client only for device flow"));
      expect(screen.queryByText("Application type")).toBeNull();
      expect(screen.queryByRole("radio")).toBeNull();
      await user.click(submitButton());
      await waitFor(() => expect(h.saveOidc).toHaveBeenCalledTimes(1));
      expect(lastPayload()).not.toHaveProperty("clientType");
      expect(lastPayload()).toMatchObject({
        useTokensCookie: true,
        requirePkce: false,
        registerAsIdentityProvider: false,
        isDeviceFlowClient: true,
        redirectUris: [],
        allowedResponseTypes: [],
        isAutoRedirect: false,
      });
    });

    it("H10: device-flow edit resends the stored clientType and useTokensCookie", async () => {
      const user = userEvent.setup();
      mockCredential({ isDeviceFlowClient: true, clientType: "public", useTokensCookie: false });
      await openEdit(user);
      expect(screen.queryByText("Application type")).toBeNull();
      await user.click(submitButton("Update"));
      await waitFor(() => expect(h.saveOidc).toHaveBeenCalledTimes(1));
      expect(lastPayload()).toMatchObject({
        clientType: "public",
        useTokensCookie: false,
        requirePkce: false,
        registerAsIdentityProvider: false,
        isDeviceFlowClient: true,
      });
    });

    it("C11: Device Flow while Mobile sends the device-flow payload; unticking restores Mobile", async () => {
      const user = userEvent.setup();
      await openCreate(user);
      await user.type(screen.getByPlaceholderText("Enter client name"), "TV");
      await user.click(radio("Mobile app"));
      const deviceFlow = screen.getByLabelText("Generate this OIDC client only for device flow");
      await user.click(deviceFlow);
      expect(screen.queryByRole("radio")).toBeNull();
      expect(screen.queryByText("Redirect URI(s)")).toBeNull();
      await user.click(deviceFlow);
      expect(isChecked(radio("Mobile app"))).toBe(true);
      expect(screen.getByPlaceholderText(MOBILE_PLACEHOLDER)).toBeTruthy();
      await user.click(deviceFlow);
      await user.click(submitButton());
      await waitFor(() => expect(h.saveOidc).toHaveBeenCalledTimes(1));
      expect(lastPayload()).not.toHaveProperty("clientType");
      expect(lastPayload()).toMatchObject({
        isDeviceFlowClient: true,
        useTokensCookie: true,
        requirePkce: false,
        registerAsIdentityProvider: false,
        redirectUris: [],
      });
    });

    it("H11: edit loads through one stable GET query and each save posts once", async () => {
      const user = userEvent.setup();
      mockCredential();
      render(<CreateOIDC itemId="oidc-1" />);
      expect(h.useGetAuthOidcCredential.mock.calls.every(([, enabled]) => enabled === false)).toBe(
        true,
      );
      await user.click(screen.getByRole("button", { name: "Edit" }));
      await waitFor(() => expect(screen.getByDisplayValue("Existing")).toBeTruthy());
      const enabledCalls = h.useGetAuthOidcCredential.mock.calls.filter(([, enabled]) => enabled);
      expect(enabledCalls.length).toBeGreaterThan(0);
      enabledCalls.forEach(([args]) =>
        expect(args).toEqual({ projectKey: "tenant-1", clientId: "oidc-1" }),
      );
      await user.click(submitButton("Update"));
      await waitFor(() => expect(h.saveOidc).toHaveBeenCalledTimes(1));
      expect(h.saveOidc).toHaveBeenCalledTimes(1);
    });

    it("H12: a saved Mobile client reopens as Mobile app with the same redirect URIs", async () => {
      const user = userEvent.setup();
      mockCredential({
        clientType: "public",
        useTokensCookie: false,
        redirectUris: ["com.klaxai.app://login/callback", "https://klax.example.com/cb"],
      });
      await openEdit(user);
      expect(isChecked(radio("Mobile app"))).toBe(true);
      expect(screen.getByDisplayValue("com.klaxai.app://login/callback")).toBeTruthy();
      expect(screen.getByDisplayValue("https://klax.example.com/cb")).toBeTruthy();
      expect(screen.queryByText(MOBILE_INVALID_MESSAGE)).toBeNull();
      await waitFor(() => expect(submitButton("Update").disabled).toBe(false));
    });

    it("C1 / Example 3: Web with an app-scheme URI shows the message and stays disabled", async () => {
      const user = userEvent.setup();
      await openCreate(user);
      await user.type(screen.getByPlaceholderText("Enter client name"), "Klax");
      await user.type(uriInput(), "com.klaxai.app://login/callback");
      expect(await screen.findByText(WEB_APP_SCHEME_MESSAGE)).toBeTruthy();
      expect(submitButton().disabled).toBe(true);
      await user.click(submitButton());
      expect(h.saveOidc).not.toHaveBeenCalled();
    });

    it.each([
      ["C2 / Example 4 (no dot)", "myapp://callback"],
      ["C3 (javascript:)", "javascript:alert(1)"],
      ["C3 (data:)", "data:text/html,x"],
      ["C4 (fragment)", "com.blocks.e2e.app://cb#x"],
    ])("%s: Mobile shows the Mobile invalid message and sends nothing", async (_label, value) => {
      const user = userEvent.setup();
      await openCreate(user);
      await user.type(screen.getByPlaceholderText("Enter client name"), "Klax");
      await user.click(radio("Mobile app"));
      await user.type(uriInput(), value);
      expect(await screen.findByText(MOBILE_INVALID_MESSAGE)).toBeTruthy();
      expect(submitButton().disabled).toBe(true);
      await user.click(submitButton());
      expect(h.saveOidc).not.toHaveBeenCalled();
    });

    it("C5: Web with http on a non-localhost host shows the existing HTTPS message", async () => {
      const user = userEvent.setup();
      await openCreate(user);
      await user.type(screen.getByPlaceholderText("Enter client name"), "Portal");
      await user.type(uriInput(), "http://portal.example.com/cb");
      expect(await screen.findByText(HTTPS_MESSAGE)).toBeTruthy();
      expect(h.saveOidc).not.toHaveBeenCalled();
    });

    it("C8: an IAM 400 keeps the dialog open with the input kept", async () => {
      const user = userEvent.setup();
      h.saveOidc.mockResolvedValue({ isSuccess: false, error: { RedirectUris: "invalid" } });
      await openCreate(user);
      await user.type(screen.getByPlaceholderText("Enter client name"), "Klax");
      await user.click(radio("Mobile app"));
      await user.type(uriInput(), "com.klaxai.app://login/callback");
      await user.click(submitButton());
      await waitFor(() =>
        expect(h.showErrorToast).toHaveBeenCalledWith({ errors: { RedirectUris: "invalid" } }),
      );
      expect(h.showSuccessToast).not.toHaveBeenCalled();
      expect(screen.getByRole("heading", { name: "New OIDC Client" })).toBeTruthy();
      expect(screen.getByDisplayValue("Klax")).toBeTruthy();
      expect(uriInput().value).toBe("com.klaxai.app://login/callback");
      expect(isChecked(radio("Mobile app"))).toBe(true);
      await waitFor(() => expect(submitButton().disabled).toBe(false));
    });

    it("C8: a 403 rejection shows the error toast and keeps the dialog open", async () => {
      const user = userEvent.setup();
      h.saveOidc.mockRejectedValue({ errors: { Forbidden: "forbidden" } });
      await openCreate(user);
      await user.type(screen.getByPlaceholderText("Enter client name"), "Portal");
      await user.type(uriInput(), "https://portal.example.com/cb");
      await user.click(submitButton());
      await waitFor(() =>
        expect(h.showErrorToast).toHaveBeenCalledWith({ errors: { Forbidden: "forbidden" } }),
      );
      expect(screen.getByRole("heading", { name: "New OIDC Client" })).toBeTruthy();
      expect(uriInput().value).toBe("https://portal.example.com/cb");
    });

    it("C8: a network failure shows the generic error toast", async () => {
      const user = userEvent.setup();
      h.saveOidc.mockRejectedValue(new Error("network"));
      await openCreate(user);
      await user.type(screen.getByPlaceholderText("Enter client name"), "Portal");
      await user.type(uriInput(), "https://portal.example.com/cb");
      await user.click(submitButton());
      await waitFor(() =>
        expect(h.showErrorToast).toHaveBeenCalledWith({ errors: "Something went wrong" }),
      );
      expect(screen.getByDisplayValue("Portal")).toBeTruthy();
    });

    it("C9: switching Mobile to Web flags app-scheme entries at once and disables submit", async () => {
      const user = userEvent.setup();
      await openCreate(user);
      await user.type(screen.getByPlaceholderText("Enter client name"), "Klax");
      await user.click(radio("Mobile app"));
      await user.type(uriInput(), "com.klaxai.app://login/callback");
      await waitFor(() => expect(submitButton().disabled).toBe(false));
      await user.click(radio("Web application"));
      expect(await screen.findByText(WEB_APP_SCHEME_MESSAGE)).toBeTruthy();
      await waitFor(() => expect(submitButton().disabled).toBe(true));
      await user.click(radio("Mobile app"));
      await waitFor(() => expect(screen.queryByText(WEB_APP_SCHEME_MESSAGE)).toBeNull());
    });

    it("C10: switching back to Web re-enables PKCE and shows Identity Provider unchecked", async () => {
      const user = userEvent.setup();
      await openCreate(user);
      await user.click(screen.getByLabelText("Enabled"));
      expect(screen.getByLabelText("Enabled").getAttribute("aria-checked")).toBe("false");
      await user.click(radio("Mobile app"));
      await user.click(radio("Web application"));
      const pkce = screen.getByLabelText("Enabled") as HTMLButtonElement;
      expect(pkce.disabled).toBe(false);
      expect(pkce.getAttribute("aria-checked")).toBe("true");
      expect(screen.queryByText("Required for mobile apps")).toBeNull();
      expect(
        screen
          .getByLabelText("Register as a Blocks OIDC identity provider")
          .getAttribute("aria-checked"),
      ).toBe("false");
    });

    it("C12: a pending save keeps the submit disabled", async () => {
      const user = userEvent.setup();
      h.isPending = true;
      await openCreate(user);
      await user.type(screen.getByPlaceholderText("Enter client name"), "Portal");
      await user.type(uriInput(), "https://portal.example.com/cb");
      expect(submitButton().disabled).toBe(true);
      await user.click(submitButton());
      expect(h.saveOidc).not.toHaveBeenCalled();
    });

    it("C12: double-clicking save while the request is in flight posts once", async () => {
      const user = userEvent.setup();
      let resolveSave: (value: { isSuccess: boolean }) => void = () => {};
      h.saveOidc.mockImplementation(
        () =>
          new Promise((resolve) => {
            resolveSave = resolve;
          }),
      );
      await openCreate(user);
      await user.type(screen.getByPlaceholderText("Enter client name"), "Portal");
      await user.type(uriInput(), "https://portal.example.com/cb");
      await user.dblClick(submitButton());
      await waitFor(() => expect(h.saveOidc).toHaveBeenCalledTimes(1));
      expect(submitButton().disabled).toBe(true);
      resolveSave({ isSuccess: true });
      await waitFor(() => expect(h.showSuccessToast).toHaveBeenCalledTimes(1));
      expect(h.saveOidc).toHaveBeenCalledTimes(1);
    });

    it("uses the ui-kits radio group and label and no hard-coded colours", () => {
      const source = readFileSync(
        resolve(
          process.cwd(),
          "app/cross-modules/idp/authentication/components/create-oidc/create-oidc.tsx",
        ),
        "utf8",
      );
      expect(source).toContain(
        'import { RadioGroup, RadioGroupItem } from "@/components/ui-kits/radio-group/radio-group";',
      );
      expect(source).toContain('import { Label } from "@/components/ui-kits/label/label";');
      expect(source).not.toMatch(/#[0-9a-fA-F]{3,8}\b|rgba?\(|hsl\(/);
      expect(source).not.toMatch(/(?:bg|text|border)-(?:red|blue|green|gray|slate|emerald)-\d/);
    });
  });
});
