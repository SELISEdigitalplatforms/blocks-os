import { authClientService } from "@blocks-idp/authentication/services/auth-clients.service";
import { IClientCredentialsConfig } from "@blocks-idp/authentication/models/auth.oidc.model";
import { IRole } from "@blocks-idp/iam/models/role";
import { permissionService } from "@blocks-idp/iam/services/permission.service";
import { roleService } from "@blocks-idp/iam/services/role.service";
import { IConnectSetup, IConnectTemplate } from "@/cross-modules/connect/models/connect.model";
import { connectService } from "@/cross-modules/connect/services/connect.service";

export type ConnectSetupStep =
  "resolve-permissions" | "create-role" | "assign-permissions" | "create-credential" | "save-setup";

export const CONNECT_SETUP_STEP_LABELS: Record<ConnectSetupStep, string> = {
  "resolve-permissions": "Resolving permissions",
  "create-role": "Creating role",
  "assign-permissions": "Assigning permissions",
  "create-credential": "Creating client credential",
  "save-setup": "Saving setup",
};

/** A failure tagged with the step it happened in, so the toast can say where setup stopped. */
export class ConnectSetupError extends Error {
  constructor(
    readonly step: ConnectSetupStep,
    message: string,
    readonly cause?: unknown,
  ) {
    super(message);
    this.name = "ConnectSetupError";
  }
}

type RunOptions = {
  template: IConnectTemplate;
  projectKey: string;
  onStep?: (step: ConnectSetupStep) => void;
};

const errorText = (errors: unknown): string => {
  if (!errors) return "";
  if (typeof errors === "string") return errors;
  if (typeof errors === "object") return Object.values(errors as Record<string, unknown>).join(" ");
  return String(errors);
};

async function step<T>(
  name: ConnectSetupStep,
  onStep: RunOptions["onStep"],
  run: () => Promise<T>,
) {
  onStep?.(name);
  try {
    return await run();
  } catch (error) {
    if (error instanceof ConnectSetupError) throw error;
    throw new ConnectSetupError(name, `${CONNECT_SETUP_STEP_LABELS[name]} failed.`, error);
  }
}

/**
 * Permission ids differ per project, so the template names permissions by resource and they are
 * resolved here. Any the project does not have stops setup rather than silently issuing a
 * credential that is missing access.
 */
async function resolvePermissionIds(template: IConnectTemplate, projectKey: string) {
  const response = await permissionService.getPermissions({
    page: 0,
    pageSize: Math.max(template.permissions.length, 1) * 2,
    roles: [],
    projectKey,
    filter: { search: "", isBuiltIn: "", resources: template.permissions },
  });

  const byResource = new Map(
    (response.data ?? []).map((permission) => [
      permission.resource.toLowerCase(),
      permission.itemId,
    ]),
  );
  const missing = template.permissions.filter((r) => !byResource.has(r.toLowerCase()));
  if (missing.length > 0) {
    throw new ConnectSetupError(
      "resolve-permissions",
      `These permissions do not exist in this project: ${missing.join(", ")}`,
    );
  }
  return template.permissions.map((r) => byResource.get(r.toLowerCase()) as string);
}

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

async function findExistingRole(
  template: IConnectTemplate,
  projectKey: string,
): Promise<IRole | undefined> {
  const bySlug = await roleService.getRoles({
    filter: { slugs: [template.roleSlug] },
    page: 0,
    pageSize: 1,
    projectKey,
  });
  const slugMatch = bySlug.data?.find((role) => role.slug === template.roleSlug);
  if (slugMatch) return slugMatch;

  // Outside the default organization IAM stores the slug with an organization suffix, so the
  // template slug never matches there. IAM keeps role names unique within an organization, so
  // the role is found again by its name instead.
  const roleName = template.roleName.trim().toLowerCase();
  const byName = await roleService.getRoles({
    filter: { search: `^${escapeRegex(template.roleName.trim())}$` },
    page: 0,
    pageSize: 10,
    projectKey,
  });
  return byName.data?.find((role) => role.name.trim().toLowerCase() === roleName);
}

/**
 * Reuses the role when a previous, interrupted setup already created it, so running setup again
 * finishes the job instead of failing on the taken name or slug.
 */
async function ensureRole(template: IConnectTemplate, projectKey: string): Promise<IRole> {
  const found = await findExistingRole(template, projectKey);
  if (found) return found;

  const payload = {
    name: template.roleName,
    slug: template.roleSlug,
    description: template.roleDescription ?? "",
  };
  let created = await roleService.addRole(payload);
  // Multi-org tenants ask once before a second role shares a name with another organization's.
  if (!created.isSuccess && created.requiresDuplicateNameConfirmation) {
    created = await roleService.addRole({ ...payload, confirmDuplicateName: true });
  }
  if (!created.isSuccess || !created.itemId) {
    throw new ConnectSetupError(
      "create-role",
      errorText(created.errors) || "The role could not be created.",
    );
  }

  // IAM derives the stored slug itself, so read back the one actually in effect.
  const role = await roleService.getRoleById({ id: created.itemId, projectKey });
  if (!role?.data?.slug) {
    throw new ConnectSetupError("create-role", "The role was created but could not be read back.");
  }
  return role.data;
}

const findCredential = (credentials: IClientCredentialsConfig[], name: string) =>
  credentials
    .filter((credential) => credential.name === name)
    .sort((a, b) => (b.createdDate ?? "").localeCompare(a.createdDate ?? ""))[0];

/** Whether the credential grants exactly the Connect role, as one created by setup does. */
const hasOnlyRole = (credential: IClientCredentialsConfig, roleSlug: string) =>
  (credential.roles ?? []).length === 1 &&
  credential.roles[0].toLowerCase() === roleSlug.toLowerCase() &&
  (credential.permissions ?? []).length === 0;

/**
 * Creating a credential does not return its id, and IAM treats a caller-supplied id as an
 * update, so the new credential is found again by its name. A credential left behind by an
 * interrupted setup is reused the same way, but only when it grants exactly the Connect role:
 * one with the same name and other access was not made by setup, and handing out its secret
 * would give the wrong access.
 */
async function ensureCredential(
  template: IConnectTemplate,
  roleSlug: string,
  projectKey: string,
): Promise<IClientCredentialsConfig> {
  const before = findCredential(
    await authClientService.clients.list({ projectKey }),
    template.clientCredentialName,
  );
  if (before) {
    if (hasOnlyRole(before, roleSlug)) return before;
    throw new ConnectSetupError(
      "create-credential",
      `A client credential named "${template.clientCredentialName}" already exists with different access. Rename or delete it, then run setup again.`,
    );
  }

  const saved = await authClientService.clients.save({
    name: template.clientCredentialName,
    isActive: true,
    accessTokenValidForNumberMinutes: template.accessTokenValidForNumberMinutes,
    roles: [roleSlug],
    permissions: [],
    projectKey,
  });
  if (saved?.isSuccess === false) {
    throw new ConnectSetupError("create-credential", "The client credential could not be created.");
  }

  const after = findCredential(
    await authClientService.clients.list({ projectKey }),
    template.clientCredentialName,
  );
  if (!after) {
    throw new ConnectSetupError(
      "create-credential",
      "The client credential was created but could not be found.",
    );
  }
  return after;
}

/**
 * Runs Connect setup through IAM's own endpoints — create role, assign permissions, issue a
 * client credential — then records it in blocks-os. Every step reuses what an earlier,
 * interrupted run left behind, so it is safe to run again after a failure.
 */
export async function runConnectSetup({ template, projectKey, onStep }: RunOptions) {
  const permissionIds = await step("resolve-permissions", onStep, () =>
    resolvePermissionIds(template, projectKey),
  );

  const role = await step("create-role", onStep, () => ensureRole(template, projectKey));

  await step("assign-permissions", onStep, async () => {
    const result = await roleService.setRoles({
      slug: role.slug,
      addPermissions: permissionIds,
      removePermissions: [],
      organizationId: role.organizationId ?? "",
    });
    const response = result as unknown as { isSuccess?: boolean; errors?: unknown };
    if (response?.isSuccess === false) {
      throw new ConnectSetupError(
        "assign-permissions",
        errorText(response.errors) || "Permissions could not be assigned.",
      );
    }
  });

  const credential = await step("create-credential", onStep, () =>
    ensureCredential(template, role.slug, projectKey),
  );

  await step("save-setup", onStep, async () => {
    const result = await connectService.saveSetup({
      templateKey: template.key,
      roleId: role.itemId,
      roleSlug: role.slug,
      clientCredentialId: credential.itemId,
    });
    if (!result.isSuccess) {
      throw new ConnectSetupError(
        "save-setup",
        errorText(result.errors) || "Setup could not be saved.",
      );
    }
  });

  return {
    templateKey: template.key,
    templateDisplayName: template.displayName,
    roleId: role.itemId,
    roleSlug: role.slug,
    clientCredentialId: credential.itemId,
  } satisfies Omit<IConnectSetup, "itemId" | "createdDate">;
}
