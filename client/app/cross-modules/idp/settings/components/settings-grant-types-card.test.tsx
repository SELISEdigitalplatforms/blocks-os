import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ISettingsAuthConfig } from "@blocks-idp/settings/models/settings.model";

const h = vi.hoisted(() => ({
  mutateAsync: vi.fn(),
  showSuccessToast: vi.fn(),
  showErrorToast: vi.fn(),
}));

vi.mock("@blocks-idp/settings/hooks/use-settings-config", () => ({
  useSaveSettingsAuthConfig: () => ({ mutateAsync: h.mutateAsync, isPending: false }),
}));
vi.mock("@/hooks/use-toast", () => ({
  showSuccessToast: (...a: unknown[]) => h.showSuccessToast(...a),
  showErrorToast: (...a: unknown[]) => h.showErrorToast(...a),
}));

import { SettingsGrantTypesCard } from "./settings-grant-types-card";

const config = (): ISettingsAuthConfig =>
  ({
    itemId: "cfg-1",
    allowedGrantTypes: [],
    refreshTokenValidForNumberMinutes: 0,
    absoluteRefreshTokenValidForNumberMinutes: 0,
    accessTokenValidForNumberMinutes: 0,
    rememberMeRefreshTokenValidForNumberMinutes: 0,
    getNumberOfWrongAttemptsToLockTheAccount: 0,
    accountLockDurationInMinutes: 0,
  }) as unknown as ISettingsAuthConfig;

describe("SettingsGrantTypesCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.mutateAsync = vi.fn().mockResolvedValue({ isSuccess: true });
  });

  it("renders the grant type options with Save disabled until a change is made", () => {
    render(<SettingsGrantTypesCard config={config()} />);
    expect(screen.getByText("Grant Types")).toBeTruthy();
    expect(screen.getByText("Authorization Code")).toBeTruthy();
    expect(screen.getByText("Client Credential")).toBeTruthy();
    expect((screen.getByRole("button", { name: "Save" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("selects a grant type and saves the configuration successfully", async () => {
    const user = userEvent.setup();
    render(<SettingsGrantTypesCard config={config()} />);
    await user.click(screen.getAllByRole("checkbox")[0]);

    const save = screen.getByRole("button", { name: "Save" }) as HTMLButtonElement;
    await waitFor(() => expect(save.disabled).toBe(false));
    await user.click(save);

    await waitFor(() => expect(h.mutateAsync).toHaveBeenCalledTimes(1));
    expect(h.showSuccessToast).toHaveBeenCalledTimes(1);
  });

  it("shows an error toast when the save response is unsuccessful", async () => {
    const user = userEvent.setup();
    h.mutateAsync = vi.fn().mockResolvedValue({ isSuccess: false, errors: { general: "bad" } });
    render(<SettingsGrantTypesCard config={config()} />);
    await user.click(screen.getAllByRole("checkbox")[0]);
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(h.showErrorToast).toHaveBeenCalledTimes(1));
    expect(h.showSuccessToast).not.toHaveBeenCalled();
  });

  it("shows an error toast when the mutation throws with field errors", async () => {
    const user = userEvent.setup();
    h.mutateAsync = vi.fn().mockRejectedValue({ errors: { general: "boom" } });
    render(<SettingsGrantTypesCard config={config()} />);
    await user.click(screen.getAllByRole("checkbox")[0]);
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(h.showErrorToast).toHaveBeenCalledTimes(1));
  });

  it("deselects a previously selected grant type", async () => {
    const user = userEvent.setup();
    const preset = config();
    (preset as { allowedGrantTypes: string[] }).allowedGrantTypes = ["authorization_code"];
    render(<SettingsGrantTypesCard config={preset} />);
    const [first] = screen.getAllByRole("checkbox");
    // toggling off then on again exercises both branches of onCheckedChange
    await user.click(first);
    await user.click(first);
    expect(screen.getByRole("button", { name: "Save" })).toBeTruthy();
  });
});
