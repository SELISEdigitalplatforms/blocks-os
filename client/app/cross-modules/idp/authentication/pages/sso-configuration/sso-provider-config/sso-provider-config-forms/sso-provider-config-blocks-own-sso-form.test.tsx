import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// blocks-kit's theme store reads matchMedia at import time, which jsdom does not provide.
vi.stubGlobal("matchMedia", (query: string) => ({
  matches: false,
  media: query,
  onchange: null,
  addListener: vi.fn(),
  removeListener: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  dispatchEvent: vi.fn(),
}));

vi.stubGlobal(
  "ResizeObserver",
  class {
    observe() {}
    unobserve() {}
    disconnect() {}
  },
);

const mutateAsync = vi.fn();
const showErrorToast = vi.fn();
const showSuccessToast = vi.fn();

vi.mock("@seliseblocks/blocks-kit", () => ({
  useProjectStore: () => ({ selectedProject: { tenantId: "tenant-1" } }),
}));

vi.mock("@blocks-idp/authentication/hooks/use-sso", () => ({
  useSaveSsoCredential: () => ({ mutateAsync }),
}));

vi.mock("@/hooks/use-toast", () => ({
  showErrorToast: (...args: unknown[]) => showErrorToast(...args),
  showSuccessToast: (...args: unknown[]) => showSuccessToast(...args),
}));

const { SSOProviderConfigOwnSSOForm } = await import("./sso-provider-config-blocks-own-sso-form");

const validConfiguration = {
  provider: "ownsso",
  audience: "https://audience.example.com",
  clientId: "own-client",
  clientSecret: "own-secret",
  redirectUrl: "https://redirect.example.com/callback",
  wellKnownUrl: "https://idp.example.com/.well-known/openid-configuration",
};

const renderForm = (configuration: typeof validConfiguration | null = null) =>
  render(
    <SSOProviderConfigOwnSSOForm
      save={vi.fn()}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      configuration={configuration as any}
    />,
  );

describe("SSOProviderConfigOwnSSOForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("renders the OAuth fields plus the Well Known URL field", () => {
    renderForm();
    expect(screen.getByText("Client ID")).toBeTruthy();
    expect(screen.getByText("Client Secret")).toBeTruthy();
    expect(screen.getByText("Well Known URL")).toBeTruthy();
  });

  it("saves the credential and shows a success toast on valid submit", async () => {
    const user = userEvent.setup();
    mutateAsync.mockResolvedValue({ isSuccess: true });
    renderForm(validConfiguration);

    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(mutateAsync).toHaveBeenCalledTimes(1);
    });
    expect(mutateAsync.mock.calls[0][0]).toMatchObject({
      provider: "ownsso",
      clientId: "own-client",
      wellKnownUrl: "https://idp.example.com/.well-known/openid-configuration",
      projectKey: "tenant-1",
      ssoType: 1,
    });
    await waitFor(() => {
      expect(showSuccessToast).toHaveBeenCalled();
    });
  });

  it("surfaces an error toast when the mutation fails", async () => {
    const user = userEvent.setup();
    mutateAsync.mockResolvedValue({ isSuccess: false, errors: "bad" });
    renderForm(validConfiguration);

    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(showErrorToast).toHaveBeenCalledWith({ errors: "bad" });
    });
    expect(showSuccessToast).not.toHaveBeenCalled();
  });

  it("blocks submission when the Well Known URL is invalid", async () => {
    const user = userEvent.setup();
    renderForm({ ...validConfiguration, wellKnownUrl: "not-a-url" });

    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(screen.getByText("Well known URL must be a valid URL.")).toBeTruthy();
    });
    expect(mutateAsync).not.toHaveBeenCalled();
  });
});
