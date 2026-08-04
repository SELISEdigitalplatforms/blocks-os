import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DialogTrigger } from "@/components/ui-kits/dialog/dialog";
import type { ICaptchaConfig } from "../../models/captcha";

const h = vi.hoisted(() => ({
  getConfigs: vi.fn(),
  mutateAsync: vi.fn(),
  isPending: false,
  showErrorToast: vi.fn(),
  showSuccessToast: vi.fn(),
}));

vi.mock("@seliseblocks/genesis-os", () => ({
  useProjectStore: () => ({ selectedProject: { tenantId: "tenant-1" } }),
}));
vi.mock("../../hooks/use-captcha-config", () => ({
  useGetCaptchaConfigs: () => h.getConfigs(),
  useSaveCaptcha: () => ({ mutateAsync: h.mutateAsync, isPending: h.isPending }),
}));
vi.mock("@/hooks/use-toast", () => ({
  showErrorToast: h.showErrorToast,
  showSuccessToast: h.showSuccessToast,
}));
vi.mock("uuid", () => ({ v4: () => "generated-uuid" }));

import { ConfigureCaptchaModal } from "./configure-captcha-modal";

const renderModal = (props: Partial<React.ComponentProps<typeof ConfigureCaptchaModal>> = {}) =>
  render(
    <ConfigureCaptchaModal {...props}>
      <DialogTrigger asChild>
        <button type="button">Add Configuration</button>
      </DialogTrigger>
    </ConfigureCaptchaModal>,
  );

const openDialog = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(screen.getByRole("button", { name: "Add Configuration" }));
};

// Opening the modal resets the form (clearing the auto-picked provider), so the
// provider must be chosen explicitly before the form can become valid.
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
    h.getConfigs.mockReturnValue({ isLoading: false, isFetching: false, data: { configurations: [] } });
    h.mutateAsync.mockResolvedValue({ isSuccess: true });
  });

  it("adds a new captcha configuration with the first unconfigured provider", async () => {
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
    expect(payload.itemId).toBe("generated-uuid");
    expect(payload.isEnable).toBe(false);
    expect(payload.projectKey).toBe("tenant-1");
    expect(h.showSuccessToast).toHaveBeenCalledWith({ description: "Captcha added successfully" });
  });

  it("only offers the unconfigured provider when one is already configured", async () => {
    const user = userEvent.setup();
    h.getConfigs.mockReturnValue({
      isLoading: false,
      isFetching: false,
      data: { configurations: [{ provider: "recaptcha" }] },
    });
    renderModal();
    await openDialog(user);

    await user.click(screen.getAllByRole("combobox")[0]);
    expect(await screen.findByRole("option", { name: "hCAPTCHA" })).toBeTruthy();
    expect(screen.queryByRole("option", { name: "Google reCAPTCHA" })).toBeNull();
    await user.click(screen.getByRole("option", { name: "hCAPTCHA" }));

    await fillKeys(user);
    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(h.mutateAsync).toHaveBeenCalledTimes(1));
    expect(h.mutateAsync.mock.calls[0][0].provider).toBe("hcaptcha");
  });

  it("renders the edit heading and reuses the existing item id", async () => {
    const user = userEvent.setup();
    const configuration = {
      itemId: "captcha-9",
      provider: "recaptcha",
      isEnable: true,
      captchaKey: "existing-key",
      captchaSecret: "existing-secret",
      captchaGenerator: "EasyCaptchaGenerator",
    } as unknown as ICaptchaConfig;
    renderModal({ configuration });
    await openDialog(user);

    expect(await screen.findByText("Edit Google reCAPTCHA")).toBeTruthy();

    const siteKey = screen.getByPlaceholderText("Enter site key");
    await user.clear(siteKey);
    await user.type(siteKey, "updated-key");
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(h.mutateAsync).toHaveBeenCalledTimes(1));
    const payload = h.mutateAsync.mock.calls[0][0];
    expect(payload.itemId).toBe("captcha-9");
    expect(payload.isEnable).toBe(true);
    expect(h.showSuccessToast).toHaveBeenCalledWith({ description: "Captcha updated successfully" });
  });

  it("keeps Save disabled until the required keys are provided", async () => {
    const user = userEvent.setup();
    renderModal();
    await openDialog(user);
    expect((screen.getByRole("button", { name: "Save" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("surfaces a backend error when the save is unsuccessful", async () => {
    const user = userEvent.setup();
    h.mutateAsync.mockResolvedValue({ isSuccess: false, errors: { captchaKey: "invalid" } });
    renderModal();
    await openDialog(user);
    await selectProvider(user, "Google reCAPTCHA");
    await fillKeys(user);
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(h.showErrorToast).toHaveBeenCalledWith({ errors: { captchaKey: "invalid" } }),
    );
  });

  it("maps structured errors from a thrown save", async () => {
    const user = userEvent.setup();
    h.mutateAsync.mockRejectedValue({ errors: { captchaSecret: "bad" } });
    renderModal();
    await openDialog(user);
    await selectProvider(user, "Google reCAPTCHA");
    await fillKeys(user);
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(h.showErrorToast).toHaveBeenCalledWith({ errors: { captchaSecret: "bad" } }),
    );
  });
});
