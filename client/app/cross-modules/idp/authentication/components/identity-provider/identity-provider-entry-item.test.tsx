import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  updateStatus: vi.fn(),
  deleteProvider: vi.fn(),
  showErrorToast: vi.fn(),
  showSuccessToast: vi.fn(),
}));

vi.mock("@seliseblocks/genesis-os", () => {
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
  useUpdateIdentityProviderStatus: () => ({ mutateAsync: h.updateStatus, isPending: false }),
  useDeleteIdentityProvider: () => ({ mutateAsync: h.deleteProvider, isPending: false }),
}));
vi.mock("./identity-provider-form-dialog", () => ({
  IdentityProviderFormDialog: ({ open }: { open: boolean }) => (
    <div data-testid="idp-form" data-open={String(open)} />
  ),
}));

import { ProviderEntryItem } from "./identity-provider-entry-item";
import type { IdentityProvider } from "@blocks-idp/authentication/models/identity-provider.model";

const provider = {
  itemId: "idp-1",
  providerType: "byos",
  provider: "okta-prod",
  displayName: "Okta Prod",
  isActive: true,
  clientId: "client-1",
  clientSecret: "secret-1",
  issuer: "https://issuer",
  scope: "openid",
  createdDate: "2024-03-01T00:00:00Z",
  initialRoles: ["user"],
  initialPermissions: [],
} as unknown as IdentityProvider;

describe("ProviderEntryItem", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the entry's name and provider key", () => {
    render(
      <ul>
        <ProviderEntryItem item={provider} />
      </ul>,
    );
    expect(screen.getByText("Okta Prod")).toBeTruthy();
    expect(screen.getByText("okta-prod")).toBeTruthy();
  });

  it("expands to show KV details when clicked", async () => {
    const user = userEvent.setup();
    render(
      <ul>
        <ProviderEntryItem item={provider} />
      </ul>,
    );
    expect(screen.queryByText("Client Id")).toBeNull();
    await user.click(screen.getByText("Okta Prod"));
    expect(screen.getByText("Client Id")).toBeTruthy();
    expect(screen.getByText("Issuer URL")).toBeTruthy();
  });

  it("can start expanded", () => {
    render(
      <ul>
        <ProviderEntryItem item={provider} defaultExpanded />
      </ul>,
    );
    expect(screen.getByText("Client Id")).toBeTruthy();
  });

  it("opens the edit dialog", async () => {
    const user = userEvent.setup();
    render(
      <ul>
        <ProviderEntryItem item={provider} />
      </ul>,
    );
    await user.click(screen.getByRole("button", { name: "Edit provider" }));
    expect(screen.getByTestId("idp-form").getAttribute("data-open")).toBe("true");
  });

  it("disables an active provider after confirmation", async () => {
    h.updateStatus.mockResolvedValueOnce({ isSuccess: true });
    const user = userEvent.setup();
    render(
      <ul>
        <ProviderEntryItem item={provider} />
      </ul>,
    );
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
    render(
      <ul>
        <ProviderEntryItem item={provider} />
      </ul>,
    );
    await user.click(screen.getByRole("button", { name: "Disable provider" }));
    await user.click(await screen.findByRole("button", { name: "Disable" }));
    await waitFor(() => expect(h.showErrorToast).toHaveBeenCalled());
  });

  it("deletes a provider after confirmation", async () => {
    h.deleteProvider.mockResolvedValueOnce({ isSuccess: true });
    const user = userEvent.setup();
    render(
      <ul>
        <ProviderEntryItem item={provider} />
      </ul>,
    );
    await user.click(screen.getByRole("button", { name: "Delete provider" }));
    const buttons = await screen.findAllByRole("button", { name: "Delete" });
    await user.click(buttons[buttons.length - 1]);
    await waitFor(() => expect(h.deleteProvider).toHaveBeenCalledWith("idp-1"));
    expect(h.showSuccessToast).toHaveBeenCalled();
  });

  it("enables an inactive provider", async () => {
    h.updateStatus.mockResolvedValueOnce({ isSuccess: true });
    const user = userEvent.setup();
    render(
      <ul>
        <ProviderEntryItem item={{ ...provider, isActive: false }} />
      </ul>,
    );
    await user.click(screen.getByRole("button", { name: "Enable provider" }));
    await user.click(await screen.findByRole("button", { name: "Enable" }));
    await waitFor(() =>
      expect(h.updateStatus).toHaveBeenCalledWith({ id: "idp-1", request: { isActive: true } }),
    );
  });
});
