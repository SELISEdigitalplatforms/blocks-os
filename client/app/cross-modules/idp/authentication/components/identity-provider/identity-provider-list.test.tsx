import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  useGetIdentityProviders: vi.fn(),
  updateStatus: vi.fn(),
  deleteProvider: vi.fn(),
  showErrorToast: vi.fn(),
  showSuccessToast: vi.fn(),
}));

vi.mock("@seliseblocks/blocks-kit", () => {
  const Passthrough = ({ children }: { children?: React.ReactNode }) => <>{children}</>;
  return {
    Tooltip: Passthrough,
    TooltipTrigger: Passthrough,
    TooltipContent: Passthrough,
    TooltipProvider: Passthrough,
  };
});
vi.mock("@/hooks/use-toast", () => ({
  showErrorToast: h.showErrorToast,
  showSuccessToast: h.showSuccessToast,
}));
vi.mock("@blocks-idp/authentication/hooks/use-identity-provider", () => ({
  useGetIdentityProviders: h.useGetIdentityProviders,
  useUpdateIdentityProviderStatus: () => ({ mutateAsync: h.updateStatus, isPending: false }),
  useDeleteIdentityProvider: () => ({ mutateAsync: h.deleteProvider, isPending: false }),
}));
vi.mock("./identity-provider-form-dialog", () => ({
  IdentityProviderFormDialog: ({ open }: { open: boolean }) => (
    <div data-testid="idp-form" data-open={String(open)} />
  ),
}));

import { IdentityProviderList } from "./identity-provider-list";

const provider = {
  itemId: "idp-1",
  providerType: "social",
  provider: "google",
  displayName: "Google",
  isActive: true,
  clientId: "client-1",
  clientSecret: "secret-1",
  issuer: "https://issuer",
  scope: "openid",
  createdDate: "2024-03-01T00:00:00Z",
  initialRoles: ["user"],
  initialPermissions: [],
} as any;

describe("IdentityProviderList", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.useGetIdentityProviders.mockReturnValue({ data: { data: [provider] }, isLoading: false });
  });

  it("shows a loading skeleton", () => {
    h.useGetIdentityProviders.mockReturnValue({ data: undefined, isLoading: true });
    const { container } = render(<IdentityProviderList />);
    expect(container.querySelectorAll("[class*='animate-pulse']").length).toBeGreaterThan(0);
  });

  it("shows an empty state when there are no providers", () => {
    h.useGetIdentityProviders.mockReturnValue({ data: { data: [] }, isLoading: false });
    render(<IdentityProviderList />);
    expect(screen.getByText("No identity providers yet")).toBeTruthy();
  });

  it("renders a provider row with its type label and expanded details", () => {
    render(<IdentityProviderList />);
    expect(screen.getByText("Google")).toBeTruthy();
    expect(screen.getByText("Social")).toBeTruthy();
    // first row is expanded by default -> detail rows visible
    expect(screen.getByText("Client Id")).toBeTruthy();
    expect(screen.getByText("Issuer URL")).toBeTruthy();
  });

  it("opens the edit dialog", async () => {
    const user = userEvent.setup();
    render(<IdentityProviderList />);
    await user.click(screen.getByRole("button", { name: "Edit provider" }));
    expect(screen.getByTestId("idp-form").getAttribute("data-open")).toBe("true");
  });

  it("disables an active provider after confirmation", async () => {
    h.updateStatus.mockResolvedValueOnce({ isSuccess: true });
    const user = userEvent.setup();
    render(<IdentityProviderList />);
    await user.click(screen.getByRole("button", { name: "Disable provider" }));
    await user.click(await screen.findByRole("button", { name: "Disable" }));
    await waitFor(() =>
      expect(h.updateStatus).toHaveBeenCalledWith({ id: "idp-1", request: { isActive: false } }),
    );
    expect(h.showSuccessToast).toHaveBeenCalled();
  });

  it("shows an error toast when the status update fails", async () => {
    h.updateStatus.mockResolvedValueOnce({ isSuccess: false, errors: { general: "no" } });
    const user = userEvent.setup();
    render(<IdentityProviderList />);
    await user.click(screen.getByRole("button", { name: "Disable provider" }));
    await user.click(await screen.findByRole("button", { name: "Disable" }));
    await waitFor(() => expect(h.showErrorToast).toHaveBeenCalled());
  });

  it("deletes a provider after confirmation", async () => {
    h.deleteProvider.mockResolvedValueOnce({ isSuccess: true });
    const user = userEvent.setup();
    render(<IdentityProviderList />);
    await user.click(screen.getByRole("button", { name: "Delete provider" }));
    const buttons = await screen.findAllByRole("button", { name: "Delete" });
    await user.click(buttons[buttons.length - 1]);
    await waitFor(() => expect(h.deleteProvider).toHaveBeenCalledWith("idp-1"));
    expect(h.showSuccessToast).toHaveBeenCalled();
  });

  it("enables an inactive provider", async () => {
    h.useGetIdentityProviders.mockReturnValue({
      data: { data: [{ ...provider, isActive: false }] },
      isLoading: false,
    });
    h.updateStatus.mockResolvedValueOnce({ isSuccess: true });
    const user = userEvent.setup();
    render(<IdentityProviderList />);
    await user.click(screen.getByRole("button", { name: "Enable provider" }));
    await user.click(await screen.findByRole("button", { name: "Enable" }));
    await waitFor(() =>
      expect(h.updateStatus).toHaveBeenCalledWith({ id: "idp-1", request: { isActive: true } }),
    );
  });
});
