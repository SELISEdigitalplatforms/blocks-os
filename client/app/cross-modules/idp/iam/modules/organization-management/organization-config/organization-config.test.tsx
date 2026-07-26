import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { IOrganizationConfigResponse } from "@blocks-idp/iam/models/organization-config.model";

const h = vi.hoisted(() => ({
  saveConfig: vi.fn(),
  isSaving: false,
  tenantId: "tenant-1",
  roles: [] as { name: string; slug: string }[],
  isRolesLoading: false,
  showErrorToast: vi.fn(),
  showSuccessToast: vi.fn(),
}));

vi.mock("@seliseblocks/blocks-kit", () => ({
  useProjectStore: () => ({ selectedProject: { tenantId: h.tenantId } }),
}));
vi.mock("@blocks-idp/iam/hooks/use-organization", () => ({
  useSaveOrganizationConfig: () => ({ mutateAsync: h.saveConfig, isPending: h.isSaving }),
}));
vi.mock("@blocks-idp/iam/hooks/use-roles", () => ({
  useGetRoles: () => ({ data: { data: h.roles }, isLoading: h.isRolesLoading }),
}));
vi.mock("@/hooks/use-toast", () => ({
  showErrorToast: h.showErrorToast,
  showSuccessToast: h.showSuccessToast,
}));

import { OrganizationConfig } from "./organization-config";

const baseConfig = (over: Partial<IOrganizationConfigResponse> = {}): IOrganizationConfigResponse =>
  ({
    itemId: "cfg-1",
    createdDate: "",
    lastUpdatedDate: "",
    createdBy: "",
    language: "en",
    lastUpdatedBy: "",
    organizationIds: [],
    tags: [],
    allowCreationFromCloud: true,
    allowCreationFromConstruct: false,
    isMultiOrgEnabled: false,
    allowOrgCreationFromSignup: false,
    allowOrgCreationFromPortal: false,
    defaultRoleOnOrgCreation: [],
    defaultPermissionOnOrgCreation: [],
    keepOrgRolesSameAsDefaultRoles: true,
    keepOrgPermissionsSameAsDefaultPermissions: true,
    consentForMultiOrgEnable: false,
    ...over,
  }) as IOrganizationConfigResponse;

const openDialog = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(screen.getByRole("button", { name: /Configure Organization/i }));
};

describe("OrganizationConfig", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.isSaving = false;
    h.tenantId = "tenant-1";
    h.roles = [];
    h.isRolesLoading = false;
    h.saveConfig.mockResolvedValue({ isSuccess: true });
  });

  it("opens the dialog and shows the loading placeholder while data loads", async () => {
    const user = userEvent.setup();
    render(<OrganizationConfig configData={null} isLoading />);
    await openDialog(user);

    expect(await screen.findByText("Organization Configuration")).toBeTruthy();
    expect(screen.getByText("Loading...")).toBeTruthy();
  });

  it("reveals cloud/construct sub-options when multi-org is enabled", async () => {
    const user = userEvent.setup();
    render(<OrganizationConfig configData={baseConfig()} isLoading={false} />);
    await openDialog(user);

    expect(screen.queryByText("Allow Creation From Cloud")).toBeNull();
    await user.click(screen.getByLabelText("Enable Multi-Organization"));
    expect(await screen.findByText("Allow Creation From Cloud")).toBeTruthy();
    expect(screen.getByText("Allow Creation From Construct")).toBeTruthy();
  });

  it("saves with default flags when multi-org is turned off", async () => {
    const user = userEvent.setup();
    // start from an enabled config, then disable multi-org so the form is dirty
    render(<OrganizationConfig configData={baseConfig({ isMultiOrgEnabled: true })} isLoading={false} />);
    await openDialog(user);

    await user.click(screen.getByLabelText("Enable Multi-Organization"));

    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(h.saveConfig).toHaveBeenCalledTimes(1));
    expect(h.saveConfig).toHaveBeenCalledWith(
      expect.objectContaining({
        isMultiOrgEnabled: false,
        allowOrgCreationFromCloud: true,
        allowOrgCreationFromConstruct: false,
        defaultRolesOnOrgCreation: [],
      }),
    );
    expect(h.showSuccessToast).toHaveBeenCalledWith({
      description: "Organization config saved successfully",
    });
  });

  it("passes through the enabled multi-org flag on save", async () => {
    const user = userEvent.setup();
    render(<OrganizationConfig configData={baseConfig()} isLoading={false} />);
    await openDialog(user);

    await user.click(screen.getByLabelText("Enable Multi-Organization"));
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(h.saveConfig).toHaveBeenCalledTimes(1));
    expect(h.saveConfig.mock.calls[0][0].isMultiOrgEnabled).toBe(true);
  });

  it("surfaces a backend error when the save is unsuccessful", async () => {
    const user = userEvent.setup();
    h.saveConfig.mockResolvedValue({ isSuccess: false, errors: "nope" });
    render(<OrganizationConfig configData={baseConfig()} isLoading={false} />);
    await openDialog(user);

    const toggle = screen.getByLabelText("Enable Multi-Organization");
    await user.click(toggle);
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(h.showErrorToast).toHaveBeenCalledWith({ errors: "nope" }));
    expect(h.showSuccessToast).not.toHaveBeenCalled();
  });

  it("shows an error toast when the save throws an object with errors", async () => {
    const user = userEvent.setup();
    h.saveConfig.mockRejectedValue({ errors: "boom" });
    render(<OrganizationConfig configData={baseConfig()} isLoading={false} />);
    await openDialog(user);

    const toggle = screen.getByLabelText("Enable Multi-Organization");
    await user.click(toggle);
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(h.showErrorToast).toHaveBeenCalledWith({ errors: "boom" }));
  });

  it("keeps the Save button disabled until the form is dirty", async () => {
    const user = userEvent.setup();
    render(<OrganizationConfig configData={baseConfig()} isLoading={false} />);
    await openDialog(user);

    expect((screen.getByRole("button", { name: "Save" }) as HTMLButtonElement).disabled).toBe(true);
    await user.click(screen.getByLabelText("Enable Multi-Organization"));
    expect((screen.getByRole("button", { name: "Save" }) as HTMLButtonElement).disabled).toBe(false);
  });
});
