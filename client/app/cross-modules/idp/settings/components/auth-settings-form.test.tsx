import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

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
  showErrorToast: (...a: unknown[]) => h.showErrorToast(...a),
  showSuccessToast: (...a: unknown[]) => h.showSuccessToast(...a),
}));
// The tab-actions component reads a provider context and portals the buttons;
// replace it with a passthrough so the Reset/Save controls render inline.
vi.mock("@blocks-idp/settings/components/settings-tab-actions", () => ({
  SettingsTabActions: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SettingsFormTabButtons: ({
    onReset,
    onSave,
    resetDisabled,
    saveDisabled,
  }: {
    onReset: () => void;
    onSave: () => void;
    resetDisabled?: boolean;
    saveDisabled?: boolean;
  }) => (
    <>
      <button type="button" onClick={onReset} disabled={resetDisabled}>
        Reset
      </button>
      <button type="button" onClick={onSave} disabled={saveDisabled}>
        Save
      </button>
    </>
  ),
}));
vi.mock(
  "@blocks-idp/authentication/pages/authentication-config/general/settings/url-with-actions",
  () => ({ UrlWithActions: ({ url }: { url: string }) => <div data-testid="url">{url}</div> }),
);

import { AuthSettingsForm } from "./auth-settings-form";
import type { ISettingsAuthConfig } from "@blocks-idp/settings/models/settings.model";

const config = {
  accessTokenValidForNumberMinutes: 15,
  refreshTokenValidForNumberMinutes: 60,
  absoluteRefreshTokenValidForNumberMinutes: 120,
  rememberMeRefreshTokenValidForNumberMinutes: 240,
  getNumberOfWrongAttemptsToLockTheAccount: 5,
  accountLockDurationInMinutes: 30,
  publicCertificatePath: "https://certs/pub",
} as unknown as ISettingsAuthConfig;

describe("AuthSettingsForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.isPending = false;
    h.mutateAsync.mockResolvedValue({ isSuccess: true });
  });

  it("renders the token, lockout and infrastructure sections", () => {
    render(<AuthSettingsForm config={config} />);
    expect(screen.getByText("Token Configurations")).toBeTruthy();
    expect(screen.getByText("Access Token Validity")).toBeTruthy();
    expect(screen.getByText("Maximum Failed Login Attempts")).toBeTruthy();
    expect(screen.getByTestId("url").textContent).toBe("https://certs/pub");
  });

  it("keeps Save disabled until the form is dirtied", () => {
    render(<AuthSettingsForm config={config} />);
    expect((screen.getByRole("button", { name: "Save" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(screen.getAllByRole("spinbutton")[0], { target: { value: "20" } });
    expect((screen.getByRole("button", { name: "Save" }) as HTMLButtonElement).disabled).toBe(false);
  });

  it("saves the form and shows a success toast", async () => {
    render(<AuthSettingsForm config={config} />);
    fireEvent.change(screen.getAllByRole("spinbutton")[0], { target: { value: "25" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(h.mutateAsync).toHaveBeenCalled());
    expect(h.showSuccessToast).toHaveBeenCalled();
  });

  it("shows an error toast when the save response is unsuccessful", async () => {
    h.mutateAsync.mockResolvedValueOnce({ isSuccess: false, errors: { general: "bad" } });
    render(<AuthSettingsForm config={config} />);
    fireEvent.change(screen.getAllByRole("spinbutton")[0], { target: { value: "25" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(h.showErrorToast).toHaveBeenCalled());
    expect(h.showSuccessToast).not.toHaveBeenCalled();
  });

  it("surfaces thrown errors through the error toast", async () => {
    h.mutateAsync.mockRejectedValueOnce({ errors: { general: "boom" } });
    render(<AuthSettingsForm config={config} />);
    fireEvent.change(screen.getAllByRole("spinbutton")[0], { target: { value: "25" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(h.showErrorToast).toHaveBeenCalled());
  });

  it("resets the dirtied values back to the config", () => {
    render(<AuthSettingsForm config={config} />);
    const first = screen.getAllByRole("spinbutton")[0] as HTMLInputElement;
    fireEvent.change(first, { target: { value: "99" } });
    expect(first.value).toBe("99");
    fireEvent.click(screen.getByRole("button", { name: "Reset" }));
    expect(first.value).toBe("15");
  });
});
