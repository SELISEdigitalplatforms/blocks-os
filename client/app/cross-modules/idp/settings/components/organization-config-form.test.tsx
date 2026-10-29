import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ISettingsOrganizationConfig } from "@blocks-idp/settings/models/settings.model";

const h = vi.hoisted(() => ({
  mutateAsync: vi.fn(),
  isPending: false,
  showErrorToast: vi.fn(),
  showSuccessToast: vi.fn(),
  comboboxRenders: 0,
  comboboxProps: undefined as undefined | Record<string, unknown>,
}));

vi.mock("@blocks-idp/settings/hooks/use-settings-config", () => ({
  useSaveSettingsOrganizationConfig: () => ({ mutateAsync: h.mutateAsync, isPending: h.isPending }),
}));
vi.mock("@seliseblocks/genesis-os", () => ({
  useProjectStore: () => ({ selectedProject: { tenantId: "tenant-1" } }),
}));
vi.mock("@blocks-idp/iam/components/organization-combobox", () => ({
  OrganizationCombobox: (props: {
    value: string;
    projectKey: string;
    excludeNotEnabled?: boolean;
    onValueChange: (id: string) => void;
  }) => {
    h.comboboxRenders += 1;
    h.comboboxProps = props;
    return (
      <div data-testid="org-picker" data-value={props.value}>
        <button type="button" onClick={() => props.onValueChange("default")}>
          pick-default
        </button>
        <button type="button" onClick={() => props.onValueChange("org-sales")}>
          pick-sales
        </button>
      </div>
    );
  },
}));
vi.mock("@/hooks/use-toast", () => ({
  showErrorToast: h.showErrorToast,
  showSuccessToast: h.showSuccessToast,
}));

const { OrganizationConfigForm } =
  await import("@blocks-idp/settings/components/organization-config-form");
const { SettingsTabActionsProvider, SettingsTabActionsSlot } =
  await import("@blocks-idp/settings/components/settings-tab-actions");

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
  isSignupAutoJoinEnabled: false,
  signupAutoJoinOrganizationId: null,
};

const renderForm = (config: ISettingsOrganizationConfig = baseConfig) =>
  render(
    <SettingsTabActionsProvider>
      <SettingsTabActionsSlot activeTab="organization-config" />
      <OrganizationConfigForm config={config} />
    </SettingsTabActionsProvider>,
  );

const saveButton = () => screen.getByRole("button", { name: "Save" }) as HTMLButtonElement;
const multiOrgToggle = () => screen.getByRole("switch", { name: "Multi-Organization Environment" });

describe("OrganizationConfigForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.isPending = false;
    h.comboboxRenders = 0;
    h.comboboxProps = undefined;
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

    await waitFor(() => expect(screen.getByText("Organization Creation Workflows")).toBeTruthy());
    expect(saveButton().disabled).toBe(false);
  });

  it("saves the enabled configuration with consent granted", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.click(multiOrgToggle());
    await user.click(await screen.findByRole("button", { name: "Enable" }));
    await user.click(await screen.findByRole("switch", { name: "Allow Creation from OS" }));

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
    await waitFor(() => expect(screen.queryByText("Organization Creation Workflows")).toBeNull());
  });

  it("surfaces a backend error when the save is unsuccessful", async () => {
    const user = userEvent.setup();
    h.mutateAsync.mockResolvedValue({ isSuccess: false, errors: { general: "bad" } });
    renderForm({ ...baseConfig, isMultiOrgEnabled: true, consentForMultiOrgEnable: true });

    await user.click(await screen.findByRole("switch", { name: "Allow Creation from OS" }));
    await user.click(saveButton());

    await waitFor(() =>
      expect(h.showErrorToast).toHaveBeenCalledWith(
        expect.objectContaining({ errors: { general: "bad" } }),
      ),
    );
  });

  it("shows a generic error when the save throws", async () => {
    const user = userEvent.setup();
    h.mutateAsync.mockRejectedValue(new Error("boom"));
    renderForm({ ...baseConfig, isMultiOrgEnabled: true, consentForMultiOrgEnable: true });

    await user.click(await screen.findByRole("switch", { name: "Allow Creation from OS" }));
    await user.click(saveButton());

    await waitFor(() =>
      expect(h.showErrorToast).toHaveBeenCalledWith({ errors: "Something went wrong" }),
    );
  });

  it("restores the saved values on Reset", async () => {
    const user = userEvent.setup();
    renderForm({ ...baseConfig, isMultiOrgEnabled: true, consentForMultiOrgEnable: true });

    const cloud = await screen.findByRole("switch", { name: "Allow Creation from OS" });
    await user.click(cloud);
    expect(cloud.getAttribute("aria-checked")).toBe("true");

    await user.click(screen.getByRole("button", { name: "Reset" }));
    expect(cloud.getAttribute("aria-checked")).toBe("false");
    expect(saveButton().disabled).toBe(true);
  });

  describe("signup auto-join", () => {
    const multiOrg = { ...baseConfig, isMultiOrgEnabled: true, consentForMultiOrgEnable: true };
    const autoJoinToggle = () =>
      screen.getByRole("switch", { name: "Add new sign-ups to an organization" });

    it("renders the card right after multi-org and disables it while multi-org is off", () => {
      renderForm({
        ...baseConfig,
        isSignupAutoJoinEnabled: true,
        signupAutoJoinOrganizationId: "org-sales",
      });
      const switches = screen.getAllByRole("switch").map((s) => s.getAttribute("aria-label"));
      expect(switches.slice(0, 2)).toEqual([
        "Multi-Organization Environment",
        "Add new sign-ups to an organization",
      ]);
      expect((autoJoinToggle() as HTMLButtonElement).disabled).toBe(true);
      expect(autoJoinToggle().getAttribute("aria-checked")).toBe("true");
      expect(screen.queryByTestId("org-picker")).toBeNull();
      expect(h.comboboxRenders).toBe(0);
    });

    it("reveals the picker, warns on Default and saves the chosen organization", async () => {
      const user = userEvent.setup();
      renderForm(multiOrg);
      expect(screen.queryByTestId("org-picker")).toBeNull();

      await user.click(autoJoinToggle());
      expect(await screen.findByText("Organization for new sign-ups")).toBeTruthy();
      expect(
        screen.getByText("Sign-ups fail if this organization is deleted or disabled."),
      ).toBeTruthy();
      expect(h.comboboxProps).toMatchObject({ projectKey: "tenant-1", excludeNotEnabled: true });

      await user.click(screen.getByRole("button", { name: "pick-default" }));
      expect(await screen.findByText("New users get tenant-wide access")).toBeTruthy();

      await user.click(screen.getByRole("button", { name: "pick-sales" }));
      await waitFor(() =>
        expect(screen.queryByText("New users get tenant-wide access")).toBeNull(),
      );

      await user.click(saveButton());
      await waitFor(() => expect(h.mutateAsync).toHaveBeenCalledTimes(1));
      expect(h.mutateAsync.mock.calls[0][0]).toMatchObject({
        isSignupAutoJoinEnabled: true,
        signupAutoJoinOrganizationId: "org-sales",
      });
    });

    it("blocks the save with an inline message when no organization is chosen", async () => {
      const user = userEvent.setup();
      renderForm(multiOrg);
      await user.click(autoJoinToggle());
      await user.click(saveButton());
      expect(await screen.findByText("Choose the organization new sign-ups join.")).toBeTruthy();
      expect(h.mutateAsync).not.toHaveBeenCalled();
    });

    it("omits the target when saving with the toggle off and restores it on Reset", async () => {
      const user = userEvent.setup();
      renderForm({
        ...multiOrg,
        isSignupAutoJoinEnabled: true,
        signupAutoJoinOrganizationId: "org-sales",
      });
      expect(screen.getByTestId("org-picker").getAttribute("data-value")).toBe("org-sales");

      await user.click(autoJoinToggle());
      expect(screen.queryByTestId("org-picker")).toBeNull();
      await user.click(screen.getByRole("button", { name: "Reset" }));
      expect(screen.getByTestId("org-picker").getAttribute("data-value")).toBe("org-sales");

      await user.click(autoJoinToggle());
      await user.click(saveButton());
      await waitFor(() => expect(h.mutateAsync).toHaveBeenCalledTimes(1));
      const payload = h.mutateAsync.mock.calls[0][0];
      expect(payload.isSignupAutoJoinEnabled).toBe(false);
      expect(payload).not.toHaveProperty("signupAutoJoinOrganizationId");

      await user.click(autoJoinToggle());
      expect(screen.getByTestId("org-picker").getAttribute("data-value")).toBe("org-sales");
    });

    it("maps IAM auto-join errors to readable toasts", async () => {
      const user = userEvent.setup();
      h.mutateAsync.mockResolvedValue({
        isSuccess: false,
        errors: { signup_organization_unavailable: "x" },
      });
      renderForm({
        ...multiOrg,
        isSignupAutoJoinEnabled: true,
        signupAutoJoinOrganizationId: "org-sales",
      });
      await user.click(screen.getByRole("switch", { name: "Allow Creation from OS" }));
      await user.click(saveButton());
      await waitFor(() => expect(h.showErrorToast).toHaveBeenCalledTimes(1));
      const arg = h.showErrorToast.mock.calls[0][0];
      expect(arg.customMessages).toMatchObject({
        signup_auto_join_organization_required: "Choose the organization new sign-ups join.",
        signup_organization_unavailable:
          "That organization doesn't exist or is disabled. Choose another.",
      });
      expect(saveButton().disabled).toBe(false);
    });

    it("passes custom messages for thrown errors that carry errors", async () => {
      const user = userEvent.setup();
      h.mutateAsync.mockRejectedValue({ errors: { signup_auto_join_organization_required: "x" } });
      renderForm(multiOrg);
      await user.click(screen.getByRole("switch", { name: "Allow Creation from OS" }));
      await user.click(saveButton());
      await waitFor(() => expect(h.showErrorToast).toHaveBeenCalledTimes(1));
      expect(h.showErrorToast.mock.calls[0][0].customMessages).toBeDefined();
    });
  });
});
