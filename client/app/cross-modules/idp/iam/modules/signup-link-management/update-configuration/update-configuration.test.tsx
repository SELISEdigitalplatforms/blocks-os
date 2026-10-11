import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Dialog } from "@/components/ui-kits/dialog/dialog";

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
  showErrorToast: vi.fn(),
  showSuccessToast: vi.fn(),
  invalidateQueries: vi.fn(),
}));

vi.mock("@blocks-idp/iam/hooks/use-signup-link-configurations", () => ({
  useUpdateSignupLinkConfiguration: () => ({
    mutateAsync: h.mutateAsync,
    isPending: h.isPending,
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
  useGetRoles: () => ({ data: { data: [] } }),
}));

vi.mock("@blocks-idp/iam/hooks/use-permission", () => ({
  useGetPermissions: () => ({ data: { data: [] } }),
}));

vi.mock("@/components/filter-toolbar", () => ({
  FilterControls: {
    MultiSelect: () => <div data-testid="multi" />,
  },
}));

import { UpdateConfiguration } from "./update-configuration";

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
      ],
    },
    isLoading: false,
  }),
}));

vi.mock(
  "@blocks-idp/authentication/components/create-client-credential/client-credential-roles-section",
  () => ({
    ClientCredentialRolesSection: () => <button type="button">Roles</button>,
  }),
);

vi.mock(
  "@blocks-idp/authentication/components/create-client-credential/client-credential-permissions-section",
  () => ({
    ClientCredentialPermissionsSection: () => <button type="button">Permissions</button>,
  }),
);

import { ISignupLinkConfiguration } from "@blocks-idp/iam/models/signup-link-configuration";

const configuration: ISignupLinkConfiguration = {
  itemId: "cfg-1",
  name: "Partner onboarding",
  description: "old",
  defaultRoles: ["partner-user"],
  defaultPermissions: [],
  mode: "Oidc",
  joinUrl: null,
  clientId: "partner-portal",
  redirectUri: "https://partner.example.com/callback",
  defaultForwardedTo: null,
  credentialMode: "Passwordless",
  defaultLifetimeMinutes: 1440,
  defaultMaxRedemptions: null,
  isActive: true,
  createdDate: "2026-01-01T00:00:00Z",
  lastUpdatedDate: "2026-01-01T00:00:00Z",
};

describe("UpdateConfiguration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.isPending = false;
    h.mutateAsync.mockResolvedValue({ isSuccess: true, itemId: "cfg-1" });
  });

  it("PATCHes only the changed description field", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <Dialog open>
        <UpdateConfiguration configuration={configuration} isOpen onClose={onClose} />
      </Dialog>,
    );

    const description = screen.getByPlaceholderText("Optional description");
    await user.clear(description);
    await user.type(description, "new description only");
    await user.click(screen.getByRole("button", { name: "Update" }));

    await waitFor(() => expect(h.mutateAsync).toHaveBeenCalledTimes(1));
    // requireExistingUserPassword rides along on every PATCH (#645 H6); a fixture without
    // the field is a legacy document and reads as on.
    expect(h.mutateAsync).toHaveBeenCalledWith({
      itemId: "cfg-1",
      mode: "Oidc",
      description: "new description only",
      requireExistingUserPassword: true,
    });
    expect(h.showSuccessToast).toHaveBeenCalledWith({ description: "Configuration updated" });
    expect(onClose).toHaveBeenCalled();
  });
});

it("keeps dialog open on 400 field errors", async () => {
  h.mutateAsync.mockRejectedValue({
    status: 400,
    errors: { Name: "taken" },
  });
  const user = userEvent.setup();
  const onClose = vi.fn();
  render(
    <Dialog open>
      <UpdateConfiguration configuration={configuration} isOpen onClose={onClose} />
    </Dialog>,
  );
  const description = screen.getByPlaceholderText("Optional description");
  await user.clear(description);
  await user.type(description, "x");
  await user.click(screen.getByRole("button", { name: "Update" }));
  expect(await screen.findByText("taken")).toBeTruthy();
  expect(onClose).not.toHaveBeenCalled();
});

it("toasts and closes on 404", async () => {
  h.mutateAsync.mockRejectedValue({ status: 404 });
  const user = userEvent.setup();
  const onClose = vi.fn();
  render(
    <Dialog open>
      <UpdateConfiguration configuration={configuration} isOpen onClose={onClose} />
    </Dialog>,
  );
  const description = screen.getByPlaceholderText("Optional description");
  await user.clear(description);
  await user.type(description, "x");
  await user.click(screen.getByRole("button", { name: "Update" }));
  await waitFor(() => expect(h.showErrorToast).toHaveBeenCalled());
  expect(onClose).toHaveBeenCalled();
});

describe("UpdateConfiguration existing-user password and max redemptions (#645)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.isPending = false;
    h.mutateAsync.mockResolvedValue({ isSuccess: true, itemId: "cfg-1" });
  });

  const renderWith = (overrides: Partial<ISignupLinkConfiguration>) =>
    render(
      <Dialog open>
        <UpdateConfiguration
          configuration={{ ...configuration, ...overrides }}
          isOpen
          onClose={vi.fn()}
        />
      </Dialog>,
    );

  const theSwitch = () =>
    screen.getByRole("switch", { name: "Existing users must confirm their password" });
  const max = () => screen.getByTestId("default-max-redemptions") as HTMLInputElement;

  it("loads the stored values: off and 0 (H5, H9)", () => {
    renderWith({ requireExistingUserPassword: false, defaultMaxRedemptions: 0 });
    expect(theSwitch().getAttribute("aria-checked")).toBe("false");
    expect(max().value).toBe("0");
    expect(screen.getByRole("alert").textContent).toContain(
      "Anyone who can generate links from this configuration will be able to sign in as an existing user without their password.",
    );
  });

  it.each([
    ["missing", undefined],
    ["null", null],
  ])(
    "shows the switch on when the value is %s, and an empty max for null (H5, H9, C10)",
    (_, value) => {
      renderWith({ requireExistingUserPassword: value, defaultMaxRedemptions: null });
      expect(theSwitch().getAttribute("aria-checked")).toBe("true");
      expect(max().value).toBe("");
    },
  );

  it("sends the unchanged switch value with a description-only edit (H6, C5)", async () => {
    const user = userEvent.setup();
    renderWith({ requireExistingUserPassword: false, defaultMaxRedemptions: 0 });
    const description = screen.getByPlaceholderText("Optional description");
    await user.clear(description);
    await user.type(description, "only this");
    await user.click(screen.getByRole("button", { name: "Update" }));
    await waitFor(() => expect(h.mutateAsync).toHaveBeenCalledTimes(1));
    expect(h.mutateAsync).toHaveBeenCalledWith({
      itemId: "cfg-1",
      mode: "Oidc",
      description: "only this",
      requireExistingUserPassword: false,
    });
  });

  it("sends a name-only edit of a legacy configuration with the switch on (Example 5)", async () => {
    const user = userEvent.setup();
    renderWith({ requireExistingUserPassword: true });
    const name = screen.getByPlaceholderText("Partner onboarding");
    await user.clear(name);
    await user.type(name, "Renamed");
    await user.click(screen.getByRole("button", { name: "Update" }));
    await waitFor(() => expect(h.mutateAsync).toHaveBeenCalledTimes(1));
    expect(h.mutateAsync).toHaveBeenCalledWith({
      itemId: "cfg-1",
      mode: "Oidc",
      name: "Renamed",
      requireExistingUserPassword: true,
    });
  });

  it("sends 1 when a stored max is cleared (H10, Example 4)", async () => {
    const user = userEvent.setup();
    renderWith({ defaultMaxRedemptions: 5, requireExistingUserPassword: true });
    expect(max().value).toBe("5");
    await user.clear(max());
    const description = screen.getByPlaceholderText("Optional description");
    await user.clear(description);
    await user.type(description, "cleared");
    await user.click(screen.getByRole("button", { name: "Update" }));
    await waitFor(() => expect(h.mutateAsync).toHaveBeenCalledTimes(1));
    expect(h.mutateAsync).toHaveBeenCalledWith({
      itemId: "cfg-1",
      mode: "Oidc",
      description: "cleared",
      defaultMaxRedemptions: 1,
      requireExistingUserPassword: true,
    });
  });

  it("sends a changed max as a number and the toggled switch (H8)", async () => {
    const user = userEvent.setup();
    renderWith({ defaultMaxRedemptions: null });
    await user.type(max(), "0");
    await user.click(theSwitch());
    await user.click(screen.getByRole("button", { name: "Update" }));
    await waitFor(() => expect(h.mutateAsync).toHaveBeenCalledTimes(1));
    expect(h.mutateAsync).toHaveBeenCalledWith({
      itemId: "cfg-1",
      mode: "Oidc",
      defaultMaxRedemptions: 0,
      requireExistingUserPassword: false,
    });
  });

  it("blocks an invalid max with no request (C1)", async () => {
    const user = userEvent.setup();
    renderWith({ defaultMaxRedemptions: null });
    await user.type(max(), "-1");
    await user.click(screen.getByRole("button", { name: "Update" }));
    expect(await screen.findByText("Enter 0 or a whole number")).toBeTruthy();
    expect(h.mutateAsync).not.toHaveBeenCalled();
  });

  it("maps a DefaultMaxRedemptions 400 onto the field and focuses it (C4)", async () => {
    h.mutateAsync.mockRejectedValue({ status: 400, errors: { DefaultMaxRedemptions: "Bad" } });
    const user = userEvent.setup();
    renderWith({ defaultMaxRedemptions: null });
    await user.type(max(), "3");
    await user.click(screen.getByRole("button", { name: "Update" }));
    expect(await screen.findByText("Bad")).toBeTruthy();
    await waitFor(() => expect(document.activeElement).toBe(max()));
  });

  it("locks the switch and Max redemptions while saving (C8)", () => {
    h.isPending = true;
    renderWith({});
    expect((theSwitch() as HTMLButtonElement).disabled).toBe(true);
    expect(max().disabled).toBe(true);
  });
});
