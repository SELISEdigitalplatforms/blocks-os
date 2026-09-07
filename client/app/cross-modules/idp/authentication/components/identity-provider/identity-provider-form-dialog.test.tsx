import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  useGetIdentityProviderById: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  isCreating: false,
  isUpdating: false,
  showErrorToast: vi.fn(),
  showSuccessToast: vi.fn(),
}));

vi.mock("@seliseblocks/genesis-os", () => ({
  useProjectStore: () => ({ selectedProject: { tenantId: "tenant-1" } }),
}));
vi.mock("@/hooks/use-toast", () => ({
  showErrorToast: h.showErrorToast,
  showSuccessToast: h.showSuccessToast,
}));
vi.mock("@blocks-idp/authentication/hooks/use-identity-provider", () => ({
  useGetIdentityProviderById: (id: string, enabled: boolean) =>
    h.useGetIdentityProviderById(id, enabled),
  useCreateIdentityProvider: () => ({ mutateAsync: h.create, isPending: h.isCreating }),
  useUpdateIdentityProvider: () => ({ mutateAsync: h.update, isPending: h.isUpdating }),
}));

// The SSO role/permission pickers pull in their own paginated queries; they are
// tested separately. Replace them with lightweight stubs so this suite stays
// focused on the dialog behaviour.
vi.mock(
  "@blocks-idp/authentication/components/sso-initial-roles/sso-initial-roles",
  () => ({
    SSOInitialRoles: ({ roles }: { roles: unknown[] }) => (
      <div data-testid="sso-roles" data-count={roles.length} />
    ),
  }),
);
vi.mock(
  "@blocks-idp/authentication/components/sso-initial-permissions/sso-initial-permissions",
  () => ({
    SSOInitialPermissions: ({ permissions }: { permissions: unknown[] }) => (
      <div data-testid="sso-permissions" data-count={permissions.length} />
    ),
  }),
);

import { IdentityProviderFormDialog } from "./identity-provider-form-dialog";

const loadingState = { data: undefined, isLoading: true, isError: false, error: null };
const idleState = { data: undefined, isLoading: false, isError: false, error: null };

const existingProvider = {
  itemId: "idp-1",
  providerType: "byos",
  provider: "acme-idp",
  displayName: "Acme",
  clientId: "client-abc",
  clientSecret: "",
  redirectUris: ["https://app.example.com/cb", "https://app.example.com/cb2"],
  initialRoles: ["admin"],
  initialPermissions: ["users:read"],
  requirePkce: true,
  isActive: true,
};

const successResponse = { isSuccess: true, data: existingProvider, errors: undefined };

describe("IdentityProviderFormDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.isCreating = false;
    h.isUpdating = false;
    h.useGetIdentityProviderById.mockReturnValue(idleState);
    h.create.mockResolvedValue({ isSuccess: true });
    h.update.mockResolvedValue({ isSuccess: true });
  });

  it("does not render its content when closed", () => {
    render(<IdentityProviderFormDialog open={false} onOpenChange={vi.fn()} />);
    expect(screen.queryByText("Add Identity Provider")).toBeNull();
  });

  it("renders the create form with a social provider picker by default", () => {
    render(<IdentityProviderFormDialog open onOpenChange={vi.fn()} />);
    expect(screen.getByText("Add Identity Provider")).toBeTruthy();
    // Social is the default provider type, so a provider dropdown is shown.
    expect(screen.getByText("Select a provider")).toBeTruthy();
    expect(screen.getByPlaceholderText("Enter client ID")).toBeTruthy();
    expect(screen.getByPlaceholderText("Enter client secret")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Add Provider" })).toBeTruthy();
  });

  it("toggles client id and client secret visibility", async () => {
    const user = userEvent.setup();
    render(<IdentityProviderFormDialog open onOpenChange={vi.fn()} />);
    const clientId = screen.getByPlaceholderText("Enter client ID") as HTMLInputElement;
    expect(clientId.type).toBe("password");
    // The eye toggle is the button adjacent to the client id input.
    const toggle = clientId.parentElement?.querySelector("button") as HTMLButtonElement;
    await user.click(toggle);
    expect(clientId.type).toBe("text");
    await user.click(toggle);
    expect(clientId.type).toBe("password");
  });

  it("adds and removes redirect URI rows", async () => {
    const user = userEvent.setup();
    render(<IdentityProviderFormDialog open onOpenChange={vi.fn()} />);
    const uriInputs = () => screen.getAllByPlaceholderText("https://your-app.com/callback");
    expect(uriInputs()).toHaveLength(1);
    await user.click(screen.getByRole("button", { name: /Add Redirect URI/i }));
    expect(uriInputs()).toHaveLength(2);
    // A remove button appears once there is more than one row.
    const removeButtons = screen
      .getAllByRole("button")
      .filter((b) => b.className.includes("hover:text-destructive"));
    await user.click(removeButtons[0]);
    expect(uriInputs()).toHaveLength(1);
  });

  it("shows the auto-generated well known url for the blocks-oidc provider type", async () => {
    const user = userEvent.setup();
    render(<IdentityProviderFormDialog open onOpenChange={vi.fn()} />);
    await user.click(screen.getByRole("combobox", { name: /Select Provider/i }));
    await user.click(await screen.findByRole("option", { name: "Blocks OIDC" }));
    const wellKnown = (await screen.findByLabelText("Well Known URL")) as HTMLInputElement;
    expect(wellKnown.readOnly).toBe(true);
    expect(wellKnown.value).toContain("tenant-1");
  });

  it("blocks submit and surfaces an error when every redirect uri is blank", async () => {
    const user = userEvent.setup();
    render(<IdentityProviderFormDialog open onOpenChange={vi.fn()} />);
    // Switch to BYOS so the provider name becomes a plain required text input.
    await user.click(screen.getByRole("combobox", { name: /Select Provider/i }));
    await user.click(await screen.findByRole("option", { name: "Bring your own SSO (BYOS)" }));

    await user.type(screen.getByPlaceholderText("my-identity-provider"), "acme-idp");
    await user.type(screen.getByPlaceholderText("Enter client ID"), "client-abc");
    await user.type(screen.getByPlaceholderText("Enter client secret"), "secret-xyz");

    const submit = await waitFor(() => {
      const btn = screen.getByRole("button", { name: "Add Provider" }) as HTMLButtonElement;
      expect(btn.disabled).toBe(false);
      return btn;
    });
    await user.click(submit);

    expect(await screen.findByText("At least one redirect URI is required")).toBeTruthy();
    expect(h.create).not.toHaveBeenCalled();
  });

  it("creates a provider and reports success", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(<IdentityProviderFormDialog open onOpenChange={onOpenChange} />);

    await user.click(screen.getByRole("combobox", { name: /Select Provider/i }));
    await user.click(await screen.findByRole("option", { name: "Bring your own SSO (BYOS)" }));

    await user.type(screen.getByPlaceholderText("my-identity-provider"), "acme-idp");
    await user.type(screen.getByPlaceholderText("Enter client ID"), "client-abc");
    await user.type(screen.getByPlaceholderText("Enter client secret"), "secret-xyz");
    await user.type(
      screen.getByPlaceholderText("https://your-app.com/callback"),
      "https://app.example.com/cb",
    );

    const submit = await waitFor(() => {
      const btn = screen.getByRole("button", { name: "Add Provider" }) as HTMLButtonElement;
      expect(btn.disabled).toBe(false);
      return btn;
    });
    await user.click(submit);

    await waitFor(() => expect(h.create).toHaveBeenCalledTimes(1));
    const payload = h.create.mock.calls[0][0];
    expect(payload.provider).toBe("acme-idp");
    expect(payload.redirectUris).toContain("https://app.example.com/cb");
    expect(h.showSuccessToast).toHaveBeenCalled();
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });

  it("surfaces the server errors when create is not successful", async () => {
    h.create.mockResolvedValue({ isSuccess: false, errors: { provider: "duplicate" } });
    const user = userEvent.setup();
    render(<IdentityProviderFormDialog open onOpenChange={vi.fn()} />);

    await user.click(screen.getByRole("combobox", { name: /Select Provider/i }));
    await user.click(await screen.findByRole("option", { name: "Bring your own SSO (BYOS)" }));
    await user.type(screen.getByPlaceholderText("my-identity-provider"), "acme-idp");
    await user.type(screen.getByPlaceholderText("Enter client ID"), "client-abc");
    await user.type(screen.getByPlaceholderText("Enter client secret"), "secret-xyz");
    await user.type(
      screen.getByPlaceholderText("https://your-app.com/callback"),
      "https://app.example.com/cb",
    );

    const submit = await waitFor(() => {
      const btn = screen.getByRole("button", { name: "Add Provider" }) as HTMLButtonElement;
      expect(btn.disabled).toBe(false);
      return btn;
    });
    await user.click(submit);

    await waitFor(() =>
      expect(h.showErrorToast).toHaveBeenCalledWith({ errors: { provider: "duplicate" } }),
    );
    expect(h.showSuccessToast).not.toHaveBeenCalled();
  });

  it("shows a loading skeleton while an existing provider is being fetched", () => {
    h.useGetIdentityProviderById.mockReturnValue(loadingState);
    render(<IdentityProviderFormDialog open onOpenChange={vi.fn()} editId="idp-1" />);
    expect(screen.getByText("Edit Identity Provider")).toBeTruthy();
    expect(screen.getByLabelText("Loading provider")).toBeTruthy();
  });

  it("populates the form and updates an existing provider", async () => {
    h.useGetIdentityProviderById.mockReturnValue({ ...idleState, data: successResponse });
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(<IdentityProviderFormDialog open onOpenChange={onOpenChange} editId="idp-1" />);

    // Existing redirect uris are hydrated into the form.
    await waitFor(() =>
      expect(screen.getAllByDisplayValue(/app\.example\.com/)).toHaveLength(2),
    );
    const clientId = screen.getByPlaceholderText("Enter client ID") as HTMLInputElement;
    expect(clientId.value).toBe("client-abc");
    expect(clientId.disabled).toBe(true);

    const submit = await waitFor(() => {
      const btn = screen.getByRole("button", { name: "Save Changes" }) as HTMLButtonElement;
      expect(btn.disabled).toBe(false);
      return btn;
    });
    await user.click(submit);

    await waitFor(() => expect(h.update).toHaveBeenCalledTimes(1));
    expect(h.update.mock.calls[0][0].id).toBe("idp-1");
    expect(h.showSuccessToast).toHaveBeenCalled();
  });

  it("closes the dialog and reports an error when the provider cannot be loaded", async () => {
    h.useGetIdentityProviderById.mockReturnValue({
      ...idleState,
      data: { isSuccess: false, errors: { not_found: "gone" } },
    });
    const onOpenChange = vi.fn();
    render(<IdentityProviderFormDialog open onOpenChange={onOpenChange} editId="idp-1" />);
    await waitFor(() => expect(h.showErrorToast).toHaveBeenCalled());
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("closes the dialog when the fetch itself errors", async () => {
    h.useGetIdentityProviderById.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: { errors: { server: "boom" } },
    });
    const onOpenChange = vi.fn();
    render(<IdentityProviderFormDialog open onOpenChange={onOpenChange} editId="idp-1" />);
    await waitFor(() =>
      expect(h.showErrorToast).toHaveBeenCalledWith({ errors: { server: "boom" } }),
    );
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("cancel triggers onOpenChange(false)", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(<IdentityProviderFormDialog open onOpenChange={onOpenChange} />);
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("renders a disabled saving button while a mutation is pending", () => {
    h.isCreating = true;
    render(<IdentityProviderFormDialog open onOpenChange={vi.fn()} />);
    const saving = screen.getByRole("button", { name: /Saving/ }) as HTMLButtonElement;
    expect(saving.disabled).toBe(true);
  });

  it("preselects Select Provider and Provider Name from presetProviderType/presetProvider", () => {
    render(
      <IdentityProviderFormDialog
        open
        onOpenChange={vi.fn()}
        presetProviderType="social"
        presetProvider="google"
      />,
    );
    expect(screen.getAllByText("Google").length).toBeGreaterThan(0);
  });

  it("preselects Blocks OIDC via presetProviderType and reveals its Well Known URL", () => {
    render(
      <IdentityProviderFormDialog open onOpenChange={vi.fn()} presetProviderType="blocks-oidc" />,
    );
    expect(screen.getByLabelText("Well Known URL")).toBeTruthy();
  });

  it("C5: hides an already-configured social provider from the Provider Name picker", async () => {
    const user = userEvent.setup();
    render(<IdentityProviderFormDialog open onOpenChange={vi.fn()} isGoogleConfigured />);
    const providerNameSelect = screen.getByRole("combobox", { name: /Provider Name/i });
    await user.click(providerNameSelect);
    expect(await screen.findByRole("option", { name: /Microsoft/i })).toBeTruthy();
    expect(screen.queryByRole("option", { name: /Google/i })).toBeNull();
  });

  it("C6: hides Social from Select Provider once both Google and Microsoft are configured", async () => {
    const user = userEvent.setup();
    render(
      <IdentityProviderFormDialog
        open
        onOpenChange={vi.fn()}
        isGoogleConfigured
        isMicrosoftConfigured
      />,
    );
    const providerTypeSelect = screen.getByRole("combobox", { name: /Select Provider/i });
    await user.click(providerTypeSelect);
    expect(screen.queryByRole("option", { name: "Social" })).toBeNull();
    expect(await screen.findByRole("option", { name: "Blocks OIDC" })).toBeTruthy();
  });
});
