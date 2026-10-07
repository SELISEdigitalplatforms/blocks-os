import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.stubGlobal("matchMedia", (query: string) => ({
  matches: false,
  media: query,
  onchange: null,
  addListener: vi.fn(),
  removeListener: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  dispatchEvent: vi.fn(),
}));

const h = vi.hoisted(() => ({
  mutateAsync: vi.fn(),
  isPending: false,
  reset: vi.fn(),
  showErrorToast: vi.fn(),
  showSuccessToast: vi.fn(),
  invalidateQueries: vi.fn(),
}));

vi.mock("@blocks-idp/iam/hooks/use-signup-link-configurations", () => ({
  useCreateSignupLinkConfiguration: () => ({
    mutateAsync: h.mutateAsync,
    isPending: h.isPending,
    reset: h.reset,
  }),
}));

vi.mock("@tanstack/react-query", async () => {
  const actual =
    await vi.importActual<typeof import("@tanstack/react-query")>("@tanstack/react-query");
  return {
    ...actual,
    useQueryClient: () => ({ invalidateQueries: h.invalidateQueries }),
  };
});

vi.mock("@/hooks/use-toast", () => ({
  showErrorToast: h.showErrorToast,
  showSuccessToast: h.showSuccessToast,
}));

vi.mock("@seliseblocks/genesis-os", () => ({
  useProjectStore: () => ({ selectedProject: { tenantId: "tenant-1" } }),
}));

vi.mock("@blocks-idp/iam/hooks/use-roles", () => ({
  useGetRoles: () => ({ data: { data: [{ name: "Partner", slug: "partner-user" }] } }),
}));

vi.mock("@blocks-idp/iam/hooks/use-permission", () => ({
  useGetPermissions: () => ({ data: { data: [] } }),
}));

vi.mock("@/components/filter-toolbar", () => ({
  FilterControls: {
    MultiSelect: ({
      label,
      value,
      onChange,
    }: {
      label?: string;
      value: string[];
      onChange: (v: string[]) => void;
    }) => (
      <button type="button" onClick={() => onChange([...(value || []), "partner-user"])}>
        {label}
      </button>
    ),
  },
}));

// Radix Select needs these in jsdom; without them the trigger never opens.
if (!Element.prototype.hasPointerCapture) {
  Element.prototype.hasPointerCapture = () => false;
}
if (!Element.prototype.releasePointerCapture) {
  Element.prototype.releasePointerCapture = () => {};
}
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {};
}

vi.mock("@blocks-idp/authentication/hooks/use-auth-oidc", () => ({
  useGetAuthOidcCredentials: () => ({
    data: {
      oIDCClientCredentials: [
        {
          itemId: "partner-portal",
          clientDisplayName: "Partner Portal",
          redirectUris: ["https://partner.example.com/callback"],
          isActive: true,
          isDeviceFlowClient: false,
        },
        // Filtered out: a signup link has to land on a browser redirect.
        {
          itemId: "device-client",
          clientDisplayName: "Device",
          redirectUris: [],
          isActive: true,
          isDeviceFlowClient: true,
        },
      ],
    },
    isLoading: false,
  }),
}));

// The roles/permissions sections are covered by their own suites; here they stand in as
// simple buttons so these tests stay about the dialog and its payload.
vi.mock(
  "@blocks-idp/authentication/components/create-client-credential/client-credential-roles-section",
  () => ({
    ClientCredentialRolesSection: ({
      onChange,
      selectedSlugs,
    }: {
      onChange: (v: string[]) => void;
      selectedSlugs: string[];
    }) => (
      <button type="button" onClick={() => onChange([...(selectedSlugs || []), "partner-user"])}>
        Roles
      </button>
    ),
  }),
);

vi.mock(
  "@blocks-idp/authentication/components/create-client-credential/client-credential-permissions-section",
  () => ({
    ClientCredentialPermissionsSection: ({
      onChange,
      selectedResources,
    }: {
      onChange: (v: string[]) => void;
      selectedResources: string[];
    }) => (
      <button
        type="button"
        onClick={() => onChange([...(selectedResources || []), "read:project"])}
      >
        Permissions
      </button>
    ),
  }),
);

import { AddConfiguration } from "./add-configuration";

/**
 * Picks the one eligible client. Its single registered redirect URI is then filled in
 * automatically, which is the behaviour being relied on here.
 */
const selectClient = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(screen.getByTestId("client-select"));
  await user.click(await screen.findByRole("option", { name: "Partner Portal" }));
};

describe("AddConfiguration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.isPending = false;
    h.mutateAsync.mockResolvedValue({ isSuccess: true, itemId: "new-1" });
  });

  it("blocks empty submit client-side with no network call", async () => {
    const user = userEvent.setup();
    render(<AddConfiguration />);
    await user.click(screen.getByRole("button", { name: "Add Configuration" }));
    await user.click(screen.getByRole("button", { name: "Create" }));
    expect(h.mutateAsync).not.toHaveBeenCalled();
    expect(await screen.findByText("Name is required")).toBeTruthy();
  });

  it("creates a configuration and toasts success", async () => {
    const user = userEvent.setup();
    render(<AddConfiguration />);
    await user.click(screen.getByRole("button", { name: "Add Configuration" }));
    await user.type(screen.getByPlaceholderText("Partner onboarding"), "Partner onboarding");
    await selectClient(user);
    await user.click(screen.getByRole("button", { name: "Roles" }));
    await user.click(screen.getByRole("button", { name: "Create" }));

    await waitFor(() => expect(h.mutateAsync).toHaveBeenCalledTimes(1));
    expect(h.mutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Partner onboarding",
        clientId: "partner-portal",
        redirectUri: "https://partner.example.com/callback",
        credentialMode: "Passwordless",
        defaultLifetimeMinutes: 1440,
        defaultRoles: ["partner-user"],
      }),
    );
    expect(h.showSuccessToast).toHaveBeenCalledWith({ description: "Configuration created" });
  });

  it("keeps the dialog open and maps a 400 Name error onto the field", async () => {
    h.mutateAsync.mockRejectedValue({
      status: 400,
      errors: { Name: "A configuration with this name already exists" },
    });
    const user = userEvent.setup();
    render(<AddConfiguration />);
    await user.click(screen.getByRole("button", { name: "Add Configuration" }));
    await user.type(screen.getByPlaceholderText("Partner onboarding"), "Partner onboarding");
    await selectClient(user);
    await user.click(screen.getByRole("button", { name: "Create" }));

    expect(await screen.findByText("A configuration with this name already exists")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Add Configuration" })).toBeTruthy();
    expect(h.showSuccessToast).not.toHaveBeenCalled();
    expect(h.showErrorToast).not.toHaveBeenCalled();
  });

  it("surfaces unmapped 400 keys as a form-level error", async () => {
    h.mutateAsync.mockRejectedValue({
      status: 400,
      errors: { SomethingElse: "Unexpected rejection" },
    });
    const user = userEvent.setup();
    render(<AddConfiguration />);
    await user.click(screen.getByRole("button", { name: "Add Configuration" }));
    await user.type(screen.getByPlaceholderText("Partner onboarding"), "Partner onboarding");
    await selectClient(user);
    await user.click(screen.getByRole("button", { name: "Create" }));
    expect((await screen.findByTestId("form-level-error")).textContent).toContain(
      "Unexpected rejection",
    );
  });

  describe("existing-user password and max redemptions (#645)", () => {
    const WARNING =
      "Anyone who can generate links from this configuration will be able to sign in as an existing user without their password.";

    const openDialog = async (user: ReturnType<typeof userEvent.setup>) => {
      render(<AddConfiguration />);
      await user.click(screen.getByRole("button", { name: "Add Configuration" }));
    };

    const fillRequired = async (user: ReturnType<typeof userEvent.setup>) => {
      await user.type(screen.getByPlaceholderText("Partner onboarding"), "Partner onboarding");
      await selectClient(user);
    };

    const pick = async (
      user: ReturnType<typeof userEvent.setup>,
      testId: string,
      option: string,
    ) => {
      await user.click(screen.getByTestId(testId));
      await user.click(await screen.findByRole("option", { name: option }));
    };

    const theSwitch = () =>
      screen.getByRole("switch", { name: "Existing users must confirm their password" });

    it("opens with the switch on and no warning (H1)", async () => {
      const user = userEvent.setup();
      await openDialog(user);
      expect(theSwitch().getAttribute("aria-checked")).toBe("true");
      expect(screen.queryByText(WARNING)).toBeNull();
      const max = screen.getByTestId("default-max-redemptions") as HTMLInputElement;
      expect(max.value).toBe("");
      expect(max.getAttribute("placeholder")).toBe("1 (single use)");
      expect(max.getAttribute("inputmode")).toBe("numeric");
    });

    it("shows the switch in every mode and credential mode and keeps its value (H1, C6)", async () => {
      const user = userEvent.setup();
      await openDialog(user);
      await user.click(theSwitch());
      await pick(user, "credential-mode-select", "Password required");
      expect(theSwitch().getAttribute("aria-checked")).toBe("false");
      await pick(user, "mode-select", "Embedded");
      expect(theSwitch().getAttribute("aria-checked")).toBe("false");
      await pick(user, "credential-mode-select", "Passwordless");
      expect(theSwitch().getAttribute("aria-checked")).toBe("false");
      await pick(user, "mode-select", "Blocks OIDC");
      expect(theSwitch().getAttribute("aria-checked")).toBe("false");
    });

    it("sends the switch and null max on a default create (H2, H7, C3, C11, C12)", async () => {
      const user = userEvent.setup();
      await openDialog(user);
      await fillRequired(user);
      await user.click(screen.getByRole("button", { name: "Create" }));

      await waitFor(() => expect(h.mutateAsync).toHaveBeenCalledTimes(1));
      expect(h.mutateAsync).toHaveBeenCalledWith({
        name: "Partner onboarding",
        description: undefined,
        defaultRoles: [],
        defaultPermissions: [],
        mode: "Oidc",
        clientId: "partner-portal",
        redirectUri: "https://partner.example.com/callback",
        defaultForwardedTo: undefined,
        credentialMode: "Passwordless",
        signInAfterActivation: false,
        defaultLifetimeMinutes: 1440,
        requireExistingUserPassword: true,
        defaultMaxRedemptions: null,
      });
    });

    it("shows the warning while off, hides it when back on, and sends false and 0 (H3, H4, H8, C9)", async () => {
      const user = userEvent.setup();
      await openDialog(user);
      await fillRequired(user);

      await user.click(theSwitch());
      const alert = screen.getByRole("alert");
      expect(alert.textContent).toContain("Existing users won't be asked for a password");
      expect(alert.textContent).toContain(WARNING);

      await user.click(theSwitch());
      expect(screen.queryByText(WARNING)).toBeNull();

      // Keyboard: Space toggles the focused switch.
      theSwitch().focus();
      await user.keyboard(" ");
      expect(theSwitch().getAttribute("aria-checked")).toBe("false");
      expect(screen.getByText(WARNING)).toBeTruthy();

      await user.type(screen.getByTestId("default-max-redemptions"), "0");
      await user.click(screen.getByRole("button", { name: "Create" }));

      await waitFor(() => expect(h.mutateAsync).toHaveBeenCalledTimes(1));
      expect(h.mutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({ requireExistingUserPassword: false, defaultMaxRedemptions: 0 }),
      );
    });

    it("sends a positive whole number as a number (H8)", async () => {
      const user = userEvent.setup();
      await openDialog(user);
      await fillRequired(user);
      await user.type(screen.getByTestId("default-max-redemptions"), "25");
      await user.click(screen.getByRole("button", { name: "Create" }));
      await waitFor(() => expect(h.mutateAsync).toHaveBeenCalledTimes(1));
      expect(h.mutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({ defaultMaxRedemptions: 25 }),
      );
    });

    it("includes the switch on an embedded create (C6)", async () => {
      const user = userEvent.setup();
      await openDialog(user);
      await user.type(screen.getByPlaceholderText("Partner onboarding"), "Embedded config");
      await pick(user, "mode-select", "Embedded");
      await user.click(theSwitch());
      await user.click(screen.getByRole("button", { name: "Create" }));
      await waitFor(() => expect(h.mutateAsync).toHaveBeenCalledTimes(1));
      const sent = h.mutateAsync.mock.calls[0][0];
      expect(sent.requireExistingUserPassword).toBe(false);
      expect(sent.mode).toBe("Embedded");
      expect("clientId" in sent).toBe(false);
    });

    it.each([
      ["-1", "Enter 0 or a whole number"],
      ["1.5", "Enter 0 or a whole number"],
      ["abc", "Enter 0 or a whole number"],
      ["1e3", "Enter 0 or a whole number"],
      ["3000000000", "Enter a smaller number"],
    ])("blocks %s with %j and sends nothing (C1, C2)", async (value, message) => {
      const user = userEvent.setup();
      await openDialog(user);
      await fillRequired(user);
      const max = screen.getByTestId("default-max-redemptions");
      await user.type(max, value);
      await user.click(screen.getByRole("button", { name: "Create" }));
      expect(await screen.findByText(message)).toBeTruthy();
      expect(max.getAttribute("aria-invalid")).toBe("true");
      expect(h.mutateAsync).not.toHaveBeenCalled();
    });

    it("keeps values and maps a DefaultMaxRedemptions 400 onto the field with focus (C4, C7)", async () => {
      h.mutateAsync.mockRejectedValue({ status: 400, errors: { DefaultMaxRedemptions: "Bad" } });
      const user = userEvent.setup();
      await openDialog(user);
      await fillRequired(user);
      await user.click(theSwitch());
      const max = screen.getByTestId("default-max-redemptions") as HTMLInputElement;
      await user.type(max, "7");
      await user.click(screen.getByRole("button", { name: "Create" }));

      expect(await screen.findByText("Bad")).toBeTruthy();
      await waitFor(() => expect(document.activeElement).toBe(max));
      expect(max.value).toBe("7");
      expect(theSwitch().getAttribute("aria-checked")).toBe("false");
      expect(screen.getByRole("heading", { name: "Add Configuration" })).toBeTruthy();
    });

    it("maps a RequireExistingUserPassword error returned in the body onto the switch (C4)", async () => {
      h.mutateAsync.mockResolvedValue({
        isSuccess: false,
        itemId: "",
        errors: { RequireExistingUserPassword: "Not allowed" },
      });
      const user = userEvent.setup();
      await openDialog(user);
      await fillRequired(user);
      await user.click(screen.getByRole("button", { name: "Create" }));
      expect(await screen.findByText("Not allowed")).toBeTruthy();
      await waitFor(() => expect(document.activeElement).toBe(theSwitch()));
    });

    it("locks the switch and Max redemptions while saving (C8)", async () => {
      h.isPending = true;
      const user = userEvent.setup();
      await openDialog(user);
      expect((theSwitch() as HTMLButtonElement).disabled).toBe(true);
      expect((screen.getByTestId("default-max-redemptions") as HTMLInputElement).disabled).toBe(
        true,
      );
    });
  });
});
