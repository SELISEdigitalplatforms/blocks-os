import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Dialog } from "@/components/ui-kits/dialog/dialog";

const h = vi.hoisted(() => ({
  saveTemplate: vi.fn(),
  toast: vi.fn(),
  showErrorToast: vi.fn(),
  configs: { isLoading: false, data: [{ itemId: "cfg-1", name: "Primary" }] },
  languages: { isLoading: false, data: [{ languageCode: "en", languageName: "English" }] },
}));

vi.mock("@/hooks/use-toast", () => ({
  toast: (...a: unknown[]) => h.toast(...a),
  showErrorToast: (...a: unknown[]) => h.showErrorToast(...a),
}));
vi.mock("@blocks-communication/mail/hooks/use-email-config", () => ({
  useGetEmailConfigs: () => h.configs,
}));
vi.mock("@blocks-localization/hooks/use-language-manager", () => ({
  useGetLanguages: () => h.languages,
}));
vi.mock("../../../../hooks/use-email-template", () => ({
  useSaveMailTemplate: () => ({ isPending: false, mutateAsync: h.saveTemplate }),
}));

import EditCommunication from "./edit-communication";

const templateData = {
  itemId: "t1",
  mailConfigurationId: "cfg-1",
  language: "en",
  name: "Welcome",
  templateSubject: "Hi there",
  generatedBy: "System",
} as never;

const renderModal = (onClose = vi.fn(), data = templateData) => {
  render(
    <Dialog open>
      <EditCommunication dialogTitle="Edit template" templateData={data} onClose={onClose} />
    </Dialog>,
  );
  return onClose;
};

describe("EditCommunication", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.configs = { isLoading: false, data: [{ itemId: "cfg-1", name: "Primary" }] };
    h.languages = { isLoading: false, data: [{ languageCode: "en", languageName: "English" }] };
  });

  it("renders the form prefilled with the template data", () => {
    renderModal();
    expect(screen.getByText("Edit template")).toBeTruthy();
    expect((screen.getByPlaceholderText("Enter subject") as HTMLInputElement).value).toBe(
      "Hi there",
    );
    expect((screen.getByPlaceholderText("Enter Template name") as HTMLInputElement).value).toBe(
      "Welcome",
    );
  });

  it("does not render the form while configs are loading", () => {
    h.configs = { isLoading: true, data: [] as never };
    renderModal();
    expect(screen.queryByPlaceholderText("Enter subject")).toBeNull();
  });

  it("saves and shows a success toast", async () => {
    h.saveTemplate.mockResolvedValue({ isSuccess: true });
    const onClose = renderModal();
    await userEvent.setup().click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() =>
      expect(h.saveTemplate).toHaveBeenCalledWith(expect.objectContaining({ itemId: "t1" })),
    );
    expect(h.toast).toHaveBeenCalledWith(expect.objectContaining({ variant: "success" }));
    expect(onClose).toHaveBeenCalled();
  });

  it("shows an error toast when the save reports failure", async () => {
    h.saveTemplate.mockResolvedValue({ isSuccess: false, errors: { general: "bad" } });
    renderModal();
    await userEvent.setup().click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() =>
      expect(h.showErrorToast).toHaveBeenCalledWith({ errors: { general: "bad" } }),
    );
  });

  it("surfaces structured errors thrown during save", async () => {
    h.saveTemplate.mockRejectedValue({ errors: { name: "taken" } });
    renderModal();
    await userEvent.setup().click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() =>
      expect(h.showErrorToast).toHaveBeenCalledWith({ errors: { name: "taken" } }),
    );
  });

  it("falls back to a generic message for unstructured throws", async () => {
    h.saveTemplate.mockRejectedValue(new Error("network"));
    renderModal();
    await userEvent.setup().click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() =>
      expect(h.showErrorToast).toHaveBeenCalledWith({ errors: "Something went wrong" }),
    );
  });

  it("disables the template name field for tenant-generated templates", () => {
    renderModal(vi.fn(), { ...templateData, generatedBy: "Tenant" } as never);
    expect((screen.getByPlaceholderText("Enter Template name") as HTMLInputElement).disabled).toBe(
      true,
    );
  });
});
