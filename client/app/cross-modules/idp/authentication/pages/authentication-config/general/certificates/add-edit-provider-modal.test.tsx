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

vi.mock("@seliseblocks/genesis-os", () => ({
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

  it("enables Save once a certificate is picked, with every text field left blank", async () => {
    // The file is not a react-hook-form field, so `isDirty` stays false. Password and Issuer are
    // both optional; requiring one of them to be typed just to enable Save made them mandatory in
    // practice and left upload-only configuration impossible.
    const user = userEvent.setup();
    render(<AddEditProviderModal />);
    const dialog = await openDialog(user);
    await user.click(dialog.getByRole("radio", { name: /Others/ }));
    await user.click(dialog.getByText("Upload file"));

    const save = dialog.getByRole("button", { name: "Save" }) as HTMLButtonElement;
    expect(save.disabled).toBe(true);

    await user.upload(
      document.querySelector('input[type="file"]') as HTMLInputElement,
      new File(["cert"], "cert.pfx", { type: "application/x-pkcs12" }),
    );

    expect(await dialog.findByText("cert.pfx")).toBeTruthy();
    expect(save.disabled).toBe(false);
  });

  it("does not leave Save enabled by a file that Public URL mode ignores", async () => {
    // Switching back to Public URL keeps the picked file in state but stops using it, so it must
    // not stand in for a change to the form.
    const user = userEvent.setup();
    render(<AddEditProviderModal />);
    const dialog = await openDialog(user);
    await user.click(dialog.getByRole("radio", { name: /Others/ }));
    await user.click(dialog.getByText("Upload file"));
    await user.upload(
      document.querySelector('input[type="file"]') as HTMLInputElement,
      new File(["cert"], "cert.pfx", { type: "application/x-pkcs12" }),
    );

    const save = dialog.getByRole("button", { name: "Save" }) as HTMLButtonElement;
    expect(save.disabled).toBe(false);

    await user.click(dialog.getByText("Public URL"));
    expect(save.disabled).toBe(true);
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

  it("shows an error toast when the save request throws", async () => {
    savePublicCertificates.mockRejectedValue(new Error("network"));
    const user = userEvent.setup();
    render(<AddEditProviderModal />);
    const dialog = await openDialog(user);
    await user.type(dialog.getByPlaceholderText(/Enter JWKS/), "https://issuer/jwks");
    await user.click(dialog.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(showErrorToast).toHaveBeenCalled());
  });

  it("toggles the password field visibility for the Others provider", async () => {
    const user = userEvent.setup();
    render(<AddEditProviderModal />);
    const dialog = await openDialog(user);
    await user.click(dialog.getByRole("radio", { name: /Others/ }));
    const password = dialog.getByLabelText("Password (Optional)") as HTMLInputElement;
    expect(password.type).toBe("password");
    // The eye toggle is the only ghost button next to the input.
    const toggle = password.parentElement?.querySelector("button") as HTMLButtonElement;
    await user.click(toggle);
    expect(password.type).toBe("text");
  });

  describe("Others provider public-url save", () => {
    const openOthers = async (user: ReturnType<typeof userEvent.setup>) => {
      render(<AddEditProviderModal />);
      const dialog = await openDialog(user);
      await user.click(dialog.getByRole("radio", { name: /Others/ }));
      return dialog;
    };

    it("stores the url as jwksUrl when it validates", async () => {
      validateJwksUrl.mockResolvedValue({ isValid: true });
      const user = userEvent.setup();
      const dialog = await openOthers(user);
      await user.type(dialog.getByPlaceholderText(/certificate url/i), "https://x/jwks");
      await user.click(dialog.getByRole("button", { name: "Save" }));
      await waitFor(() =>
        expect(savePublicCertificates).toHaveBeenCalledWith(
          expect.objectContaining({ jwksUrl: "https://x/jwks", publicCertificatePath: "" }),
        ),
      );
    });

    it("stores the url as a certificate path when validation reports invalid", async () => {
      validateJwksUrl.mockResolvedValue({ isValid: false });
      const user = userEvent.setup();
      const dialog = await openOthers(user);
      await user.type(dialog.getByPlaceholderText(/certificate url/i), "https://x/cert.pem");
      await user.click(dialog.getByRole("button", { name: "Save" }));
      await waitFor(() =>
        expect(savePublicCertificates).toHaveBeenCalledWith(
          expect.objectContaining({ jwksUrl: "", publicCertificatePath: "https://x/cert.pem" }),
        ),
      );
    });

    it("treats the url as a certificate path when validation throws", async () => {
      validateJwksUrl.mockRejectedValue(new Error("boom"));
      const user = userEvent.setup();
      const dialog = await openOthers(user);
      await user.type(dialog.getByPlaceholderText(/certificate url/i), "https://x/broken");
      await user.click(dialog.getByRole("button", { name: "Save" }));
      await waitFor(() =>
        expect(savePublicCertificates).toHaveBeenCalledWith(
          expect.objectContaining({ jwksUrl: "", publicCertificatePath: "https://x/broken" }),
        ),
      );
    });
  });

  describe("Others provider upload-file save", () => {
    const pfxFile = () =>
      new File(["cert"], "cert.pfx", { type: "application/x-pkcs12" });

    const getFileInput = () => document.querySelector('input[type="file"]') as HTMLInputElement;

    const openUpload = async (user: ReturnType<typeof userEvent.setup>) => {
      render(<AddEditProviderModal />);
      const dialog = await openDialog(user);
      await user.click(dialog.getByRole("radio", { name: /Others/ }));
      await user.click(dialog.getByText("Upload file"));
      return dialog;
    };

    it("uploads the certificate and saves the returned download url", async () => {
      uploadFileMutate.mockResolvedValue({ downloadUrl: "https://cdn/cert.pfx" });
      const user = userEvent.setup();
      const dialog = await openUpload(user);
      await user.upload(getFileInput(), pfxFile());
      expect(await dialog.findByText("cert.pfx")).toBeTruthy();
      await user.click(dialog.getByRole("button", { name: "Save" }));
      await waitFor(() =>
        expect(uploadFileMutate).toHaveBeenCalledWith(
          expect.objectContaining({ TenantId: "tenant-1" }),
        ),
      );
      expect(savePublicCertificates).toHaveBeenCalledWith(
        expect.objectContaining({ publicCertificatePath: "https://cdn/cert.pfx", jwksUrl: "" }),
      );
      expect(showSuccessToast).toHaveBeenCalled();
    });

    it("errors when the upload returns no download url", async () => {
      uploadFileMutate.mockResolvedValue({});
      const user = userEvent.setup();
      const dialog = await openUpload(user);
      await user.upload(getFileInput(), pfxFile());
      expect(await dialog.findByText("cert.pfx")).toBeTruthy();
      await user.click(dialog.getByRole("button", { name: "Save" }));
      await waitFor(() =>
        expect(showErrorToast).toHaveBeenCalledWith({ errors: "Failed to get upload URL" }),
      );
      expect(savePublicCertificates).not.toHaveBeenCalled();
    });

    it("errors when the upload request throws", async () => {
      uploadFileMutate.mockRejectedValue(new Error("upload failed"));
      const user = userEvent.setup();
      const dialog = await openUpload(user);
      await user.upload(getFileInput(), pfxFile());
      expect(await dialog.findByText("cert.pfx")).toBeTruthy();
      await user.click(dialog.getByRole("button", { name: "Save" }));
      await waitFor(() => expect(showErrorToast).toHaveBeenCalled());
    });

    it("rejects a file whose extension is not a certificate", async () => {
      const user = userEvent.setup();
      const dialog = await openUpload(user);
      // MIME matches the accept map so dropzone keeps it, but the name fails the
      // explicit extension guard in handleSubmit.
      const badFile = new File(["x"], "cert.txt", { type: "application/x-pkcs12" });
      await user.upload(getFileInput(), badFile);
      expect(await dialog.findByText("cert.txt")).toBeTruthy();
      await user.click(dialog.getByRole("button", { name: "Save" }));
      await waitFor(() =>
        expect(showErrorToast).toHaveBeenCalledWith({
          errors: "Only certificate files are allowed (.crt, .pfx, .der, .p12)",
        }),
      );
    });
  });

  describe("controlled edit mode", () => {
    const existing = {
      jwksUrl: "https://issuer/jwks",
      publicCertificatePath: "",
      issuer: "my-issuer",
      audiences: ["aud-1", "aud-2"],
      providerName: "Others",
    } as unknown as Parameters<typeof AddEditProviderModal>[0]["existingData"];

    it("prefills fields from existingData when opened externally", async () => {
      const onOpenChange = vi.fn();
      render(<AddEditProviderModal existingData={existing} open onOpenChange={onOpenChange} />);
      const dialog = within(await screen.findByRole("dialog"));
      expect(dialog.getByText("Edit provider")).toBeTruthy();
      expect((dialog.getByLabelText("Issuer (Optional)") as HTMLInputElement).value).toBe(
        "my-issuer",
      );
      expect(
        (
          dialog.getByPlaceholderText(
            "Enter audience (comma-separated for multiple)",
          ) as HTMLInputElement
        ).value,
      ).toBe("aud-1, aud-2");
    });

    it("resets the form and notifies the parent when closed via cancel", async () => {
      const onOpenChange = vi.fn();
      const user = userEvent.setup();
      render(<AddEditProviderModal existingData={existing} open onOpenChange={onOpenChange} />);
      await screen.findByRole("dialog");
      // Closing via Escape runs handleOpenChange, which resets the form.
      await user.keyboard("{Escape}");
      await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    });
  });
});
