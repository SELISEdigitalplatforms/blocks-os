import { beforeEach, describe, expect, it, vi } from "vitest";
import { authClientService } from "@blocks-idp/authentication/services/auth-clients.service";
import { permissionService } from "@blocks-idp/iam/services/permission.service";
import { roleService } from "@blocks-idp/iam/services/role.service";
import { IIntegrationTemplate } from "@/cross-modules/integration/models/integration.model";
import { integrationService } from "@/cross-modules/integration/services/integration.service";
import { IntegrationSetupError, runIntegrationSetup } from "./integration-setup.runner";

vi.mock("@blocks-idp/iam/services/role.service", () => ({
  roleService: { getRoles: vi.fn(), addRole: vi.fn(), getRoleById: vi.fn(), setRoles: vi.fn() },
}));
vi.mock("@blocks-idp/iam/services/permission.service", () => ({
  permissionService: { getPermissions: vi.fn() },
}));
vi.mock("@blocks-idp/authentication/services/auth-clients.service", () => ({
  authClientService: { clients: { list: vi.fn(), save: vi.fn() } },
}));
vi.mock("@/cross-modules/integration/services/integration.service", () => ({
  integrationService: { saveSetup: vi.fn() },
}));

const template: IIntegrationTemplate = {
  itemId: "t-1",
  key: "localization",
  displayName: "Blocks Localization",
  roleName: "Localization Integration",
  roleSlug: "localization-integration",
  roleDescription: "desc",
  permissions: ["blocks-localization::key::gets", "blocks-localization::key::save"],
  clientCredentialName: "Blocks Localization Integration",
  accessTokenValidForNumberMinutes: 60,
  isActive: true,
};

const role = { itemId: "role-1", slug: "localization-integration", organizationId: "default" };
const credential = {
  itemId: "client-1",
  name: "Blocks Localization Integration",
  clientSecret: "blxk_secret",
  roles: ["localization-integration"],
  permissions: [],
  createdDate: "2026-09-25T00:00:00Z",
};

const mockPermissionsFound = () =>
  vi.mocked(permissionService.getPermissions).mockResolvedValue({
    data: [
      { itemId: "p-1", resource: "blocks-localization::key::gets" },
      { itemId: "p-2", resource: "blocks-localization::key::save" },
    ],
    totalCount: 2,
  } as never);

describe("runIntegrationSetup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPermissionsFound();
    vi.mocked(roleService.getRoles).mockResolvedValue({ data: [], errors: null, totalCount: 0 });
    vi.mocked(roleService.addRole).mockResolvedValue({ isSuccess: true, itemId: "role-1" });
    vi.mocked(roleService.getRoleById).mockResolvedValue({ data: role, errors: null } as never);
    vi.mocked(roleService.setRoles).mockResolvedValue({ isSuccess: true } as never);
    vi.mocked(authClientService.clients.list)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([credential] as never);
    vi.mocked(authClientService.clients.save).mockResolvedValue({ isSuccess: true } as never);
    vi.mocked(integrationService.saveSetup).mockResolvedValue({ isSuccess: true, itemId: "integration" });
  });

  it("creates the role, assigns the resolved permission ids, issues a credential and records it", async () => {
    const steps: string[] = [];

    const result = await runIntegrationSetup({
      template,
      projectKey: "tenant-1",
      onStep: (s) => steps.push(s),
    });

    expect(roleService.addRole).toHaveBeenCalledWith({
      name: "Localization Integration",
      slug: "localization-integration",
      description: "desc",
    });
    expect(roleService.setRoles).toHaveBeenCalledWith({
      slug: "localization-integration",
      addPermissions: ["p-1", "p-2"],
      removePermissions: [],
      organizationId: "default",
    });
    expect(authClientService.clients.save).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Blocks Localization Integration",
        roles: ["localization-integration"],
        accessTokenValidForNumberMinutes: 60,
      }),
    );
    expect(integrationService.saveSetup).toHaveBeenCalledWith({
      templateKey: "localization",
      roleId: "role-1",
      roleSlug: "localization-integration",
      clientCredentialId: "client-1",
    });
    expect(result.clientCredentialId).toBe("client-1");
    expect(steps).toEqual([
      "resolve-permissions",
      "create-role",
      "assign-permissions",
      "create-credential",
      "save-setup",
    ]);
  });

  it("stops before creating anything when a template permission is missing", async () => {
    vi.mocked(permissionService.getPermissions).mockResolvedValue({
      data: [{ itemId: "p-1", resource: "blocks-localization::key::gets" }],
      totalCount: 1,
    } as never);

    const run = runIntegrationSetup({ template, projectKey: "tenant-1" });

    await expect(run).rejects.toBeInstanceOf(IntegrationSetupError);
    await expect(run).rejects.toMatchObject({ step: "resolve-permissions" });
    expect(roleService.addRole).not.toHaveBeenCalled();
  });

  it("reuses a role and credential left by an interrupted run", async () => {
    vi.mocked(roleService.getRoles).mockResolvedValue({
      data: [role],
      errors: null,
      totalCount: 1,
    } as never);
    vi.mocked(authClientService.clients.list).mockReset().mockResolvedValue([credential] as never);

    await runIntegrationSetup({ template, projectKey: "tenant-1" });

    expect(roleService.addRole).not.toHaveBeenCalled();
    expect(authClientService.clients.save).not.toHaveBeenCalled();
    expect(integrationService.saveSetup).toHaveBeenCalledWith(
      expect.objectContaining({ roleId: "role-1", clientCredentialId: "client-1" }),
    );
  });

  it("finds a role with an organization-suffixed slug again by its name", async () => {
    const orgRole = {
      itemId: "role-2",
      name: "Localization Integration",
      slug: "localization-integration_abcd1234",
      organizationId: "org-1",
    };
    vi.mocked(roleService.getRoles)
      .mockResolvedValueOnce({ data: [], errors: null, totalCount: 0 })
      .mockResolvedValueOnce({ data: [orgRole], errors: null, totalCount: 1 } as never);
    vi.mocked(authClientService.clients.list)
      .mockReset()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ ...credential, roles: [orgRole.slug] }] as never);

    await runIntegrationSetup({ template, projectKey: "tenant-1" });

    expect(roleService.getRoles).toHaveBeenLastCalledWith(
      expect.objectContaining({ filter: { search: "^Localization Integration$" } }),
    );
    expect(roleService.addRole).not.toHaveBeenCalled();
    expect(roleService.setRoles).toHaveBeenCalledWith(
      expect.objectContaining({ slug: orgRole.slug, organizationId: "org-1" }),
    );
    expect(integrationService.saveSetup).toHaveBeenCalledWith(
      expect.objectContaining({ roleId: "role-2", roleSlug: orgRole.slug }),
    );
  });

  it("refuses to reuse a same-named credential that grants other access", async () => {
    vi.mocked(authClientService.clients.list)
      .mockReset()
      .mockResolvedValue([{ ...credential, roles: ["admin"], permissions: [] }] as never);

    await expect(runIntegrationSetup({ template, projectKey: "tenant-1" })).rejects.toMatchObject({
      step: "create-credential",
    });
    expect(authClientService.clients.save).not.toHaveBeenCalled();
    expect(integrationService.saveSetup).not.toHaveBeenCalled();
  });

  it("fails at role creation when the created role cannot be read back", async () => {
    vi.mocked(roleService.getRoleById).mockResolvedValue({ data: null, errors: null } as never);

    await expect(runIntegrationSetup({ template, projectKey: "tenant-1" })).rejects.toMatchObject({
      step: "create-role",
    });
    expect(roleService.setRoles).not.toHaveBeenCalled();
  });

  it("confirms a duplicate role name when IAM asks for it", async () => {
    vi.mocked(roleService.addRole)
      .mockResolvedValueOnce({ isSuccess: false, requiresDuplicateNameConfirmation: true })
      .mockResolvedValueOnce({ isSuccess: true, itemId: "role-1" });

    await runIntegrationSetup({ template, projectKey: "tenant-1" });

    expect(roleService.addRole).toHaveBeenLastCalledWith(
      expect.objectContaining({ confirmDuplicateName: true }),
    );
  });

  it("tags an IAM failure with the step it happened in", async () => {
    vi.mocked(roleService.setRoles).mockRejectedValue(new Error("403"));

    await expect(runIntegrationSetup({ template, projectKey: "tenant-1" })).rejects.toMatchObject({
      step: "assign-permissions",
    });
    expect(integrationService.saveSetup).not.toHaveBeenCalled();
  });
});
