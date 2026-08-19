import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DialogTrigger } from "@/components/ui-kits/dialog/dialog";
import type { ICaptchaConfig } from "../../models/captcha";

const h = vi.hoisted(() => ({
  mutateAsync: vi.fn(),
  isPending: false,
  showErrorToast: vi.fn(),
  showSuccessToast: vi.fn(),
}));

vi.mock("../../hooks/use-captcha-config", () => ({
  useSaveCaptcha: () => ({ mutateAsync: h.mutateAsync, isPending: h.isPending }),
}));
vi.mock("@/hooks/use-toast", () => ({
  showErrorToast: h.showErrorToast,
  showSuccessToast: h.showSuccessToast,
}));

import { ConfigureCaptchaModal } from "./configure-captcha-modal";

const renderModal = (props: Partial<React.ComponentProps<typeof ConfigureCaptchaModal>> = {}) =>
  render(
    <ConfigureCaptchaModal {...props}>
      <DialogTrigger asChild>
        <button type="button">Configure Captcha</button>
      </DialogTrigger>
    </ConfigureCaptchaModal>,
  );

const openDialog = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(screen.getByRole("button", { name: "Configure Captcha" }));
};

const selectProvider = async (user: ReturnType<typeof userEvent.setup>, label: string) => {
  await user.click(screen.getAllByRole("combobox")[0]);
  await user.click(await screen.findByRole("option", { name: label }));
};

const fillKeys = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.type(screen.getByPlaceholderText("Enter site key"), "site-key-123");
  await user.type(screen.getByPlaceholderText("Enter secret key"), "secret-key-123");
};

describe("ConfigureCaptchaModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.isPending = false;
    h.mutateAsync.mockResolvedValue({ isEnable: false, provider: "recaptcha" });
  });

  it("creates a new captcha configuration, requiring the secret key", async () => {
    const user = userEvent.setup();
    renderModal();
    await openDialog(user);

    expect(await screen.findByText("Add Captcha Configuration")).toBeTruthy();
    await selectProvider(user, "Google reCAPTCHA");
    await fillKeys(user);

    const save = screen.getByRole("button", { name: "Save" }) as HTMLButtonElement;
    await waitFor(() => expect(save.disabled).toBe(false));
    await user.click(save);

    await waitFor(() => expect(h.mutateAsync).toHaveBeenCalledTimes(1));
    const payload = h.mutateAsync.mock.calls[0][0];
    expect(payload.provider).toBe("recaptcha");
    expect(payload.captchaKey).toBe("site-key-123");
    expect(payload.captchaSecret).toBe("secret-key-123");
    expect(payload.isEnable).toBe(false);
    expect(h.showSuccessToast).toHaveBeenCalledWith({ description: "Captcha added successfully" });
  });

  it("keeps Save disabled until the required keys are provided on create", async () => {
    const user = userEvent.setup();
    renderModal();
    await openDialog(user);
    expect((screen.getByRole("button", { name: "Save" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("edits an existing configuration and preserves its isEnable value", async () => {
    const user = userEvent.setup();
    const configuration = {
      provider: "recaptcha",
      isEnable: true,
      captchaKey: "existing-key",
      captchaGenerator: "EasyCaptchaGenerator",
      secretId: "sec-1",
    } as unknown as ICaptchaConfig;
    renderModal({ configuration });
    await openDialog(user);

    expect(await screen.findByText("Edit Google reCAPTCHA")).toBeTruthy();

    const siteKey = screen.getByPlaceholderText("Enter site key");
    await user.clear(siteKey);
    await user.type(siteKey, "updated-key");
    await user.click(screen.getByRole("button", { name: "Update Changes" }));

    await waitFor(() => expect(h.mutateAsync).toHaveBeenCalledTimes(1));
    const payload = h.mutateAsync.mock.calls[0][0];
    expect(payload.isEnable).toBe(true);
    expect(payload.captchaKey).toBe("updated-key");
    // The secret field was left blank -- it must not be sent at all.
    expect(payload).not.toHaveProperty("captchaSecret");
    expect(h.showSuccessToast).toHaveBeenCalledWith({ description: "Captcha updated successfully" });
  });

  it("allows saving an edit without touching the secret key", async () => {
    const user = userEvent.setup();
    const configuration = {
      provider: "recaptcha",
      isEnable: true,
      captchaKey: "existing-key",
      captchaGenerator: "EasyCaptchaGenerator",
      secretId: "sec-1",
    } as unknown as ICaptchaConfig;
    renderModal({ configuration });
    await openDialog(user);

    const siteKey = screen.getByPlaceholderText("Enter site key");
    await user.type(siteKey, "!");
    const save = screen.getByRole("button", { name: "Update Changes" }) as HTMLButtonElement;
    await waitFor(() => expect(save.disabled).toBe(false));
  });

  it("sends the new secret when one is entered while editing", async () => {
    const user = userEvent.setup();
    const configuration = {
      provider: "recaptcha",
      isEnable: true,
      captchaKey: "existing-key",
      captchaGenerator: "EasyCaptchaGenerator",
      secretId: "sec-1",
    } as unknown as ICaptchaConfig;
    renderModal({ configuration });
    await openDialog(user);

    await user.type(screen.getByPlaceholderText("Leave blank to keep the current secret"), "new-secret");
    await user.click(screen.getByRole("button", { name: "Update Changes" }));

    await waitFor(() => expect(h.mutateAsync).toHaveBeenCalledTimes(1));
    expect(h.mutateAsync.mock.calls[0][0].captchaSecret).toBe("new-secret");
  });

  it("surfaces a backend error when the save is rejected", async () => {
    const user = userEvent.setup();
    h.mutateAsync.mockRejectedValue({ errors: { captchaKey: "invalid" } });
    renderModal();
    await openDialog(user);
    await selectProvider(user, "Google reCAPTCHA");
    await fillKeys(user);
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(h.showErrorToast).toHaveBeenCalledWith({ errors: { captchaKey: "invalid" } }),
    );
  });
});
