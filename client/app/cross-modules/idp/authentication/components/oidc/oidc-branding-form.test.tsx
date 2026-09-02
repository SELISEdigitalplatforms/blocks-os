import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NuqsTestingAdapter, type OnUrlUpdateFunction } from "nuqs/adapters/testing";
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
vi.mock("./oidc-template-preview", () => ({
  OidcTemplatePreview: (props: {
    template: {
      branding: { brandName: string; logoUrl: string | null };
      theme: { light: { primary: string }; dark: { primary: string } };
      pages: Record<string, Record<string, string | null>>;
    };
    selectedPage: string;
    previewMode: string;
    showAuto: boolean;
    onPreviewModeChange: (mode: "light" | "dark" | "system") => void;
  }) => (
    <div
      data-testid="preview"
      data-page={props.selectedPage}
      data-mode={props.previewMode}
      data-show-auto={props.showAuto}
      data-light-primary={props.template.theme.light.primary}
      data-dark-primary={props.template.theme.dark.primary}
      data-logo={props.template.branding.logoUrl}
    >
      <span>{props.template.branding.brandName}</span>
      <span>{props.template.pages[props.selectedPage].heading}</span>
      <span data-testid="preview-template">{JSON.stringify(props.template)}</span>
      <button type="button" onClick={() => props.onPreviewModeChange("light")}>
        Preview Light
      </button>
      <button type="button" onClick={() => props.onPreviewModeChange("dark")}>
        Preview Dark
      </button>
      <button type="button" onClick={() => props.onPreviewModeChange("system")}>
        Preview Auto
      </button>
    </div>
  ),
}));

import { OidcBrandingForm } from "./oidc-branding-form";
import { DEFAULT_OIDC_UI_TEMPLATE } from "./oidc-template-defaults";

type HeaderActions = {
  onSave: () => Promise<void>;
  onUndo: () => void;
  isBusy: boolean;
  isDirty: boolean;
  isValid: boolean;
};

const latestActions = () => {
  const calls = h.setActions.mock.calls.filter((call) => call[0] !== null);
  return calls.at(-1)?.[0] as HeaderActions;
};

const renderOidcForm = (searchParams = "", onUrlUpdate?: OnUrlUpdateFunction) =>
  render(
    <NuqsTestingAdapter hasMemory searchParams={searchParams} onUrlUpdate={onUrlUpdate}>
      <OidcBrandingForm />
    </NuqsTestingAdapter>,
  );

const renderForm = async (searchParams = "", onUrlUpdate?: OnUrlUpdateFunction) => {
  renderOidcForm(searchParams, onUrlUpdate);
  await screen.findByText("Template studio");
  await waitFor(() => expect(latestActions()).toBeTruthy());
};

beforeEach(() => {
  vi.clearAllMocks();
  h.useGetOidcTemplate.mockReturnValue({
    data: structuredClone(DEFAULT_OIDC_UI_TEMPLATE),
    isLoading: false,
    isError: false,
  });
  h.saveTemplate.mockResolvedValue({ isSuccess: true, itemId: "template-1" });
  globalThis.URL.createObjectURL = vi.fn(() => "blob:preview");
  globalThis.URL.revokeObjectURL = vi.fn();
});

describe("OidcBrandingForm", () => {
  it("preserves the loading and GET-unavailable states", () => {
    h.useGetOidcTemplate.mockReturnValue({ data: undefined, isLoading: true, isError: false });
    const { container, unmount } = renderOidcForm();
    expect(container.querySelectorAll('[class*="animate-pulse"]').length).toBeGreaterThan(0);

    unmount();
    h.useGetOidcTemplate.mockReturnValue({ data: undefined, isLoading: false, isError: true });
    renderOidcForm();
    expect(screen.getByRole("alert").textContent).toContain("Unable to load the OIDC template");
  });

  it("shows Branding, Theme, and Pages with Branding selected initially", async () => {
    await renderForm();
    expect(screen.getByRole("tab", { name: "Branding" }).getAttribute("aria-selected")).toBe(
      "true",
    );
    expect(screen.getByRole("tab", { name: "Theme" })).toBeTruthy();
    expect(screen.getByRole("tab", { name: "Pages" })).toBeTruthy();
    expect(latestActions().isDirty).toBe(false);
    expect(latestActions().isValid).toBe(true);
  });

  it("restores the editor context from the URL and persists subsequent tab choices", async () => {
    const onUrlUpdate = vi.fn<OnUrlUpdateFunction>();
    const user = userEvent.setup();
    await renderForm("?section=theme&palette=dark&preview=dark&page=signup", onUrlUpdate);

    expect(screen.getByRole("tab", { name: "Theme" }).getAttribute("aria-selected")).toBe("true");
    expect(screen.getByRole("tab", { name: "Dark" }).getAttribute("aria-selected")).toBe("true");
    expect(screen.getByLabelText("Dark Primary")).toBeTruthy();

    await user.click(screen.getByRole("tab", { name: "Pages" }));
    expect(screen.getByRole("tab", { name: "Signup" }).getAttribute("aria-selected")).toBe("true");
    await user.click(screen.getByRole("tab", { name: "Account Selector" }));

    await waitFor(() => expect(onUrlUpdate).toHaveBeenCalled());
    const latestUpdate = onUrlUpdate.mock.calls.at(-1)?.[0];
    expect(latestUpdate?.searchParams.get("section")).toBe("pages");
    expect(latestUpdate?.searchParams.get("page")).toBe("accountSelector");
  });

  it("shows the compiled-in constants when GET succeeds with a null template", async () => {
    h.useGetOidcTemplate.mockReturnValue({ data: null, isLoading: false, isError: false });
    const user = userEvent.setup();
    await renderForm();

    expect(screen.getByLabelText(/Brand name/)).toHaveProperty(
      "value",
      DEFAULT_OIDC_UI_TEMPLATE.branding.brandName,
    );
    await user.click(screen.getByRole("tab", { name: "Theme" }));
    expect(screen.getByLabelText("Light Primary")).toHaveProperty(
      "value",
      DEFAULT_OIDC_UI_TEMPLATE.theme.light.primary,
    );
    await user.click(screen.getByRole("tab", { name: "Pages" }));
    expect(screen.getByLabelText(/Heading/)).toHaveProperty(
      "value",
      DEFAULT_OIDC_UI_TEMPLATE.pages.login.heading,
    );
    expect(latestActions().isDirty).toBe(false);
    expect(latestActions().isValid).toBe(true);
  });

  it("falls back only for genuinely absent fields", async () => {
    const partial = structuredClone(DEFAULT_OIDC_UI_TEMPLATE) as unknown as Record<
      string,
      Record<string, unknown>
    >;
    delete (partial.theme.light as Record<string, unknown>).secondary;
    delete (
      (partial.pages as Record<string, Record<string, unknown>>).signup as Record<string, unknown>
    ).submitButton;
    h.useGetOidcTemplate.mockReturnValue({ data: partial, isLoading: false, isError: false });
    const user = userEvent.setup();
    await renderForm();

    await user.click(screen.getByRole("tab", { name: "Theme" }));
    expect(screen.getByLabelText("Light Secondary")).toHaveProperty(
      "value",
      DEFAULT_OIDC_UI_TEMPLATE.theme.light.secondary,
    );
    await user.click(screen.getByRole("tab", { name: "Pages" }));
    await user.click(screen.getByRole("tab", { name: "Signup" }));
    expect(screen.getByTestId("preview").getAttribute("data-page")).toBe("signup");
    expect(screen.getByLabelText(/Submit button/)).toHaveProperty(
      "value",
      DEFAULT_OIDC_UI_TEMPLATE.pages.signup.submitButton,
    );
  });

  it("lists all seven pages, shows only the selected page fields, and always shows Footer", async () => {
    const user = userEvent.setup();
    await renderForm();
    await user.click(screen.getByRole("tab", { name: "Pages" }));

    for (const name of [
      "Login",
      "Signup",
      "Forgot Password",
      "Reset Password",
      "Activation",
      "MFA",
      "Account Selector",
    ]) {
      expect(screen.getByRole("tab", { name })).toBeTruthy();
    }
    expect(screen.getByLabelText(/Activation error title/)).toBeTruthy();
    expect(screen.queryByLabelText(/First name label/)).toBeNull();
    expect(screen.getByLabelText(/Footer/)).toBeTruthy();

    await user.click(screen.getByRole("tab", { name: "Signup" }));
    expect(screen.getByLabelText(/First name label/)).toBeTruthy();
    expect(screen.queryByLabelText(/Activation error title/)).toBeNull();
    expect(screen.getByLabelText(/Footer/)).toBeTruthy();
    expect(screen.getByTestId("preview").getAttribute("data-page")).toBe("signup");
  });

  it("updates page previews live and retains unsaved copy while switching pages", async () => {
    const user = userEvent.setup();
    await renderForm();
    await user.click(screen.getByRole("tab", { name: "Pages" }));
    const heading = screen.getByLabelText(/Heading/);
    await user.clear(heading);
    await user.type(heading, "Unsaved login heading");
    expect(screen.getByText("Unsaved login heading")).toBeTruthy();

    await user.click(screen.getByRole("tab", { name: "Signup" }));
    await user.click(screen.getByRole("tab", { name: "Login" }));
    expect(screen.getByLabelText(/Heading/)).toHaveProperty("value", "Unsaved login heading");
  });

  it("keeps the Theme sub-switcher and preview mode synchronized in both directions", async () => {
    const user = userEvent.setup();
    await renderForm();
    await user.click(screen.getByRole("tab", { name: "Theme" }));
    expect(screen.getByTestId("preview").getAttribute("data-mode")).toBe("light");
    expect(screen.getByTestId("preview").getAttribute("data-show-auto")).toBe("false");

    await user.click(screen.getByRole("tab", { name: "Dark" }));
    expect(screen.getByLabelText("Dark Primary")).toBeTruthy();
    expect(screen.getByTestId("preview").getAttribute("data-mode")).toBe("dark");

    await user.click(screen.getByRole("button", { name: "Preview Light" }));
    expect(screen.getByLabelText("Light Primary")).toBeTruthy();
    expect(screen.getByTestId("preview").getAttribute("data-mode")).toBe("light");
  });

  it("keeps palette edits independent and retains them across palette switches", async () => {
    const user = userEvent.setup();
    await renderForm();
    await user.click(screen.getByRole("tab", { name: "Theme" }));
    await user.click(screen.getByRole("tab", { name: "Dark" }));
    const darkDanger = screen.getByLabelText("Dark Danger");
    await user.clear(darkDanger);
    await user.type(darkDanger, "#123456");
    expect(screen.getByTestId("preview-template").textContent).toContain('"danger":"#123456"');

    await user.click(screen.getByRole("tab", { name: "Light" }));
    expect(screen.getByLabelText("Light Danger")).toHaveProperty(
      "value",
      DEFAULT_OIDC_UI_TEMPLATE.theme.light.danger,
    );
    await user.click(screen.getByRole("tab", { name: "Dark" }));
    expect(screen.getByLabelText("Dark Danger")).toHaveProperty("value", "#123456");
  });

  it("sends one complete current template and establishes a new saved baseline", async () => {
    const user = userEvent.setup();
    await renderForm();
    await user.clear(screen.getByLabelText(/Brand name/));
    await user.type(screen.getByLabelText(/Brand name/), "Acme Corp");

    await user.click(screen.getByRole("tab", { name: "Theme" }));
    await user.click(screen.getByRole("tab", { name: "Dark" }));
    await user.clear(screen.getByLabelText("Dark Primary"));
    await user.type(screen.getByLabelText("Dark Primary"), "#112233");

    await user.click(screen.getByRole("tab", { name: "Pages" }));
    await user.click(screen.getByRole("tab", { name: "Signup" }));
    await user.clear(screen.getByLabelText(/Heading/));
    await user.type(screen.getByLabelText(/Heading/), "Join Acme");
    fireEvent.change(screen.getByLabelText(/Footer/), { target: { value: "Acme {year}" } });

    await act(async () => latestActions().onSave());

    expect(h.saveTemplate).toHaveBeenCalledTimes(1);
    const payload = h.saveTemplate.mock.calls[0][0];
    expect(payload).toEqual({
      ...DEFAULT_OIDC_UI_TEMPLATE,
      branding: { brandName: "Acme Corp", logoUrl: null },
      theme: {
        light: DEFAULT_OIDC_UI_TEMPLATE.theme.light,
        dark: { ...DEFAULT_OIDC_UI_TEMPLATE.theme.dark, primary: "#112233" },
      },
      pages: {
        ...DEFAULT_OIDC_UI_TEMPLATE.pages,
        signup: { ...DEFAULT_OIDC_UI_TEMPLATE.pages.signup, heading: "Join Acme" },
        shared: { footerText: "Acme {year}" },
      },
    });
    expect(Object.keys(payload.theme.light)).toHaveLength(11);
    expect(Object.keys(payload.theme.dark)).toHaveLength(11);
    expect(Object.keys(payload.pages)).toHaveLength(8);
    expect(h.showSuccessToast).toHaveBeenCalledWith({
      description: "Template saved successfully",
    });
    await waitFor(() => expect(latestActions().isDirty).toBe(false));
  });

  it("blocks Save with exact inline errors for required page copy and palette colors", async () => {
    const user = userEvent.setup();
    await renderForm();
    await user.click(screen.getByRole("tab", { name: "Theme" }));
    await user.click(screen.getByRole("tab", { name: "Dark" }));
    await user.clear(screen.getByLabelText("Dark Border"));
    expect(
      screen.getByText(
        "Dark Border must be a valid hex color (#RGB or #RRGGBB) or rgba(r,g,b,a) color",
      ),
    ).toBeTruthy();
    expect(latestActions().isValid).toBe(false);
    await act(async () => latestActions().onSave());
    expect(h.saveTemplate).not.toHaveBeenCalled();

    await user.type(screen.getByLabelText("Dark Border"), "#123");
    await user.click(screen.getByRole("tab", { name: "Pages" }));
    await user.clear(screen.getByLabelText(/Heading/));
    expect(screen.getByText("Heading must be between 1 and 200 characters")).toBeTruthy();
    expect(latestActions().isValid).toBe(false);
  });

  it("saves cleared optional page fields as null", async () => {
    const user = userEvent.setup();
    await renderForm();
    await user.click(screen.getByRole("tab", { name: "Pages" }));
    await user.click(screen.getByRole("tab", { name: "MFA" }));
    await user.clear(screen.getByLabelText("Resend button"));
    await user.click(screen.getByRole("tab", { name: "Account Selector" }));
    await user.clear(screen.getByLabelText("Subheading"));

    await act(async () => latestActions().onSave());
    const payload = h.saveTemplate.mock.calls[0][0];
    expect(payload.pages.mfa.resendButton).toBeNull();
    expect(payload.pages.accountSelector.subheading).toBeNull();
  });

  it("shows server field errors beside inputs without accepting the failed save", async () => {
    h.saveTemplate.mockResolvedValue({
      isSuccess: false,
      errors: {
        "Branding.BrandName": "server brand error",
        "Theme.Dark.Primary": "server dark error",
        "Pages.Signup.Heading": "server signup error",
      },
    });
    const user = userEvent.setup();
    await renderForm();
    await user.type(screen.getByLabelText(/Brand name/), " updated");
    await act(async () => latestActions().onSave());

    expect(screen.getByText("Brand name server brand error")).toBeTruthy();
    expect(h.showSuccessToast).not.toHaveBeenCalled();
    expect(latestActions().isDirty).toBe(true);

    await user.click(screen.getByRole("tab", { name: "Theme" }));
    await user.click(screen.getByRole("tab", { name: "Dark" }));
    expect(screen.getByText("Dark Primary server dark error")).toBeTruthy();
    await user.click(screen.getByRole("tab", { name: "Pages" }));
    await user.click(screen.getByRole("tab", { name: "Signup" }));
    expect(screen.getByText("Heading server signup error")).toBeTruthy();
  });

  it("Undo restores unsaved changes across Branding, Theme, and Pages", async () => {
    const user = userEvent.setup();
    await renderForm();
    await user.type(screen.getByLabelText(/Brand name/), " changed");
    await user.click(screen.getByRole("tab", { name: "Theme" }));
    await user.click(screen.getByRole("tab", { name: "Dark" }));
    await user.clear(screen.getByLabelText("Dark Primary"));
    await user.type(screen.getByLabelText("Dark Primary"), "#abcdef");
    await user.click(screen.getByRole("tab", { name: "Pages" }));
    await user.click(screen.getByRole("tab", { name: "Signup" }));
    await user.clear(screen.getByLabelText(/Heading/));
    await user.type(screen.getByLabelText(/Heading/), "Unsaved signup");
    expect(latestActions().isDirty).toBe(true);

    act(() => latestActions().onUndo());
    expect(screen.getByLabelText(/Heading/)).toHaveProperty(
      "value",
      DEFAULT_OIDC_UI_TEMPLATE.pages.signup.heading,
    );
    await user.click(screen.getByRole("tab", { name: "Theme" }));
    expect(screen.getByLabelText("Dark Primary")).toHaveProperty(
      "value",
      DEFAULT_OIDC_UI_TEMPLATE.theme.dark.primary,
    );
    await user.click(screen.getByRole("tab", { name: "Branding" }));
    expect(screen.getByLabelText(/Brand name/)).toHaveProperty(
      "value",
      DEFAULT_OIDC_UI_TEMPLATE.branding.brandName,
    );
    expect(latestActions().isDirty).toBe(false);
  });

  it("uploads a pending logo and saves the resolved absolute URL", async () => {
    h.getPresignedUrl.mockResolvedValue({ isSuccess: true, uploadUrl: "u", fileId: "f1" });
    h.uploadFile.mockResolvedValue({});
    h.getFileByFileId.mockResolvedValue({ url: "https://cdn.example.com/new.png" });
    const user = userEvent.setup();
    await renderForm();

    await user.upload(
      document.getElementById("client-logo-upload") as HTMLInputElement,
      new File(["x"], "logo.png", { type: "image/png" }),
    );
    expect(screen.getByTestId("preview").getAttribute("data-logo")).toBe("blob:preview");
    await act(async () => latestActions().onSave());
    expect(h.uploadFile).toHaveBeenCalled();
    expect(h.saveTemplate.mock.calls[0][0].branding.logoUrl).toBe(
      "https://cdn.example.com/new.png",
    );
  });

  it("removes a saved logo as null and rejects invalid files before upload", async () => {
    const withLogo = structuredClone(DEFAULT_OIDC_UI_TEMPLATE);
    withLogo.branding.logoUrl = "https://cdn.example.com/old.png";
    h.useGetOidcTemplate.mockReturnValue({ data: withLogo, isLoading: false, isError: false });
    const user = userEvent.setup();
    await renderForm();
    await user.click(screen.getByRole("button", { name: "Remove logo" }));
    await act(async () => latestActions().onSave());
    expect(h.saveTemplate.mock.calls[0][0].branding.logoUrl).toBeNull();

    const input = document.getElementById("client-logo-upload") as HTMLInputElement;
    Object.defineProperty(input, "files", {
      value: [new File(["x"], "logo.txt", { type: "text/plain" })],
      configurable: true,
    });
    fireEvent.change(input);
    expect(h.showErrorToast).toHaveBeenCalledWith({
      errors: "Only PNG, JPG, SVG, and WebP images are allowed",
    });

    Object.defineProperty(input, "files", {
      value: [new File([new Uint8Array(3 * 1024 * 1024)], "logo.png", { type: "image/png" })],
      configurable: true,
    });
    fireEvent.change(input);
    expect(h.showErrorToast).toHaveBeenCalledWith({ errors: "Logo must be smaller than 2MB" });
  });

  it("keeps the current draft and shows a generic error when PUT throws", async () => {
    h.saveTemplate.mockRejectedValue(new Error("network"));
    const user = userEvent.setup();
    await renderForm();
    await user.type(screen.getByLabelText(/Brand name/), " updated");
    await act(async () => latestActions().onSave());
    expect(h.showErrorToast).toHaveBeenCalledWith({ errors: "Failed to save template" });
    expect(h.showSuccessToast).not.toHaveBeenCalled();
    expect(latestActions().isDirty).toBe(true);
  });
});
