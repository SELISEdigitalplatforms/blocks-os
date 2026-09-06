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
});
