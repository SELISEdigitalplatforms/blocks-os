import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  existing: undefined as unknown,
  mutateAsync: vi.fn(),
  showErrorToast: vi.fn(),
  showSuccessToast: vi.fn(),
}));

vi.mock("@seliseblocks/genesis-os", () => ({
  useProjectStore: () => ({ selectedProject: { tenantId: "tenant-1" } }),
}));
vi.mock("@blocks-idp/authentication/hooks/use-sso", () => ({
  useSaveGetOIDCCredential: () => ({ data: h.existing }),
  useSaveOIDCCredential: () => ({ mutateAsync: h.mutateAsync }),
}));
vi.mock("@/hooks/use-toast", () => ({
  showErrorToast: (...a: unknown[]) => h.showErrorToast(...a),
  showSuccessToast: (...a: unknown[]) => h.showSuccessToast(...a),
}));
// Isolate the field renderer; the form's own submit logic is under test.
vi.mock("./sso-provider-config-form-fields", () => ({
  SSOProviderConfigFormField: () => <div data-testid="fields" />,
}));

import { SSOProviderConfigBlocksForm } from "./sso-provider-config-blocks-form";

describe("SSOProviderConfigBlocksForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.existing = {
      itemId: "cfg-1",
      audience: "https://aud.example.com",
      redirectUri: "https://redirect.example.com",
      isAutoRedirect: true,
    };
    h.mutateAsync.mockResolvedValue({ isSuccess: true });
  });

  it("renders the general section and fields", () => {
    render(<SSOProviderConfigBlocksForm configuration={null} save={vi.fn()} />);
    expect(screen.getByText("General")).toBeTruthy();
    expect(screen.getByTestId("fields")).toBeTruthy();
  });

  it("submits the mapped payload and reports success", async () => {
    render(<SSOProviderConfigBlocksForm configuration={null} save={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(h.mutateAsync).toHaveBeenCalled());
    const payload = h.mutateAsync.mock.calls[0][0];
    expect(payload).toMatchObject({
      redirectUri: "https://redirect.example.com",
      audience: "https://aud.example.com",
      isAutoRedirect: true,
      itemId: "cfg-1",
      projectKey: "tenant-1",
    });
    // Default scope selection is joined into a space-separated string.
    expect(payload.scope).toContain("openid");
    expect(h.showSuccessToast).toHaveBeenCalled();
  });

  it("shows an error toast when the save fails", async () => {
    h.mutateAsync.mockResolvedValueOnce({ isSuccess: false, errors: { general: "x" } });
    render(<SSOProviderConfigBlocksForm configuration={null} save={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(h.showErrorToast).toHaveBeenCalled());
    expect(h.showSuccessToast).not.toHaveBeenCalled();
  });
});
