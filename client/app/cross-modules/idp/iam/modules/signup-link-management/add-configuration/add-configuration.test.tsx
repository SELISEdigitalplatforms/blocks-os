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
  const actual = await vi.importActual<typeof import("@tanstack/react-query")>(
    "@tanstack/react-query",
  );
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
      <button type="button" onClick={() => onChange([...(selectedResources || []), "read:project"])}>
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

    expect(
      await screen.findByText("A configuration with this name already exists"),
    ).toBeTruthy();
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
    expect((await screen.findByTestId("form-level-error")).textContent).toContain("Unexpected rejection");
  });
});
