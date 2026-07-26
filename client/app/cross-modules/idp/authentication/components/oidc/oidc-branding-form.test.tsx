import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  setActions: vi.fn(),
  useGetAuthOidcCredential: vi.fn(),
  saveOidc: vi.fn(),
  getPresignedUrl: vi.fn(),
  uploadFile: vi.fn(),
  getFileByFileId: vi.fn(),
  showErrorToast: vi.fn(),
  showSuccessToast: vi.fn(),
}));

vi.mock("@seliseblocks/blocks-kit", () => ({
  useProjectStore: () => ({ selectedProject: { tenantId: "t1" } }),
}));
vi.mock("@blocks-idp/authentication/contexts/oidc-branding-header-context", () => ({
  useOidcBrandingHeader: () => ({ setActions: h.setActions }),
}));
vi.mock("@blocks-idp/authentication/hooks/use-auth-oidc", () => ({
  useGetAuthOidcCredential: h.useGetAuthOidcCredential,
  useSaveAuthOidc: () => ({ mutateAsync: h.saveOidc, isPending: false }),
}));
vi.mock("@blocks-storage/hooks/use-storage-file", () => ({
  useGetPreSignedUrlForUpload: () => ({ mutateAsync: h.getPresignedUrl }),
  useUploadFile: () => ({ mutateAsync: h.uploadFile }),
}));
vi.mock("@blocks-storage/services/storage.service", () => ({
  storageService: { file: { getFileByFileId: h.getFileByFileId } },
}));
vi.mock("@/hooks/use-toast", () => ({
  showErrorToast: h.showErrorToast,
  showSuccessToast: h.showSuccessToast,
}));
vi.mock("./oidc-login-preview", () => ({
  OidcLoginPreview: (props: { clientBrandColor: string }) => (
    <div data-testid="preview" data-color={props.clientBrandColor} />
  ),
}));

import { OidcBrandingForm } from "./oidc-branding-form";

const credential = {
  itemId: "c1",
  clientDisplayName: "My App",
  scope: "openid",
  isAutoRedirect: false,
  isActive: true,
  requirePkce: true,
  redirectUris: ["https://app/cb"],
  allowedResponseTypes: ["code"],
  registerAsIdentityProvider: true,
  clientBrandColor: "#abcdef",
  clientLogoUrl: "https://cdn/logo.png",
};

const latestActions = () => {
  const calls = h.setActions.mock.calls.filter((c) => c[0] !== null);
  return calls[calls.length - 1]?.[0] as { onSave: () => Promise<void>; onUndo: () => void };
};

beforeEach(() => {
  vi.clearAllMocks();
  h.useGetAuthOidcCredential.mockReturnValue({ data: { oIDCClientCredential: credential }, isLoading: false });
  globalThis.URL.createObjectURL = vi.fn(() => "blob:preview");
  globalThis.URL.revokeObjectURL = vi.fn();
});

describe("OidcBrandingForm", () => {
  it("shows a loading state", () => {
    h.useGetAuthOidcCredential.mockReturnValue({ data: undefined, isLoading: true });
    render(<OidcBrandingForm clientId="c1" />);
    expect(screen.getByText(/Loading client/)).toBeTruthy();
  });

  it("shows a not-found state when there is no credential", () => {
    h.useGetAuthOidcCredential.mockReturnValue({ data: {}, isLoading: false });
    render(<OidcBrandingForm clientId="c1" />);
    expect(screen.getByText("OIDC client not found.")).toBeTruthy();
  });

  it("renders the branding form seeded from the credential", () => {
    render(<OidcBrandingForm clientId="c1" />);
    expect(screen.getByText("Configuration")).toBeTruthy();
    // both the color picker and the hex text field carry the saved value
    expect(screen.getAllByDisplayValue("#abcdef").length).toBe(2);
  });

  it("updates the brand color and reflects it in the preview", async () => {
    const user = userEvent.setup();
    render(<OidcBrandingForm clientId="c1" />);
    const textColor = screen.getByRole("textbox") as HTMLInputElement;
    await user.clear(textColor);
    await user.type(textColor, "#000000");
    await waitFor(() => expect(screen.getByTestId("preview").getAttribute("data-color")).toBe("#000000"));
  });

  it("rejects an unsupported logo file type", () => {
    render(<OidcBrandingForm clientId="c1" />);
    const fileInput = document.getElementById("client-logo-upload") as HTMLInputElement;
    const bad = new File(["x"], "logo.txt", { type: "text/plain" });
    // fireEvent bypasses the input's accept filter so the component's own validation runs
    Object.defineProperty(fileInput, "files", { value: [bad], configurable: true });
    fireEvent.change(fileInput);
    expect(h.showErrorToast).toHaveBeenCalledWith(
      expect.objectContaining({ errors: expect.stringContaining("allowed") }),
    );
  });

  it("rejects a logo file that is too large", () => {
    render(<OidcBrandingForm clientId="c1" />);
    const fileInput = document.getElementById("client-logo-upload") as HTMLInputElement;
    const big = new File([new Uint8Array(3 * 1024 * 1024)], "logo.png", { type: "image/png" });
    Object.defineProperty(fileInput, "files", { value: [big], configurable: true });
    fireEvent.change(fileInput);
    expect(h.showErrorToast).toHaveBeenCalledWith(
      expect.objectContaining({ errors: expect.stringContaining("smaller") }),
    );
  });

  it("accepts a valid logo file and previews it", async () => {
    const user = userEvent.setup();
    render(<OidcBrandingForm clientId="c1" />);
    const fileInput = document.getElementById("client-logo-upload") as HTMLInputElement;
    const good = new File(["x"], "logo.png", { type: "image/png" });
    await user.upload(fileInput, good);
    expect(globalThis.URL.createObjectURL).toHaveBeenCalled();
  });

  it("registers save/undo actions and saves branding without a new logo", async () => {
    h.saveOidc.mockResolvedValue({ isSuccess: true });
    render(<OidcBrandingForm clientId="c1" />);
    await waitFor(() => expect(latestActions()).toBeTruthy());
    await latestActions().onSave();
    expect(h.saveOidc).toHaveBeenCalledWith(
      expect.objectContaining({ itemId: "c1", clientBrandColor: "#abcdef" }),
    );
    expect(h.showSuccessToast).toHaveBeenCalled();
  });

  it("uploads a pending logo before saving", async () => {
    h.getPresignedUrl.mockResolvedValue({ isSuccess: true, uploadUrl: "u", fileId: "f1" });
    h.uploadFile.mockResolvedValue({});
    h.getFileByFileId.mockResolvedValue({ url: "https://cdn/new.png" });
    h.saveOidc.mockResolvedValue({ isSuccess: true });

    const user = userEvent.setup();
    render(<OidcBrandingForm clientId="c1" />);
    const fileInput = document.getElementById("client-logo-upload") as HTMLInputElement;
    await user.upload(fileInput, new File(["x"], "logo.png", { type: "image/png" }));

    await waitFor(() => expect(latestActions()).toBeTruthy());
    await latestActions().onSave();

    expect(h.getPresignedUrl).toHaveBeenCalled();
    expect(h.uploadFile).toHaveBeenCalled();
    expect(h.saveOidc).toHaveBeenCalledWith(
      expect.objectContaining({ clientLogoUrl: "https://cdn/new.png" }),
    );
  });

  it("surfaces an error toast when the save returns a failure", async () => {
    h.saveOidc.mockResolvedValue({ isSuccess: false, error: "nope" });
    render(<OidcBrandingForm clientId="c1" />);
    await waitFor(() => expect(latestActions()).toBeTruthy());
    await latestActions().onSave();
    expect(h.showErrorToast).toHaveBeenCalledWith({ errors: "nope" });
  });

  it("surfaces an error toast when the save throws", async () => {
    h.saveOidc.mockRejectedValue(new Error("boom"));
    render(<OidcBrandingForm clientId="c1" />);
    await waitFor(() => expect(latestActions()).toBeTruthy());
    await latestActions().onSave();
    expect(h.showErrorToast).toHaveBeenCalledWith({ errors: "Failed to save template" });
  });

  it("undo resets the brand color to the saved value", async () => {
    const user = userEvent.setup();
    render(<OidcBrandingForm clientId="c1" />);
    const textColor = screen.getByRole("textbox") as HTMLInputElement;
    await user.clear(textColor);
    await user.type(textColor, "#111111");
    await waitFor(() => expect(latestActions()).toBeTruthy());
    latestActions().onUndo();
    await waitFor(() => expect(screen.getAllByDisplayValue("#abcdef").length).toBe(2));
  });
});
