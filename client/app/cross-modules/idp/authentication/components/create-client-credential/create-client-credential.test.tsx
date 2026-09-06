import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  saveClient: vi.fn(),
  isPending: false,
  showErrorToast: vi.fn(),
  showSuccessToast: vi.fn(),
  // Multi-org OFF by default keeps the organization picker hidden, so the existing
  // happy paths stay name + lifetime + roles.
  config: { data: { isMultiOrgEnabled: false }, isLoading: false },
}));

vi.mock("@seliseblocks/genesis-os", () => ({
  useProjectStore: () => ({ selectedProject: { tenantId: "tenant-1" } }),
}));
vi.mock("@blocks-idp/iam/hooks/use-organization", () => ({
  useGetOrganizationConfig: () => h.config,
}));
vi.mock("@blocks-idp/iam/components/organization-combobox", () => ({
  OrganizationCombobox: ({ onValueChange }: { onValueChange: (v: string) => void }) => (
    <button type="button" onClick={() => onValueChange("org-a")}>
      pick-organization
    </button>
  ),
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
    h.config = { data: { isMultiOrgEnabled: false }, isLoading: false };
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
            accessTokenValidForNumberMinutes: 15,
            isActive: false,
            roles: ["viewer"],
            permissions: ["users:read"],
          } as unknown as IClientCredentialsConfig
        }
      />,
    );
    expect(screen.getByRole("heading", { name: "Edit Client Credential" })).toBeTruthy();
    await waitFor(() => expect(screen.getByDisplayValue("Existing Client")).toBeTruthy());

    // Make the form dirty by editing the name, then save.
    await user.type(screen.getByPlaceholderText("Enter client name"), " Updated");
    await user.click(screen.getByRole("button", { name: "Update Changes" }));
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
    await user.click(screen.getByRole("button", { name: "pick-role" }));
    await user.click(screen.getByRole("button", { name: "pick-permission" }));
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
    await user.click(screen.getByRole("button", { name: "pick-role" }));
    await user.click(screen.getByRole("button", { name: "pick-permission" }));
    await user.click(screen.getByRole("button", { name: "Add" }));
    await waitFor(() =>
      expect(h.showErrorToast).toHaveBeenCalledWith({ errors: "Something went wrong" }),
    );
  });

  describe("organization scope", () => {
    it("hides the picker and sends no organization when multi-org is off", async () => {
      const user = userEvent.setup();
      render(<CreateClientCredential open hideTrigger />);

      expect(screen.queryByRole("button", { name: "pick-organization" })).toBeNull();

      await user.type(screen.getByPlaceholderText("Enter client name"), "My Service");
      await user.click(screen.getByRole("button", { name: "pick-role" }));
      await user.click(screen.getByRole("button", { name: "Add" }));

      await waitFor(() => expect(h.saveClient).toHaveBeenCalledTimes(1));
      expect(h.saveClient.mock.calls[0][0].organizationId).toBeUndefined();
    });

    it("requires an organization before the credential can be created", async () => {
      const user = userEvent.setup();
      h.config = { data: { isMultiOrgEnabled: true }, isLoading: false };
      render(<CreateClientCredential open hideTrigger />);

      await user.type(screen.getByPlaceholderText("Enter client name"), "My Service");
      await user.click(screen.getByRole("button", { name: "pick-role" }));

      // Name and role alone are no longer enough: the organization decides what the issued
      // tokens can reach, so it cannot be left to a default.
      await waitFor(() =>
        expect(screen.getByRole("button", { name: "Add" }).hasAttribute("disabled")).toBe(true),
      );

      await user.click(screen.getByRole("button", { name: "pick-organization" }));
      await waitFor(() =>
        expect(screen.getByRole("button", { name: "Add" }).hasAttribute("disabled")).toBe(false),
      );

      await user.click(screen.getByRole("button", { name: "Add" }));
      await waitFor(() => expect(h.saveClient).toHaveBeenCalledTimes(1));
      expect(h.saveClient.mock.calls[0][0].organizationId).toBe("org-a");
    });

    it("applies the organization requirement once the config finishes loading", async () => {
      // The real sequence: the dialog renders before useGetOrganizationConfig resolves, so the
      // validation schema is rebuilt on a later render. If that rebuild did not take effect a
      // credential could be created with no organization and silently become tenant-wide.
      const user = userEvent.setup();
      h.config = { data: undefined, isLoading: true };
      const { rerender } = render(<CreateClientCredential open hideTrigger />);

      await user.type(screen.getByPlaceholderText("Enter client name"), "My Service");
      await user.click(screen.getByRole("button", { name: "pick-role" }));

      h.config = { data: { isMultiOrgEnabled: true }, isLoading: false };
      rerender(<CreateClientCredential open hideTrigger />);

      expect(await screen.findByRole("button", { name: "pick-organization" })).toBeTruthy();
      await waitFor(() =>
        expect(screen.getByRole("button", { name: "Add" }).hasAttribute("disabled")).toBe(true),
      );

      await user.click(screen.getByRole("button", { name: "pick-organization" }));
      await user.click(screen.getByRole("button", { name: "Add" }));

      await waitFor(() => expect(h.saveClient).toHaveBeenCalledTimes(1));
      expect(h.saveClient.mock.calls[0][0].organizationId).toBe("org-a");
    });

    it("does not offer to re-scope an existing credential", async () => {
      const user = userEvent.setup();
      h.config = { data: { isMultiOrgEnabled: true }, isLoading: false };
      render(
        <CreateClientCredential
          open
          hideTrigger
          editClient={
            {
              itemId: "client-1",
              name: "Existing Client",
              accessTokenValidForNumberMinutes: 15,
              isActive: true,
              organizationId: "org-a",
              roles: ["viewer"],
              permissions: [],
            } as unknown as IClientCredentialsConfig
          }
        />,
      );

      // Editing must not move a live credential between organizations: services already
      // holding its tokens never asked for the change.
      expect(screen.queryByRole("button", { name: "pick-organization" })).toBeNull();

      await waitFor(() => expect(screen.getByDisplayValue("Existing Client")).toBeTruthy());
      await user.type(screen.getByPlaceholderText("Enter client name"), " Updated");
      await user.click(screen.getByRole("button", { name: "Update Changes" }));

      await waitFor(() => expect(h.saveClient).toHaveBeenCalledTimes(1));
      expect(h.saveClient.mock.calls[0][0].organizationId).toBeUndefined();
    });
  });
});
