import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ISettingsAuthConfig } from "@blocks-idp/settings/models/settings.model";

const h = vi.hoisted(() => ({
  mutateAsync: vi.fn(),
  isPending: false,
  showErrorToast: vi.fn(),
  showSuccessToast: vi.fn(),
}));

vi.mock("@blocks-idp/settings/hooks/use-settings-config", () => ({
  useSaveSettingsAuthConfig: () => ({ mutateAsync: h.mutateAsync, isPending: h.isPending }),
}));

vi.mock("@/hooks/use-toast", () => ({
  showErrorToast: h.showErrorToast,
  showSuccessToast: h.showSuccessToast,
}));

const { IamSettingsForm } = await import("@blocks-idp/settings/components/iam-settings-form");
const { SettingsTabActionsProvider, SettingsTabActionsSlot } = await import(
  "@blocks-idp/settings/components/settings-tab-actions"
);

const baseConfig: ISettingsAuthConfig = {
  itemId: "cfg-1",
  accessTokenValidForNumberMinutes: 5,
  refreshTokenValidForNumberMinutes: 60,
  absoluteRefreshTokenValidForNumberMinutes: 120,
  rememberMeRefreshTokenValidForNumberMinutes: 240,
  getNumberOfWrongAttemptsToLockTheAccount: 3,
  accountLockDurationInMinutes: 15,
  publicCertificatePath: "/certs/pub.pem",
  accountActivationPath: "/auth/activate-account",
  accountVerificationPath: "/auth/verify-identity",
  recoverAccountPath: "/auth/recovery",
  accountActionBaseUrl: "https://app.example.com",
  useAccountActionBaseUrlAsDefault: false,
  activationUrlLifetimeInMinutes: 30,
  recoverAccountUrlLifetimeInMinutes: 45,
  logoutOnPasswordChange: false,
  isOidcEnabled: false,
  passwordStrengthCheckerRegex: "",
  collectPasswordOnActivation: true,
  allowedGrantTypes: ["authorization_code"],
} as unknown as ISettingsAuthConfig;

const renderForm = (config: ISettingsAuthConfig = baseConfig) =>
  render(
    <SettingsTabActionsProvider>
      <SettingsTabActionsSlot activeTab="iam-config" />
      <IamSettingsForm config={config} />
    </SettingsTabActionsProvider>,
  );

const saveButton = () => screen.getByRole("button", { name: "Save" }) as HTMLButtonElement;
const resetButton = () => screen.getByRole("button", { name: "Reset" }) as HTMLButtonElement;

describe("IamSettingsForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.isPending = false;
    h.mutateAsync.mockResolvedValue({ isSuccess: true });
  });

  it("shows the activation and recovery path fields while OIDC is off", () => {
    renderForm();
    expect(screen.getByDisplayValue("/auth/activate-account")).toBeTruthy();
    expect(screen.getByDisplayValue("/auth/verify-identity")).toBeTruthy();
    expect(screen.getByDisplayValue("/auth/recovery")).toBeTruthy();
    expect(saveButton().disabled).toBe(true);
  });

  it("saves the edited configuration and reports success", async () => {
    const user = userEvent.setup();
    renderForm();

    const activation = screen.getByPlaceholderText("/auth/activate-account");
    await user.clear(activation);
    await user.type(activation, "/auth/start");

    expect(saveButton().disabled).toBe(false);
    await user.click(saveButton());

    await waitFor(() => expect(h.mutateAsync).toHaveBeenCalledTimes(1));
    const payload = h.mutateAsync.mock.calls[0][0];
    expect(payload.accountActivationPath).toBe("/auth/start");
    expect(payload.itemId).toBe("cfg-1");
    expect(payload.allowedGrantTypes).toEqual(["authorization_code"]);
    expect(h.showSuccessToast).toHaveBeenCalledWith({
      description: "IAM configuration updated successfully",
    });
  });

  it("shows a mapped backend error when the save is rejected", async () => {
    const user = userEvent.setup();
    h.mutateAsync.mockResolvedValue({ isSuccess: false, errors: { general: "bad" } });
    renderForm();

    await user.type(screen.getByPlaceholderText("/auth/activate-account"), "x");
    await user.click(saveButton());

    await waitFor(() =>
      expect(h.showErrorToast).toHaveBeenCalledWith({ errors: { general: "bad" } }),
    );
    expect(h.showSuccessToast).not.toHaveBeenCalled();
  });

  it("shows a generic error when the save throws without structured errors", async () => {
    const user = userEvent.setup();
    h.mutateAsync.mockRejectedValue(new Error("boom"));
    renderForm();

    await user.type(screen.getByPlaceholderText("/auth/activate-account"), "x");
    await user.click(saveButton());

    await waitFor(() =>
      expect(h.showErrorToast).toHaveBeenCalledWith({ errors: "Something went wrong" }),
    );
  });

  it("restores the saved values on Reset", async () => {
    const user = userEvent.setup();
    renderForm();

    const activation = screen.getByPlaceholderText("/auth/activate-account");
    await user.clear(activation);
    await user.type(activation, "/changed");
    expect((activation as HTMLInputElement).value).toBe("/changed");

    await user.click(resetButton());

    expect((screen.getByPlaceholderText("/auth/activate-account") as HTMLInputElement).value).toBe(
      "/auth/activate-account",
    );
    expect(saveButton().disabled).toBe(true);
  });

  it("hides the path fields and makes the base URL read-only once OIDC is enabled", async () => {
    const user = userEvent.setup();
    renderForm();

    expect(screen.queryByPlaceholderText("/auth/verify-identity")).toBeTruthy();

    await user.click(screen.getByRole("switch", { name: "OpenID Connect (OIDC)" }));

    await waitFor(() =>
      expect(screen.queryByPlaceholderText("/auth/verify-identity")).toBeNull(),
    );
    const baseUrlInput = screen.getByPlaceholderText("console.enterprise.cloud");
    expect(baseUrlInput.hasAttribute("readonly")).toBe(true);
  });

  it("persists the OIDC override values in the save payload", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.click(screen.getByRole("switch", { name: "OpenID Connect (OIDC)" }));
    await waitFor(() => expect(saveButton().disabled).toBe(false));
    await user.click(saveButton());

    await waitFor(() => expect(h.mutateAsync).toHaveBeenCalledTimes(1));
    const payload = h.mutateAsync.mock.calls[0][0];
    expect(payload.isOidcEnabled).toBe(true);
    expect(payload.useAccountActionBaseUrlAsDefault).toBe(false);
  });

  it("edits the minutes and security fields", async () => {
    const user = userEvent.setup();
    renderForm();

    const security = screen.getByText("Security").closest("div");
    expect(security).toBeTruthy();
    await user.click(screen.getByRole("switch", { name: "Logout on Password Change" }));

    const regex = screen.getByPlaceholderText(/\^\(\?=/);
    await user.type(regex, "^.+$");
    expect((regex as HTMLInputElement).value).toBe("^.+$");

    await user.click(saveButton());
    await waitFor(() => expect(h.mutateAsync).toHaveBeenCalledTimes(1));
    const payload = h.mutateAsync.mock.calls[0][0];
    expect(payload.logoutOnPasswordChange).toBe(true);
    expect(payload.passwordStrengthCheckerRegex).toBe("^.+$");
  });

  it("offers the activation password toggle only while OIDC is on", async () => {
    const user = userEvent.setup();
    renderForm();

    expect(screen.queryByRole("switch", { name: "Set Password During Activation" })).toBeNull();

    await user.click(screen.getByRole("switch", { name: "OpenID Connect (OIDC)" }));

    await waitFor(() =>
      expect(screen.getByRole("switch", { name: "Set Password During Activation" })).toBeTruthy(),
    );
  });

  it("sends the activation password step turned off", async () => {
    const user = userEvent.setup();
    renderForm({ ...baseConfig, isOidcEnabled: true });

    const toggle = screen.getByRole("switch", { name: "Set Password During Activation" });
    expect(toggle.getAttribute("aria-checked")).toBe("true");

    await user.click(toggle);
    await waitFor(() => expect(saveButton().disabled).toBe(false));
    await user.click(saveButton());

    await waitFor(() => expect(h.mutateAsync).toHaveBeenCalledTimes(1));
    expect(h.mutateAsync.mock.calls[0][0].collectPasswordOnActivation).toBe(false);
  });

  it("disables the action buttons while a save is pending", () => {
    h.isPending = true;
    renderForm();
    expect(saveButton().disabled).toBe(true);
    expect(resetButton().disabled).toBe(true);
  });
});
