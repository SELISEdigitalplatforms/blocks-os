import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  mutateAsync: vi.fn(),
  isPending: false,
  showErrorToast: vi.fn(),
  showSuccessToast: vi.fn(),
}));

vi.mock("../hooks/use-captcha-config", () => ({
  useToggleCaptchaConfigStatus: () => ({ mutateAsync: h.mutateAsync, isPending: h.isPending }),
}));
vi.mock("@/hooks/use-toast", () => ({
  showErrorToast: (...a: unknown[]) => h.showErrorToast(...a),
  showSuccessToast: (...a: unknown[]) => h.showSuccessToast(...a),
}));

import { ToggleCaptchaStatusModal } from "./toggle-captcha-status-modal";
import type { ICaptchaConfig } from "../models/captcha";

const config = {
  itemId: "c1",
  provider: "recaptcha",
  isEnable: true,
  captchaKey: "key",
  captchaSecret: "secret",
  captchaGenerator: "EasyCaptchaGenerator",
} as unknown as ICaptchaConfig;

describe("ToggleCaptchaStatusModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.isPending = false;
    h.mutateAsync.mockResolvedValue({ isSuccess: true });
  });

  it("shows a Disable trigger for an enabled config", () => {
    render(<ToggleCaptchaStatusModal configuration={config} />);
    expect(screen.getByRole("button", { name: /Disable/ })).toBeTruthy();
  });

  it("opens the confirmation and toggles the status on confirm", async () => {
    render(<ToggleCaptchaStatusModal configuration={config} />);
    fireEvent.click(screen.getByRole("button", { name: /Disable/ }));
    expect(await screen.findByText("Disable CAPTCHA?")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Yes" }));
    await waitFor(() =>
      expect(h.mutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({ itemId: "c1", isEnable: false }),
      ),
    );
    expect(h.showSuccessToast).toHaveBeenCalled();
  });

  it("shows an Enable trigger for a disabled config", () => {
    render(<ToggleCaptchaStatusModal configuration={{ ...config, isEnable: false }} />);
    expect(screen.getByRole("button", { name: /Enable/ })).toBeTruthy();
  });

  it("shows an error toast when the toggle fails", async () => {
    h.mutateAsync.mockResolvedValueOnce({ isSuccess: false, errors: { general: "x" } });
    render(<ToggleCaptchaStatusModal configuration={config} />);
    fireEvent.click(screen.getByRole("button", { name: /Disable/ }));
    fireEvent.click(await screen.findByRole("button", { name: "Yes" }));
    await waitFor(() => expect(h.showErrorToast).toHaveBeenCalled());
  });
});
