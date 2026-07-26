import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ISettingsOrganizationConfig } from "@blocks-idp/settings/models/settings.model";

const h = vi.hoisted(() => ({
  mutateAsync: vi.fn(),
  isPending: false,
  showErrorToast: vi.fn(),
  showSuccessToast: vi.fn(),
}));

vi.mock("@blocks-idp/settings/hooks/use-settings-config", () => ({
  useSaveSettingsOrganizationConfig: () => ({ mutateAsync: h.mutateAsync, isPending: h.isPending }),
}));
vi.mock("@/hooks/use-toast", () => ({
  showErrorToast: h.showErrorToast,
  showSuccessToast: h.showSuccessToast,
}));

const { OrganizationConfigForm } = await import(
  "@blocks-idp/settings/components/organization-config-form"
);
const { SettingsTabActionsProvider, SettingsTabActionsSlot } = await import(
  "@blocks-idp/settings/components/settings-tab-actions"
);

const baseConfig: ISettingsOrganizationConfig = {
  itemId: "org-cfg-1",
  allowCreationFromCloud: false,
  allowCreationFromConstruct: false,
  allowOrgCreationFromSignup: false,
  allowOrgCreationFromPortal: false,
  isMultiOrgEnabled: false,
  consentForMultiOrgEnable: false,
  defaultRolesOnOrgCreation: ["member"],
  defaultPermissionsOnOrgCreation: [],
  keepOrgRolesSameAsDefaultRoles: true,
  keepOrgPermissionsSameAsDefaultPermissions: true,
};

const renderForm = (config: ISettingsOrganizationConfig = baseConfig) =>
  render(
    <SettingsTabActionsProvider>
      <SettingsTabActionsSlot activeTab="organization-config" />
      <OrganizationConfigForm config={config} />
    </SettingsTabActionsProvider>,
  );

const saveButton = () => screen.getByRole("button", { name: "Save" }) as HTMLButtonElement;
const multiOrgToggle = () =>
  screen.getByRole("switch", { name: "Multi-Organization Environment" });

describe("OrganizationConfigForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.isPending = false;
    h.mutateAsync.mockResolvedValue({ isSuccess: true });
  });

  it("hides the workflow tiles while multi-org is off and disables Save", () => {
    renderForm();
    expect(screen.queryByText("Organization Creation Workflows")).toBeNull();
    expect(saveButton().disabled).toBe(true);
  });

  it("requires confirmation before enabling multi-org and then reveals the workflows", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.click(multiOrgToggle());
    expect(await screen.findByText("Enable multi-organization mode?")).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "Enable" }));

    await waitFor(() =>
      expect(screen.getByText("Organization Creation Workflows")).toBeTruthy(),
    );
    expect(saveButton().disabled).toBe(false);
  });

  it("saves the enabled configuration with consent granted", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.click(multiOrgToggle());
    await user.click(await screen.findByRole("button", { name: "Enable" }));
    await user.click(await screen.findByRole("switch", { name: "Allow Creation from Cloud" }));

    await user.click(saveButton());
    await waitFor(() => expect(h.mutateAsync).toHaveBeenCalledTimes(1));

    const payload = h.mutateAsync.mock.calls[0][0];
    expect(payload.isMultiOrgEnabled).toBe(true);
    expect(payload.consentForMultiOrgEnable).toBe(true);
    expect(payload.allowOrgCreationFromCloud).toBe(true);
    expect(h.showSuccessToast).toHaveBeenCalledWith({
      description: "Organization configuration updated successfully",
    });
  });

  it("keeps the multi-org toggle locked once it was already enabled", () => {
    renderForm({ ...baseConfig, isMultiOrgEnabled: true, consentForMultiOrgEnable: true });
    expect((multiOrgToggle() as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText("Organization Creation Workflows")).toBeTruthy();
  });

  it("lets an unsaved enable be toggled back off without a dialog", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.click(multiOrgToggle());
    await user.click(await screen.findByRole("button", { name: "Enable" }));
    await waitFor(() => expect(screen.getByText("Organization Creation Workflows")).toBeTruthy());

    await user.click(multiOrgToggle());
    await waitFor(() =>
      expect(screen.queryByText("Organization Creation Workflows")).toBeNull(),
    );
  });

  it("surfaces a backend error when the save is unsuccessful", async () => {
    const user = userEvent.setup();
    h.mutateAsync.mockResolvedValue({ isSuccess: false, errors: { general: "bad" } });
    renderForm({ ...baseConfig, isMultiOrgEnabled: true, consentForMultiOrgEnable: true });

    await user.click(await screen.findByRole("switch", { name: "Allow Creation from Cloud" }));
    await user.click(saveButton());

    await waitFor(() =>
      expect(h.showErrorToast).toHaveBeenCalledWith({ errors: { general: "bad" } }),
    );
  });

  it("shows a generic error when the save throws", async () => {
    const user = userEvent.setup();
    h.mutateAsync.mockRejectedValue(new Error("boom"));
    renderForm({ ...baseConfig, isMultiOrgEnabled: true, consentForMultiOrgEnable: true });

    await user.click(await screen.findByRole("switch", { name: "Allow Creation from Cloud" }));
    await user.click(saveButton());

    await waitFor(() =>
      expect(h.showErrorToast).toHaveBeenCalledWith({ errors: "Something went wrong" }),
    );
  });

  it("restores the saved values on Reset", async () => {
    const user = userEvent.setup();
    renderForm({ ...baseConfig, isMultiOrgEnabled: true, consentForMultiOrgEnable: true });

    const cloud = await screen.findByRole("switch", { name: "Allow Creation from Cloud" });
    await user.click(cloud);
    expect(cloud.getAttribute("aria-checked")).toBe("true");

    await user.click(screen.getByRole("button", { name: "Reset" }));
    expect(cloud.getAttribute("aria-checked")).toBe("false");
    expect(saveButton().disabled).toBe(true);
  });
});
