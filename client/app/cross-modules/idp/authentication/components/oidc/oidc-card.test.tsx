import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  deleteOidc: vi.fn(),
  saveOidc: vi.fn(),
  rotateSecret: vi.fn(),
  showErrorToast: vi.fn(),
  showSuccessToast: vi.fn(),
}));

vi.mock("@seliseblocks/genesis-os", () => {
  const Passthrough = ({ children }: { children?: React.ReactNode }) => <>{children}</>;
  return {
    useProjectStore: () => ({ selectedProject: { tenantId: "t1" } }),
    // the ui-kit tooltip re-exports these from blocks-kit
    Tooltip: Passthrough,
    TooltipTrigger: Passthrough,
    TooltipContent: Passthrough,
    TooltipProvider: Passthrough,
  };
});
vi.mock("@blocks-idp/authentication/hooks/use-auth-oidc", () => ({
  useDeleteAuthOidc: () => ({ mutateAsync: h.deleteOidc, isPending: false }),
  useRotateAuthOidcSecret: () => ({ mutateAsync: h.rotateSecret, isPending: false }),
  useSaveAuthOidc: () => ({ mutateAsync: h.saveOidc, isPending: false }),
}));
vi.mock("@/hooks/use-toast", () => ({
  showErrorToast: h.showErrorToast,
  showSuccessToast: h.showSuccessToast,
}));
vi.mock("../create-oidc/create-oidc", () => ({
  CreateOIDC: () => <button type="button">edit-oidc</button>,
}));

import { OIDCCard } from "./oidc-card";

const makeItem = (overrides = {}) => ({
  itemId: "oidc-123",
  clientDisplayName: "Portal",
  clientSecret: "sek-ret",
  createdDate: "2024-01-15T00:00:00Z",
  redirectUris: ["https://portal/cb"],
  allowedResponseTypes: ["code"],
  scope: "openid profile",
  requirePkce: true,
  isAutoRedirect: false,
  isActive: true,
  ...overrides,
});

const renderCard = (item = makeItem()) =>
  render(
    <table>
      <tbody>
        <OIDCCard oidc={item as never} />
      </tbody>
    </table>,
  );

describe("OIDCCard", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders the client label, id and detail rows expanded", () => {
    renderCard();
    expect(screen.getAllByText("Portal").length).toBeGreaterThan(0);
    expect(screen.getAllByText("oidc-123").length).toBeGreaterThan(0);
    expect(screen.getByText("Client Id")).toBeTruthy();
    expect(screen.getByText("Redirect URI(s)")).toBeTruthy();
    expect(screen.getByText("openid profile")).toBeTruthy();
  });

  it("keeps the OIDC tag and adds a Device Flow tag for device-flow clients", () => {
    renderCard(makeItem({ isDeviceFlowClient: true }));

    expect(screen.getByText("OIDC")).toBeTruthy();
    expect(screen.getByText("Device Flow")).toBeTruthy();
  });

  it("shows an Active status badge for active clients", () => {
    renderCard();
    expect(screen.getByText("Active")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Disable OIDC client" })).toBeTruthy();
  });

  it("shows an Inactive status badge and an enable action for inactive clients", () => {
    renderCard(makeItem({ isActive: false }));
    expect(screen.getByText("Inactive")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Enable OIDC client" })).toBeTruthy();
  });

  it("disables the client after confirmation, resending its configuration", async () => {
    h.saveOidc.mockResolvedValueOnce({ isSuccess: true });
    const user = userEvent.setup();
    renderCard();
    await user.click(screen.getByRole("button", { name: "Disable OIDC client" }));
    await user.click(await screen.findByRole("button", { name: "Disable" }));
    await waitFor(() =>
      expect(h.saveOidc).toHaveBeenCalledWith(
        expect.objectContaining({
          itemId: "oidc-123",
          clientDisplayName: "Portal",
          redirectUris: ["https://portal/cb"],
          scope: "openid profile",
          requirePkce: true,
          allowedResponseTypes: ["code"],
          isActive: false,
        }),
      ),
    );
    expect(h.showSuccessToast).toHaveBeenCalledWith({
      description: "OIDC client disabled successfully",
    });
  });

  it("enables an inactive client after confirmation", async () => {
    h.saveOidc.mockResolvedValueOnce({ isSuccess: true });
    const user = userEvent.setup();
    renderCard(makeItem({ isActive: false }));
    await user.click(screen.getByRole("button", { name: "Enable OIDC client" }));
    await user.click(await screen.findByRole("button", { name: "Enable" }));
    await waitFor(() =>
      expect(h.saveOidc).toHaveBeenCalledWith(expect.objectContaining({ isActive: true })),
    );
  });

  it("shows an error toast when the status change fails", async () => {
    h.saveOidc.mockResolvedValueOnce({ isSuccess: false, error: "save failed" });
    const user = userEvent.setup();
    renderCard();
    await user.click(screen.getByRole("button", { name: "Disable OIDC client" }));
    await user.click(await screen.findByRole("button", { name: "Disable" }));
    await waitFor(() => expect(h.showErrorToast).toHaveBeenCalledWith({ errors: "save failed" }));
  });

  it("does not render a per-row Template action", () => {
    renderCard();
    expect(screen.queryByRole("button", { name: "Template" })).toBeNull();
  });

  it("rotates the client secret and shows the new secret dialog", async () => {
    h.rotateSecret.mockResolvedValueOnce({ isSuccess: true, clientSecret: "new-secret-value" });
    const user = userEvent.setup();
    renderCard();
    await user.click(screen.getByRole("button", { name: "Rotate client secret" }));
    await user.click(await screen.findByRole("button", { name: "Rotate Secret" }));
    await waitFor(() => expect(h.rotateSecret).toHaveBeenCalled());
    expect(await screen.findByText("new-secret-value")).toBeTruthy();
    expect(h.showSuccessToast).toHaveBeenCalled();
  });

  it("shows an error toast when rotation fails", async () => {
    h.rotateSecret.mockResolvedValueOnce({ isSuccess: false, errors: "rotate failed" });
    const user = userEvent.setup();
    renderCard();
    await user.click(screen.getByRole("button", { name: "Rotate client secret" }));
    await user.click(await screen.findByRole("button", { name: "Rotate Secret" }));
    await waitFor(() => expect(h.showErrorToast).toHaveBeenCalledWith({ errors: "rotate failed" }));
  });

  it("deletes the client after confirmation", async () => {
    h.deleteOidc.mockResolvedValueOnce({ isSuccess: true });
    const user = userEvent.setup();
    renderCard();
    await user.click(screen.getByRole("button", { name: "Delete" }));
    // the row trigger and the dialog confirm both read "Delete"; the confirm is the last one
    const buttons = await screen.findAllByRole("button", { name: "Delete" });
    await user.click(buttons[buttons.length - 1]);
    await waitFor(() =>
      expect(h.deleteOidc).toHaveBeenCalledWith({ itemId: "oidc-123", projectKey: "t1" }),
    );
    expect(h.showSuccessToast).toHaveBeenCalled();
  });

  it("shows an error toast when deletion returns a failure", async () => {
    h.deleteOidc.mockResolvedValueOnce({ isSuccess: false, error: "del failed" });
    const user = userEvent.setup();
    renderCard();
    await user.click(screen.getByRole("button", { name: "Delete" }));
    const buttons = await screen.findAllByRole("button", { name: "Delete" });
    await user.click(buttons[buttons.length - 1]);
    await waitFor(() => expect(h.showErrorToast).toHaveBeenCalledWith({ errors: "del failed" }));
  });
});
