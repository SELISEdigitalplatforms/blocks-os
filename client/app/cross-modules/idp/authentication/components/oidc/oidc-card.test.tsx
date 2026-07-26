import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  navigate: vi.fn(),
  deleteOidc: vi.fn(),
  rotateSecret: vi.fn(),
  showErrorToast: vi.fn(),
  showSuccessToast: vi.fn(),
}));

vi.mock("react-router-dom", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-router-dom")>()),
  useNavigate: () => h.navigate,
}));
vi.mock("@seliseblocks/blocks-kit/hooks", () => ({
  useScopedPath: () => (p: string) => `/scoped/${p}`,
}));
vi.mock("@seliseblocks/blocks-kit", () => {
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

  it("navigates to the branding template", async () => {
    const user = userEvent.setup();
    renderCard();
    await user.click(screen.getByRole("button", { name: "Template" }));
    expect(h.navigate).toHaveBeenCalledWith("/scoped/secret-management/oidc/oidc-123/branding");
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
