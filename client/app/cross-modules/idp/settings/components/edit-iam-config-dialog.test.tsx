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

import { EditIamConfigDialog } from "./edit-iam-config-dialog";

const config: ISettingsAuthConfig = {
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
  allowedGrantTypes: ["authorization_code"],
} as unknown as ISettingsAuthConfig;

const openDialog = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(screen.getByRole("button", { name: "Edit" }));
  return screen.findByRole("heading", { name: "IAM Config" });
};

describe("EditIamConfigDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.isPending = false;
    h.mutateAsync.mockResolvedValue({ isSuccess: true });
  });

  it("opens the dialog seeded with the current config values", async () => {
    const user = userEvent.setup();
    render(<EditIamConfigDialog config={config} />);
    await openDialog(user);

    expect(screen.getByDisplayValue("https://app.example.com")).toBeTruthy();
    expect(screen.getByDisplayValue("/auth/activate-account")).toBeTruthy();
  });

  it("keeps Save disabled until an edit makes the form dirty", async () => {
    const user = userEvent.setup();
    render(<EditIamConfigDialog config={config} />);
    await openDialog(user);

    const save = screen.getByRole("button", { name: "Save" }) as HTMLButtonElement;
    expect(save.disabled).toBe(true);

    await user.type(screen.getByDisplayValue("/auth/recovery"), "-new");
    expect(save.disabled).toBe(false);
  });

  it("saves the edited configuration and reports success", async () => {
    const user = userEvent.setup();
    render(<EditIamConfigDialog config={config} />);
    await openDialog(user);

    const activation = screen.getByDisplayValue("/auth/activate-account");
    await user.clear(activation);
    await user.type(activation, "/auth/go");
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(h.mutateAsync).toHaveBeenCalledTimes(1));
    const payload = h.mutateAsync.mock.calls[0][0];
    expect(payload.accountActivationPath).toBe("/auth/go");
    expect(payload.itemId).toBe("cfg-1");
    expect(h.showSuccessToast).toHaveBeenCalledWith({
      description: "IAM configuration updated successfully",
    });
  });

  it("surfaces a backend error when the save is unsuccessful", async () => {
    const user = userEvent.setup();
    h.mutateAsync.mockResolvedValue({ isSuccess: false, errors: { general: "bad" } });
    render(<EditIamConfigDialog config={config} />);
    await openDialog(user);

    await user.type(screen.getByDisplayValue("/auth/recovery"), "-x");
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(h.showErrorToast).toHaveBeenCalledWith({ errors: { general: "bad" } }),
    );
  });

  it("shows a generic error when the save throws", async () => {
    const user = userEvent.setup();
    h.mutateAsync.mockRejectedValue(new Error("boom"));
    render(<EditIamConfigDialog config={config} />);
    await openDialog(user);

    await user.type(screen.getByDisplayValue("/auth/recovery"), "-x");
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(h.showErrorToast).toHaveBeenCalledWith({ errors: "Something went wrong" }),
    );
  });

  it("toggles the OIDC switch as part of the edit", async () => {
    const user = userEvent.setup();
    render(<EditIamConfigDialog config={config} />);
    await openDialog(user);

    const oidcSwitch = screen.getByRole("switch", { name: "OIDC Enabled" });
    expect(oidcSwitch.getAttribute("aria-checked")).toBe("false");
    await user.click(oidcSwitch);
    expect(oidcSwitch.getAttribute("aria-checked")).toBe("true");

    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(h.mutateAsync).toHaveBeenCalledTimes(1));
    expect(h.mutateAsync.mock.calls[0][0].isOidcEnabled).toBe(true);
  });
});
