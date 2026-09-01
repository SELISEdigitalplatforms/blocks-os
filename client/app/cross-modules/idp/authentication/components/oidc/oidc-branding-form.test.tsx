import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  setActions: vi.fn(),
  useGetOidcTemplate: vi.fn(),
  saveTemplate: vi.fn(),
  getPresignedUrl: vi.fn(),
  uploadFile: vi.fn(),
  getFileByFileId: vi.fn(),
  showErrorToast: vi.fn(),
  showSuccessToast: vi.fn(),
}));

vi.mock("@seliseblocks/genesis-os", () => ({
  useProjectStore: () => ({ selectedProject: { tenantId: "t1" } }),
}));
vi.mock("@blocks-idp/authentication/contexts/oidc-branding-header-context", () => ({
  useOidcBrandingHeader: () => ({ setActions: h.setActions }),
}));
vi.mock("@blocks-idp/authentication/hooks/use-oidc-template", () => ({
  useGetOidcTemplate: h.useGetOidcTemplate,
  useSaveOidcTemplate: () => ({ mutateAsync: h.saveTemplate, isPending: false }),
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
  OidcLoginPreview: (props: { clientBrandColor: string; clientLogoUrl: string | null }) => (
    <div
      data-testid="preview"
      data-color={props.clientBrandColor}
      data-logo={props.clientLogoUrl}
    />
  ),
}));

import { OidcBrandingForm } from "./oidc-branding-form";

const template = {
  branding: { logoUrl: null, brandName: "Blocks IAM" },
  theme: {
    primary: "#0066b2",
    secondary: "#00b2ff",
    background: "#050510",
    surface: "#0a0a1a",
    text: "#e8e8f0",
    mutedText: "#5e5e7a",
    success: "#17a34a",
    danger: "#f87171",
    border: "#16162a",
    borderStrong: "rgba(0, 102, 178, 0.35)",
    accentSoft: "rgba(0, 102, 178, 0.10)",
  },
  pages: {
    login: { heading: "Sign in", emailLabel: "Email", passwordLabel: "Password" },
    signup: { heading: "Create account" },
    forgotPassword: { heading: "Reset password" },
    resetPassword: { heading: "Set a new password" },
    activation: { heading: "Activate" },
    mfa: { heading: "Verify" },
    accountSelector: { heading: "Blocks IAM" },
    shared: { footerText: "Copyright" },
  },
};

const latestActions = () => {
  const calls = h.setActions.mock.calls.filter((call) => call[0] !== null);
  return calls[calls.length - 1]?.[0] as {
    onSave: () => Promise<void>;
    onUndo: () => void;
    isBusy: boolean;
    isDirty: boolean;
    isValid: boolean;
  };
};

const renderForm = async () => {
  render(<OidcBrandingForm />);
  await waitFor(() => expect(screen.getByDisplayValue("Blocks IAM")).toBeTruthy());
  await waitFor(() => expect(latestActions()).toBeTruthy());
};

beforeEach(() => {
  vi.clearAllMocks();
  h.useGetOidcTemplate.mockReturnValue({ data: template, isLoading: false, isError: false });
  h.saveTemplate.mockResolvedValue({ isSuccess: true, itemId: "template-1" });
  globalThis.URL.createObjectURL = vi.fn(() => "blob:preview");
  globalThis.URL.revokeObjectURL = vi.fn();
});

describe("OidcBrandingForm", () => {
  it("shows the existing loading skeleton while the tenant template loads", () => {
    h.useGetOidcTemplate.mockReturnValue({ data: undefined, isLoading: true, isError: false });
    const { container } = render(<OidcBrandingForm />);
    expect(container.querySelectorAll('[class*="animate-pulse"]').length).toBeGreaterThan(0);
  });

  it("renders compiled-in defaults as a usable first-load template", async () => {
    await renderForm();
    expect(screen.getByDisplayValue("Blocks IAM")).toBeTruthy();
    expect(screen.getByLabelText("Brand color hex value")).toHaveProperty("value", "#0066b2");
    expect(screen.queryByText("OIDC client not found.")).toBeNull();
    expect(latestActions().isDirty).toBe(false);
    expect(latestActions().isValid).toBe(true);
  });

  it("shows an unavailable state when the template GET fails", () => {
    h.useGetOidcTemplate.mockReturnValue({ data: undefined, isLoading: false, isError: true });
    render(<OidcBrandingForm />);
    expect(screen.getByRole("alert").textContent).toContain("Unable to load the OIDC template");
    expect(screen.queryByText("Configuration")).toBeNull();
  });

  it("updates the primary color in the unchanged login preview", async () => {
    const user = userEvent.setup();
    await renderForm();
    const color = screen.getByLabelText("Brand color hex value");
    await user.clear(color);
    await user.type(color, "#ff0000");
    expect(screen.getByTestId("preview").getAttribute("data-color")).toBe("#ff0000");
  });

  it("overlays only the exposed fields and sends the complete template", async () => {
    const user = userEvent.setup();
    await renderForm();

    const brandName = screen.getByLabelText(/Brand name/);
    await user.clear(brandName);
    await user.type(brandName, "Acme Corp");
    const color = screen.getByLabelText("Brand color hex value");
    await user.clear(color);
    await user.type(color, "#FF0000");
    await latestActions().onSave();

    expect(h.saveTemplate).toHaveBeenCalledTimes(1);
    const payload = h.saveTemplate.mock.calls[0][0];
    expect(payload.branding).toEqual({ brandName: "Acme Corp", logoUrl: null });
    expect(payload.theme).toEqual({ ...template.theme, primary: "#FF0000" });
    expect(payload.pages).toBe(template.pages);
    expect(h.showSuccessToast).toHaveBeenCalledWith({
      description: "Template saved successfully",
    });
    await waitFor(() => expect(latestActions().isDirty).toBe(false));
  });

  it("uploads a pending logo and saves its absolute storage URL", async () => {
    h.getPresignedUrl.mockResolvedValue({ isSuccess: true, uploadUrl: "u", fileId: "f1" });
    h.uploadFile.mockResolvedValue({});
    h.getFileByFileId.mockResolvedValue({ url: "https://cdn.example.com/new.png" });
    const user = userEvent.setup();
    await renderForm();

    await user.upload(
      document.getElementById("client-logo-upload") as HTMLInputElement,
      new File(["x"], "logo.png", { type: "image/png" }),
    );
    await latestActions().onSave();

    expect(h.getPresignedUrl).toHaveBeenCalled();
    expect(h.uploadFile).toHaveBeenCalled();
    expect(h.saveTemplate.mock.calls[0][0].branding.logoUrl).toBe(
      "https://cdn.example.com/new.png",
    );
  });

  it("removes an existing logo and saves null", async () => {
    h.useGetOidcTemplate.mockReturnValue({
      data: { ...template, branding: { ...template.branding, logoUrl: "https://cdn/logo.png" } },
      isLoading: false,
      isError: false,
    });
    const user = userEvent.setup();
    render(<OidcBrandingForm />);
    await user.click(await screen.findByRole("button", { name: "Remove logo" }));
    await waitFor(() => expect(latestActions().isDirty).toBe(true));
    await latestActions().onSave();
    expect(h.saveTemplate.mock.calls[0][0].branding.logoUrl).toBeNull();
    expect(screen.getByTestId("preview").getAttribute("data-logo")).toBeNull();
  });

  it("rejects unsupported and oversized logo files before upload", async () => {
    await renderForm();
    const fileInput = document.getElementById("client-logo-upload") as HTMLInputElement;

    Object.defineProperty(fileInput, "files", {
      value: [new File(["x"], "logo.txt", { type: "text/plain" })],
      configurable: true,
    });
    fireEvent.change(fileInput);
    expect(h.showErrorToast).toHaveBeenCalledWith({
      errors: "Only PNG, JPG, SVG, and WebP images are allowed",
    });

    Object.defineProperty(fileInput, "files", {
      value: [new File([new Uint8Array(3 * 1024 * 1024)], "logo.png", { type: "image/png" })],
      configurable: true,
    });
    fireEvent.change(fileInput);
    expect(h.showErrorToast).toHaveBeenCalledWith({ errors: "Logo must be smaller than 2MB" });
    expect(h.getPresignedUrl).not.toHaveBeenCalled();
  });

  it("blocks save and shows an inline error for a missing or overlong brand name", async () => {
    const user = userEvent.setup();
    await renderForm();
    const brandName = screen.getByLabelText(/Brand name/);

    await user.clear(brandName);
    expect(screen.getByText("Brand name is required.")).toBeTruthy();
    expect(latestActions().isValid).toBe(false);
    await latestActions().onSave();
    expect(h.saveTemplate).not.toHaveBeenCalled();

    await user.type(brandName, "a".repeat(81));
    expect(screen.getByText("Brand name must be 80 characters or fewer.")).toBeTruthy();
    expect(latestActions().isValid).toBe(false);
  });

  it("blocks save and shows an inline error for an invalid primary color", async () => {
    const user = userEvent.setup();
    await renderForm();
    const color = screen.getByLabelText("Brand color hex value");
    await user.clear(color);
    await user.type(color, "not-a");
    expect(screen.getByText(/valid hex value/)).toBeTruthy();
    expect(latestActions().isValid).toBe(false);
    await latestActions().onSave();
    expect(h.saveTemplate).not.toHaveBeenCalled();
  });

  it("accepts both three- and six-digit hex colors", async () => {
    const user = userEvent.setup();
    await renderForm();
    const color = screen.getByLabelText("Brand color hex value");
    await user.clear(color);
    await user.type(color, "#abc");
    expect(screen.queryByText(/valid hex value/)).toBeNull();
    expect(latestActions().isValid).toBe(true);
  });

  it("blocks save and shows an inline error for a non-absolute template logo URL", async () => {
    h.useGetOidcTemplate.mockReturnValue({
      data: { ...template, branding: { ...template.branding, logoUrl: "/relative/logo.png" } },
      isLoading: false,
      isError: false,
    });
    render(<OidcBrandingForm />);
    expect(await screen.findByText("Logo URL must be an absolute http or https URL.")).toBeTruthy();
    await waitFor(() => expect(latestActions().isValid).toBe(false));
    await latestActions().onSave();
    expect(h.saveTemplate).not.toHaveBeenCalled();
  });

  it("surfaces field-level PUT errors without treating the values as saved", async () => {
    h.saveTemplate.mockResolvedValue({
      isSuccess: false,
      errors: { "Branding.BrandName": "must be unique", "Theme.Primary": "server color error" },
    });
    const user = userEvent.setup();
    await renderForm();
    await user.type(screen.getByLabelText(/Brand name/), " updated");
    await act(async () => latestActions().onSave());

    expect(await screen.findByText("must be unique")).toBeTruthy();
    expect(await screen.findByText("server color error")).toBeTruthy();
    expect(h.showSuccessToast).not.toHaveBeenCalled();
    expect(h.showErrorToast).toHaveBeenCalled();
    expect(latestActions().isDirty).toBe(true);
  });

  it("undo restores every exposed field to the latest successful save", async () => {
    const user = userEvent.setup();
    await renderForm();
    const brandName = screen.getByLabelText(/Brand name/);
    await user.clear(brandName);
    await user.type(brandName, "Acme Corp");
    await latestActions().onSave();
    await waitFor(() => expect(latestActions().isDirty).toBe(false));

    await user.clear(brandName);
    await user.type(brandName, "Unsaved");
    await waitFor(() => expect(latestActions().isDirty).toBe(true));
    latestActions().onUndo();
    expect(await screen.findByDisplayValue("Acme Corp")).toBeTruthy();
    await waitFor(() => expect(latestActions().isDirty).toBe(false));
  });

  it("shows a generic save error when PUT throws unexpectedly", async () => {
    h.saveTemplate.mockRejectedValue(new Error("network"));
    const user = userEvent.setup();
    await renderForm();
    await user.type(screen.getByLabelText(/Brand name/), " updated");
    await latestActions().onSave();
    expect(h.showErrorToast).toHaveBeenCalledWith({ errors: "Failed to save template" });
    expect(h.showSuccessToast).not.toHaveBeenCalled();
  });
});
