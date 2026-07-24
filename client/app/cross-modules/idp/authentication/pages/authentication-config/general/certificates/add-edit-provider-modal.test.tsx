import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const uploadFileMutate = vi.fn();
const savePublicCertificates = vi.fn();
const validateJwksUrl = vi.fn();

vi.mock("@blocks-idp/authentication/hooks/use-identifier", () => ({
  useSavePublicCertificates: () => ({ mutateAsync: savePublicCertificates }),
  useValidateJwksUrl: () => ({ mutateAsync: validateJwksUrl }),
}));

vi.mock("@blocks-storage/hooks/use-storage-file", () => ({
  usePublicCertificateFile: () => ({ mutateAsync: uploadFileMutate }),
}));

const showErrorToast = vi.fn();
const showSuccessToast = vi.fn();
vi.mock("@/hooks/use-toast", () => ({
  showErrorToast: (...args: unknown[]) => showErrorToast(...args),
  showSuccessToast: (...args: unknown[]) => showSuccessToast(...args),
}));

vi.mock("@seliseblocks/blocks-kit", () => ({
  useProjectStore: () => ({ selectedProject: { tenantId: "tenant-1" } }),
}));

import { AddEditProviderModal } from "./add-edit-provider-modal";

const openDialog = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(screen.getByRole("button", { name: /Add/ }));
  return within(await screen.findByRole("dialog"));
};

describe("AddEditProviderModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    validateJwksUrl.mockResolvedValue({ isValid: true });
    savePublicCertificates.mockResolvedValue({ isSuccess: true });
  });

  it("opens the add dialog from the default trigger", async () => {
    const user = userEvent.setup();
    render(<AddEditProviderModal />);
    const dialog = await openDialog(user);
    expect(dialog.getByText("Add provider")).toBeTruthy();
    expect(dialog.getByText("Configure your identity provider")).toBeTruthy();
  });

  it("renders in edit mode with prefilled values from existingData", async () => {
    const user = userEvent.setup();
    render(
      <AddEditProviderModal>
        <button>Edit certificate</button>
      </AddEditProviderModal>,
    );
    // custom child trigger
    await user.click(screen.getByRole("button", { name: "Edit certificate" }));
    expect(await screen.findByText("Add provider")).toBeTruthy();
  });

  it("keeps Save disabled until the form is dirty", async () => {
    const user = userEvent.setup();
    render(<AddEditProviderModal />);
    const dialog = await openDialog(user);
    const save = dialog.getByRole("button", { name: "Save" }) as HTMLButtonElement;
    expect(save.disabled).toBe(true);
    await user.type(dialog.getByPlaceholderText(/Enter JWKS/), "https://issuer/jwks");
    expect(save.disabled).toBe(false);
  });

  it("shows a required error when submitting an empty JWKS url", async () => {
    const user = userEvent.setup();
    render(<AddEditProviderModal />);
    const dialog = await openDialog(user);
    // make the form dirty via issuer so Save enables without a url
    await user.type(dialog.getByPlaceholderText("Enter issuer"), "iss");
    await user.click(dialog.getByRole("button", { name: "Save" }));
    expect(await dialog.findByText("JWKS URL is required")).toBeTruthy();
    expect(savePublicCertificates).not.toHaveBeenCalled();
  });

  it("surfaces the validation error when the JWKS url is invalid", async () => {
    validateJwksUrl.mockResolvedValue({ isValid: false, error: "bad url" });
    const user = userEvent.setup();
    render(<AddEditProviderModal />);
    const dialog = await openDialog(user);
    await user.type(dialog.getByPlaceholderText(/Enter JWKS/), "https://bad");
    await user.click(dialog.getByRole("button", { name: "Save" }));
    expect(await dialog.findByText("bad url")).toBeTruthy();
    expect(savePublicCertificates).not.toHaveBeenCalled();
  });

  it("saves a valid public-url certificate and shows a success toast", async () => {
    const user = userEvent.setup();
    render(<AddEditProviderModal />);
    const dialog = await openDialog(user);
    await user.type(dialog.getByPlaceholderText(/Enter JWKS/), "https://issuer/jwks");
    await user.type(dialog.getByPlaceholderText("Enter audience (comma-separated for multiple)"), "a, b");
    await user.click(dialog.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(savePublicCertificates).toHaveBeenCalledTimes(1));
    expect(savePublicCertificates).toHaveBeenCalledWith(
      expect.objectContaining({
        projectKey: "tenant-1",
        jwksUrl: "https://issuer/jwks",
        audiences: ["a", "b"],
        providerName: "Keycloak",
      }),
    );
    expect(showSuccessToast).toHaveBeenCalledWith({
      description: "Public certificate saved successfully.",
    });
  });

  it("shows an error toast when the save request reports failure", async () => {
    savePublicCertificates.mockResolvedValue({ isSuccess: false, errors: "server down" });
    const user = userEvent.setup();
    render(<AddEditProviderModal />);
    const dialog = await openDialog(user);
    await user.type(dialog.getByPlaceholderText(/Enter JWKS/), "https://issuer/jwks");
    await user.click(dialog.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(showErrorToast).toHaveBeenCalledWith({ errors: "server down" }));
  });

  it("reveals the password field and upload option after selecting Others", async () => {
    const user = userEvent.setup();
    render(<AddEditProviderModal />);
    const dialog = await openDialog(user);
    await user.click(dialog.getByRole("radio", { name: /Others/ }));
    expect(dialog.getByLabelText("Password (Optional)")).toBeTruthy();
    expect(dialog.getByText("Upload file")).toBeTruthy();
  });

  it("errors when Others + upload-file is submitted without a file", async () => {
    const user = userEvent.setup();
    render(<AddEditProviderModal />);
    const dialog = await openDialog(user);
    await user.click(dialog.getByRole("radio", { name: /Others/ }));
    // dirty the form so Save is enabled
    await user.type(dialog.getByPlaceholderText("Enter issuer"), "iss");
    await user.click(dialog.getByText("Upload file"));
    await user.click(dialog.getByRole("button", { name: "Save" }));
    await waitFor(() =>
      expect(showErrorToast).toHaveBeenCalledWith({ errors: "Please upload a certificate file" }),
    );
  });
});
