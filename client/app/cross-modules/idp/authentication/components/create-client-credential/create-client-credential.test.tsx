import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  saveClient: vi.fn(),
  isPending: false,
  showErrorToast: vi.fn(),
  showSuccessToast: vi.fn(),
}));

vi.mock("@seliseblocks/genesis-os", () => ({
  useProjectStore: () => ({ selectedProject: { tenantId: "tenant-1" } }),
}));
vi.mock("@blocks-idp/authentication/hooks/use-auth-clients", () => ({
  useSaveAuthClient: () => ({ mutateAsync: h.saveClient, isPending: h.isPending }),
}));
vi.mock("@/hooks/use-toast", () => ({
  showErrorToast: h.showErrorToast,
  showSuccessToast: h.showSuccessToast,
}));
vi.mock("./client-credential-roles-section", () => ({
  ClientCredentialRolesSection: ({ onChange }: { onChange: (v: string[]) => void }) => (
    <button type="button" onClick={() => onChange(["admin"])}>
      pick-role
    </button>
  ),
}));
vi.mock("./client-credential-permissions-section", () => ({
  ClientCredentialPermissionsSection: ({ onChange }: { onChange: (v: string[]) => void }) => (
    <button type="button" onClick={() => onChange(["users:read"])}>
      pick-permission
    </button>
  ),
}));

import { CreateClientCredential } from "./create-client-credential";
import type { IClientCredentialsConfig } from "@blocks-idp/authentication/models/auth.oidc.model";

describe("CreateClientCredential", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.isPending = false;
    h.saveClient.mockResolvedValue({ isSuccess: true });
  });

  it("opens the create dialog from its trigger", async () => {
    const user = userEvent.setup();
    render(<CreateClientCredential />);
    await user.click(screen.getByRole("button", { name: "Add" }));
    expect(await screen.findByRole("heading", { name: "Add Client Credential" })).toBeTruthy();
    // Save is disabled until the form becomes dirty.
    expect(screen.getByRole("button", { name: "Add" }).hasAttribute("disabled")).toBe(true);
  });

  it("creates a client credential with the entered details", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(<CreateClientCredential open onOpenChange={onOpenChange} hideTrigger />);
    await user.type(screen.getByPlaceholderText("Enter client name"), "My Service");
    await user.click(screen.getByRole("button", { name: "pick-role" }));
    await user.click(screen.getByRole("button", { name: "pick-permission" }));
    await user.click(screen.getByRole("button", { name: "Add" }));

    await waitFor(() => expect(h.saveClient).toHaveBeenCalledTimes(1));
    const payload = h.saveClient.mock.calls[0][0];
    expect(payload.name).toBe("My Service");
    expect(payload.roles).toEqual(["admin"]);
    expect(payload.permissions).toEqual(["users:read"]);
    expect(payload.projectKey).toBe("tenant-1");
    expect(h.showSuccessToast).toHaveBeenCalledWith({
      description: "Client credential created successfully",
    });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("prefills fields and updates an existing client credential", async () => {
    const user = userEvent.setup();
    render(
      <CreateClientCredential
        open
        hideTrigger
        editClient={
          {
            itemId: "client-1",
            name: "Existing Client",
            accessTokenValidForNumberMinutes: 3,
            isActive: false,
            roles: ["viewer"],
            permissions: [],
          } as unknown as IClientCredentialsConfig
        }
      />,
    );
    expect(screen.getByRole("heading", { name: "Edit Client Credential" })).toBeTruthy();
    await waitFor(() => expect(screen.getByDisplayValue("Existing Client")).toBeTruthy());

    // Make the form dirty by editing the name, then save.
    await user.type(screen.getByPlaceholderText("Enter client name"), " Updated");
    await user.click(screen.getByRole("button", { name: "Save Changes" }));
    await waitFor(() => expect(h.saveClient).toHaveBeenCalledTimes(1));
    const payload = h.saveClient.mock.calls[0][0];
    expect(payload.itemId).toBe("client-1");
    expect(h.showSuccessToast).toHaveBeenCalledWith({
      description: "Client credential updated successfully",
    });
  });

  it("shows a mapped backend error when the save fails", async () => {
    const user = userEvent.setup();
    h.saveClient.mockResolvedValue({ isSuccess: false, errors: { name: "duplicate" } });
    render(<CreateClientCredential open hideTrigger />);
    await user.type(screen.getByPlaceholderText("Enter client name"), "Dup");
    await user.click(screen.getByRole("button", { name: "Add" }));
    await waitFor(() =>
      expect(h.showErrorToast).toHaveBeenCalledWith({ errors: { name: "duplicate" } }),
    );
  });

  it("shows a generic error when the save throws without structured errors", async () => {
    const user = userEvent.setup();
    h.saveClient.mockRejectedValue(new Error("boom"));
    render(<CreateClientCredential open hideTrigger />);
    await user.type(screen.getByPlaceholderText("Enter client name"), "Dup");
    await user.click(screen.getByRole("button", { name: "Add" }));
    await waitFor(() =>
      expect(h.showErrorToast).toHaveBeenCalledWith({ errors: "Something went wrong" }),
    );
  });
});
