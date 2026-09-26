import { beforeEach, describe, expect, it, vi } from "vitest";
import { authClientService } from "@blocks-idp/authentication/services/auth-clients.service";
import { permissionService } from "@blocks-idp/iam/services/permission.service";
import { roleService } from "@blocks-idp/iam/services/role.service";
import { IConnectTemplate } from "@/cross-modules/connect/models/connect.model";
import { connectService } from "@/cross-modules/connect/services/connect.service";
import { ConnectSetupError, runConnectSetup } from "./connect-setup.runner";

vi.mock("@blocks-idp/iam/services/role.service", () => ({
  roleService: { getRoles: vi.fn(), addRole: vi.fn(), getRoleById: vi.fn(), setRoles: vi.fn() },
}));
vi.mock("@blocks-idp/iam/services/permission.service", () => ({
  permissionService: { getPermissions: vi.fn() },
}));
vi.mock("@blocks-idp/authentication/services/auth-clients.service", () => ({
  authClientService: { clients: { list: vi.fn(), save: vi.fn() } },
}));
vi.mock("@/cross-modules/connect/services/connect.service", () => ({
  connectService: { saveSetup: vi.fn() },
}));

const template: IConnectTemplate = {
  itemId: "t-1",
  key: "localization",
  displayName: "Blocks Localization",
  roleName: "Localization Connect",
  roleSlug: "localization-connect",
  roleDescription: "desc",
  permissions: ["blocks-localization::key::gets", "blocks-localization::key::save"],
  clientCredentialName: "Blocks Localization Connect",
  accessTokenValidForNumberMinutes: 60,
  isActive: true,
};

const role = { itemId: "role-1", slug: "localization-connect", organizationId: "default" };
const credential = {
  itemId: "client-1",
  name: "Blocks Localization Connect",
  clientSecret: "blxk_secret",
  roles: ["localization-connect"],
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

describe("runConnectSetup", () => {
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
    vi.mocked(connectService.saveSetup).mockResolvedValue({ isSuccess: true, itemId: "connect" });
  });

  it("creates the role, assigns the resolved permission ids, issues a credential and records it", async () => {
    const steps: string[] = [];

    const result = await runConnectSetup({
      template,
      projectKey: "tenant-1",
      onStep: (s) => steps.push(s),
    });

    expect(roleService.addRole).toHaveBeenCalledWith({
      name: "Localization Connect",
      slug: "localization-connect",
      description: "desc",
    });
    expect(roleService.setRoles).toHaveBeenCalledWith({
      slug: "localization-connect",
      addPermissions: ["p-1", "p-2"],
      removePermissions: [],
      organizationId: "default",
    });
    expect(authClientService.clients.save).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Blocks Localization Connect",
        roles: ["localization-connect"],
        accessTokenValidForNumberMinutes: 60,
      }),
    );
    expect(connectService.saveSetup).toHaveBeenCalledWith({
      templateKey: "localization",
      roleId: "role-1",
      roleSlug: "localization-connect",
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

    const run = runConnectSetup({ template, projectKey: "tenant-1" });

    await expect(run).rejects.toBeInstanceOf(ConnectSetupError);
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

    await runConnectSetup({ template, projectKey: "tenant-1" });

    expect(roleService.addRole).not.toHaveBeenCalled();
    expect(authClientService.clients.save).not.toHaveBeenCalled();
    expect(connectService.saveSetup).toHaveBeenCalledWith(
      expect.objectContaining({ roleId: "role-1", clientCredentialId: "client-1" }),
    );
  });

  it("finds a role with an organization-suffixed slug again by its name", async () => {
    const orgRole = {
      itemId: "role-2",
      name: "Localization Connect",
      slug: "localization-connect_abcd1234",
      organizationId: "org-1",
    };
    vi.mocked(roleService.getRoles)
      .mockResolvedValueOnce({ data: [], errors: null, totalCount: 0 })
      .mockResolvedValueOnce({ data: [orgRole], errors: null, totalCount: 1 } as never);
    vi.mocked(authClientService.clients.list)
      .mockReset()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ ...credential, roles: [orgRole.slug] }] as never);

    await runConnectSetup({ template, projectKey: "tenant-1" });

    expect(roleService.getRoles).toHaveBeenLastCalledWith(
      expect.objectContaining({ filter: { search: "^Localization Connect$" } }),
    );
    expect(roleService.addRole).not.toHaveBeenCalled();
    expect(roleService.setRoles).toHaveBeenCalledWith(
      expect.objectContaining({ slug: orgRole.slug, organizationId: "org-1" }),
    );
    expect(connectService.saveSetup).toHaveBeenCalledWith(
      expect.objectContaining({ roleId: "role-2", roleSlug: orgRole.slug }),
    );
  });

  it("refuses to reuse a same-named credential that grants other access", async () => {
    vi.mocked(authClientService.clients.list)
      .mockReset()
      .mockResolvedValue([{ ...credential, roles: ["admin"], permissions: [] }] as never);

    await expect(runConnectSetup({ template, projectKey: "tenant-1" })).rejects.toMatchObject({
      step: "create-credential",
    });
    expect(authClientService.clients.save).not.toHaveBeenCalled();
    expect(connectService.saveSetup).not.toHaveBeenCalled();
  });

  it("fails at role creation when the created role cannot be read back", async () => {
    vi.mocked(roleService.getRoleById).mockResolvedValue({ data: null, errors: null } as never);

    await expect(runConnectSetup({ template, projectKey: "tenant-1" })).rejects.toMatchObject({
      step: "create-role",
    });
    expect(roleService.setRoles).not.toHaveBeenCalled();
  });

  it("confirms a duplicate role name when IAM asks for it", async () => {
    vi.mocked(roleService.addRole)
      .mockResolvedValueOnce({ isSuccess: false, requiresDuplicateNameConfirmation: true })
      .mockResolvedValueOnce({ isSuccess: true, itemId: "role-1" });

    await runConnectSetup({ template, projectKey: "tenant-1" });

    expect(roleService.addRole).toHaveBeenLastCalledWith(
      expect.objectContaining({ confirmDuplicateName: true }),
    );
  });

  it("tags an IAM failure with the step it happened in", async () => {
    vi.mocked(roleService.setRoles).mockRejectedValue(new Error("403"));

    await expect(runConnectSetup({ template, projectKey: "tenant-1" })).rejects.toMatchObject({
      step: "assign-permissions",
    });
    expect(connectService.saveSetup).not.toHaveBeenCalled();
  });
});
