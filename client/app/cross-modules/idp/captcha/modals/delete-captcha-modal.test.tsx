import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  mutateAsync: vi.fn(),
  isPending: false,
  showErrorToast: vi.fn(),
  showSuccessToast: vi.fn(),
}));

vi.mock("../hooks/use-captcha-config", () => ({
  useDeleteCaptcha: () => ({ mutateAsync: h.mutateAsync, isPending: h.isPending }),
}));
vi.mock("@/hooks/use-toast", () => ({
  showErrorToast: (...a: unknown[]) => h.showErrorToast(...a),
  showSuccessToast: (...a: unknown[]) => h.showSuccessToast(...a),
}));

import { DeleteCaptchaModal } from "./delete-captcha-modal";
import type { ICaptchaConfig } from "../models/captcha";

const config = {
  id: "cfg-1",
  provider: "recaptcha",
  isEnable: true,
  captchaKey: "key",
  captchaGenerator: "EasyCaptchaGenerator",
  secretId: "sec-1",
} as unknown as ICaptchaConfig;

describe("DeleteCaptchaModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.isPending = false;
    h.mutateAsync.mockResolvedValue(undefined);
  });

  it("shows a Delete trigger", () => {
    render(<DeleteCaptchaModal configuration={config} />);
    expect(screen.getByRole("button", { name: /Delete/ })).toBeTruthy();
  });

  it("opens the confirmation and deletes the configuration by id on confirm", async () => {
    render(<DeleteCaptchaModal configuration={config} />);
    fireEvent.click(screen.getByRole("button", { name: /Delete/ }));
    expect(await screen.findByText("Delete CAPTCHA configuration?")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Yes, delete" }));
    await waitFor(() => expect(h.mutateAsync).toHaveBeenCalledWith("cfg-1"));
    expect(h.showSuccessToast).toHaveBeenCalled();
  });

  it("shows an error toast when the delete is rejected", async () => {
    h.mutateAsync.mockRejectedValueOnce({ errors: { general: "x" } });
    render(<DeleteCaptchaModal configuration={config} />);
    fireEvent.click(screen.getByRole("button", { name: /Delete/ }));
    fireEvent.click(await screen.findByRole("button", { name: "Yes, delete" }));
    await waitFor(() => expect(h.showErrorToast).toHaveBeenCalledWith({ errors: { general: "x" } }));
  });
});
