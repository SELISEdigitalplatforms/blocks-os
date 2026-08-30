import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  saveClient: vi.fn(),
  deleteClient: vi.fn(),
  showErrorToast: vi.fn(),
  showSuccessToast: vi.fn(),
}));

vi.mock("@seliseblocks/genesis-os", () => {
  const Passthrough = ({ children }: { children?: React.ReactNode }) => <>{children}</>;
  return {
    useProjectStore: () => ({ selectedProject: { tenantId: "t1" } }),
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
vi.mock("@blocks-idp/authentication/hooks/use-auth-clients", () => ({
  useSaveAuthClient: () => ({ mutateAsync: h.saveClient, isPending: false }),
  useDeleteAuthClient: () => ({ mutateAsync: h.deleteClient, isPending: false }),
}));

import { ClientCredentialList } from "./client-credentials-list";
import type { IClientCredentialsConfig } from "@blocks-idp/authentication/models/auth.oidc.model";

const client = {
  itemId: "client-abcdef123456",
  name: "My Client",
  clientSecret: "secret-abcdef123456",
  isActive: true,
  roles: ["admin"],
  permissions: ["p1", "p2"],
  accessTokenValidForNumberMinutes: 90,
  createdDate: "2024-03-01T00:00:00Z",
  lastUpdatedDate: "2024-03-02T00:00:00Z",
} as unknown as IClientCredentialsConfig;

describe("ClientCredentialList", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows a loading skeleton", () => {
    const { container } = render(<ClientCredentialList data={[]} isLoading />);
    expect(container.querySelectorAll("[class*='animate-pulse']").length).toBeGreaterThan(0);
  });

  it("shows an empty state when there is no data", () => {
    render(<ClientCredentialList data={[]} isLoading={false} />);
    expect(screen.getByText("No client credentials yet")).toBeTruthy();
  });

  it("renders a row with its status and expanded details", () => {
    render(<ClientCredentialList data={[client]} isLoading={false} />);
    expect(screen.getByText("My Client")).toBeTruthy();
    expect(screen.getByText("Active")).toBeTruthy();
    // first row is expanded by default -> detail rows visible
    expect(screen.getByText("Client Id")).toBeTruthy();
    expect(screen.getByText("Client Secret")).toBeTruthy();
    expect(screen.getByText("Role(s)")).toBeTruthy();
  });

  it("sorts rows by newest created date first", () => {
    const older = { ...client, itemId: "c-older", name: "Older", createdDate: "2023-01-01" };
    const newer = { ...client, itemId: "c-newer", name: "Newer", createdDate: "2024-06-01" };
    render(<ClientCredentialList data={[older, newer]} isLoading={false} />);
    const names = screen.getAllByText(/Older|Newer/).map((el) => el.textContent);
    expect(names.indexOf("Newer")).toBeLessThan(names.indexOf("Older"));
  });

  it("calls onEdit with the clicked client", async () => {
    const onEdit = vi.fn();
    const user = userEvent.setup();
    render(<ClientCredentialList data={[client]} isLoading={false} onEdit={onEdit} />);
    await user.click(screen.getByRole("button", { name: "Edit client credential" }));
    expect(onEdit).toHaveBeenCalledWith(client);
  });

  it("disables an active client credential after confirmation", async () => {
    h.saveClient.mockResolvedValueOnce({ isSuccess: true });
    const user = userEvent.setup();
    render(<ClientCredentialList data={[client]} isLoading={false} />);
    await user.click(screen.getByRole("button", { name: "Disable client credential" }));
    await user.click(await screen.findByRole("button", { name: "Disable" }));
    await waitFor(() =>
      expect(h.saveClient).toHaveBeenCalledWith(
        expect.objectContaining({ itemId: "client-abcdef123456", isActive: false }),
      ),
    );
    expect(h.showSuccessToast).toHaveBeenCalled();
  });

  it("enables an inactive client credential after confirmation", async () => {
    h.saveClient.mockResolvedValueOnce({ isSuccess: true });
    const user = userEvent.setup();
    render(
      <ClientCredentialList data={[{ ...client, isActive: false }]} isLoading={false} />,
    );
    await user.click(screen.getByRole("button", { name: "Enable client credential" }));
    await user.click(await screen.findByRole("button", { name: "Enable" }));
    await waitFor(() =>
      expect(h.saveClient).toHaveBeenCalledWith(
        expect.objectContaining({ itemId: "client-abcdef123456", isActive: true }),
      ),
    );
  });

  it("shows an error toast when the status update fails", async () => {
    h.saveClient.mockResolvedValueOnce({ isSuccess: false, errors: { general: "no" } });
    const user = userEvent.setup();
    render(<ClientCredentialList data={[client]} isLoading={false} />);
    await user.click(screen.getByRole("button", { name: "Disable client credential" }));
    await user.click(await screen.findByRole("button", { name: "Disable" }));
    await waitFor(() => expect(h.showErrorToast).toHaveBeenCalled());
  });

  it("deletes a client credential after confirmation", async () => {
    h.deleteClient.mockResolvedValueOnce({ isSuccess: true });
    const user = userEvent.setup();
    render(<ClientCredentialList data={[client]} isLoading={false} />);
    await user.click(screen.getByRole("button", { name: "Delete client credential" }));
    const buttons = await screen.findAllByRole("button", { name: "Delete" });
    await user.click(buttons[buttons.length - 1]);
    await waitFor(() =>
      expect(h.deleteClient).toHaveBeenCalledWith({ itemId: "client-abcdef123456" }),
    );
    expect(h.showSuccessToast).toHaveBeenCalled();
  });

  it("shows an error toast when deletion fails", async () => {
    h.deleteClient.mockResolvedValueOnce({ isSuccess: false, errors: { general: "cannot" } });
    const user = userEvent.setup();
    render(<ClientCredentialList data={[client]} isLoading={false} />);
    await user.click(screen.getByRole("button", { name: "Delete client credential" }));
    const buttons = await screen.findAllByRole("button", { name: "Delete" });
    await user.click(buttons[buttons.length - 1]);
    await waitFor(() => expect(h.showErrorToast).toHaveBeenCalled());
    expect(h.showSuccessToast).not.toHaveBeenCalled();
  });
});
