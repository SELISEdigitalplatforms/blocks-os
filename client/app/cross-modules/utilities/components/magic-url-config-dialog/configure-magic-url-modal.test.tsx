import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { IMagicUrlConfig } from "@blocks-utilities/models/magic-url-config.model";

const h = vi.hoisted(() => ({
  saveConfig: vi.fn(),
  isSaving: false,
  tenantId: "tenant-1",
  showErrorToast: vi.fn(),
  showSuccessToast: vi.fn(),
}));

vi.mock("@seliseblocks/genesis-os", () => ({
  useProjectStore: () => ({ selectedProject: { tenantId: h.tenantId } }),
}));
vi.mock("@blocks-utilities/hooks/use-magic-url-config", () => ({
  useSaveMagicUrlConfig: () => ({ mutateAsync: h.saveConfig, isPending: h.isSaving }),
}));
vi.mock("@blocks-utilities/utils/url.util", () => ({
  getDefaultShortUrlBase: () => "https://short.seliseblocks.com/",
  isValidUrl: (v: string) => /^https?:\/\//.test(v),
}));
vi.mock("@/hooks/use-toast", () => ({
  showErrorToast: h.showErrorToast,
  showSuccessToast: h.showSuccessToast,
}));
vi.mock("uuid", () => ({ v4: () => "generated-uuid" }));

import { ConfigureMagicUrlModal } from "./configure-magic-url-modal";

const renderModal = (props: Partial<React.ComponentProps<typeof ConfigureMagicUrlModal>> = {}) =>
  render(<ConfigureMagicUrlModal open onOpenChange={vi.fn()} {...props} />);

describe("ConfigureMagicUrlModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.isSaving = false;
    h.tenantId = "tenant-1";
    h.saveConfig.mockResolvedValue({ isSuccess: true });
  });

  it("seeds default values for a new configuration", async () => {
    renderModal();
    expect(screen.getByText("Add Magic URL Configuration")).toBeTruthy();
    await waitFor(() =>
      expect((screen.getByPlaceholderText("Enter context name") as HTMLInputElement).value).toBe(
        "Default",
      ),
    );
    expect(
      (
        screen.getByPlaceholderText("e.g., https://short.seliseblocks.com/") as HTMLInputElement
      ).value,
    ).toBe("https://short.seliseblocks.com/");
  });

  it("prefills the fields from an existing configuration in edit mode", async () => {
    const configuration = {
      itemId: "cfg-1",
      contextName: "Marketing",
      shortUrlBase: "https://go.acme.io/",
    } as IMagicUrlConfig;
    renderModal({ configuration });

    expect(screen.getByText("Edit Magic URL Configuration")).toBeTruthy();
    await waitFor(() => expect(screen.getByDisplayValue("Marketing")).toBeTruthy());
    expect(screen.getByDisplayValue("https://go.acme.io/")).toBeTruthy();
  });

  it("saves a new configuration with trimmed values and a generated id", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    renderModal({ onOpenChange });

    const context = screen.getByPlaceholderText("Enter context name");
    await user.clear(context);
    await user.type(context, "  Promo  ");
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(h.saveConfig).toHaveBeenCalledTimes(1));
    expect(h.saveConfig).toHaveBeenCalledWith({
      projectKey: "tenant-1",
      contextName: "Promo",
      shortUrlBase: "https://short.seliseblocks.com/",
      itemId: "generated-uuid",
    });
    expect(h.showSuccessToast).toHaveBeenCalledWith({
      description: "Configuration added successfully",
    });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("reuses the existing item id and update copy when editing", async () => {
    const user = userEvent.setup();
    const configuration = {
      itemId: "cfg-9",
      contextName: "Marketing",
      shortUrlBase: "https://go.acme.io/",
    } as IMagicUrlConfig;
    renderModal({ configuration });

    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(h.saveConfig).toHaveBeenCalledTimes(1));
    expect(h.saveConfig.mock.calls[0][0].itemId).toBe("cfg-9");
    expect(h.showSuccessToast).toHaveBeenCalledWith({
      description: "Configuration updated successfully",
    });
  });

  it("blocks saving when the context name is empty", async () => {
    const user = userEvent.setup();
    renderModal();

    const context = screen.getByPlaceholderText("Enter context name");
    await user.clear(context);
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText("Context name is required")).toBeTruthy();
    expect(h.saveConfig).not.toHaveBeenCalled();
  });

  it("rejects a short URL base that does not end with a slash", async () => {
    const user = userEvent.setup();
    renderModal();

    const base = screen.getByPlaceholderText("e.g., https://short.seliseblocks.com/");
    await user.clear(base);
    await user.type(base, "https://no-slash.example.com");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(
      await screen.findByText("URL must end with a forward slash (/)"),
    ).toBeTruthy();
    expect(h.saveConfig).not.toHaveBeenCalled();
  });

  it("rejects an invalid short URL base", async () => {
    const user = userEvent.setup();
    renderModal();

    const base = screen.getByPlaceholderText("e.g., https://short.seliseblocks.com/");
    await user.clear(base);
    await user.type(base, "not-a-url");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText("URL must be a valid HTTPS/HTTP URL")).toBeTruthy();
  });

  it("surfaces a backend error when the save is unsuccessful", async () => {
    const user = userEvent.setup();
    h.saveConfig.mockResolvedValue({ isSuccess: false, errors: { contextName: "taken" } });
    renderModal();

    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() =>
      expect(h.showErrorToast).toHaveBeenCalledWith({ errors: { contextName: "taken" } }),
    );
  });

  it("shows a generic error when the save throws", async () => {
    const user = userEvent.setup();
    h.saveConfig.mockRejectedValue(new Error("network"));
    renderModal();

    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() =>
      expect(h.showErrorToast).toHaveBeenCalledWith({ errors: "Failed to save configuration" }),
    );
  });

  it("does nothing when there is no active tenant", async () => {
    const user = userEvent.setup();
    h.tenantId = "";
    renderModal();

    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(h.saveConfig).not.toHaveBeenCalled();
  });
});
