import { tStatic } from "@seliseblocks/genesis-os";
import {
  IPermission,
  PermissionSeverityLevel,
  normalizePermissionSeverity,
} from "@blocks-idp/iam/models/permission";
import { z } from "zod";

const I18N_MODULE = "os.idp.permissions";

export const getBuiltinPermissionReadonlyMessage = (): string =>
  tStatic(I18N_MODULE, "PERMISSION_FORM_SCHEMA.BUILTIN_READONLY");

export const isPermissionFormReadOnly = (isBuiltIn?: boolean): boolean => Boolean(isBuiltIn);

export const permissionFormDefaultValue: PermissionFormSchemaType = {
  name: "",
  type: 0,
  tags: [],
  resource: "",
  resourceGroup: "",
  description: "",
  dependentPermissions: [],
  permissionSeverity: undefined,
};

const normalizeResourceType = (value: unknown): number => {
  const numericValue = Number(value);
  if ([1, 2].includes(numericValue)) return numericValue;
  return 0;
};

export const mapPermissionToFormValues = (permission: IPermission): PermissionFormSchemaType => {
  const normalizedSeverity = normalizePermissionSeverity(permission.permissionSeverity);
  return {
    name: permission.name ?? "",
    type: normalizeResourceType(permission.type),
    resource: permission.resource ?? "",
    resourceGroup: permission.resourceGroup ?? "",
    tags: permission.tags ?? [],
    description: permission.description ?? "",
    dependentPermissions: permission.dependentPermissions ?? [],
    permissionSeverity: normalizedSeverity,
  };
};

export const permissionFormSchema = z
  .object({
    name: z
      .string()
      .min(1, {
        error: () => tStatic(I18N_MODULE, "PERMISSION_FORM_SCHEMA.NAME_REQUIRED"),
      })
      .max(100, {
        error: () => tStatic(I18N_MODULE, "PERMISSION_FORM_SCHEMA.NAME_MAX_100"),
      })
      .trim(),
    type: z.coerce.number<number>().min(1, {
      error: () => tStatic(I18N_MODULE, "PERMISSION_FORM_SCHEMA.TYPE_REQUIRED"),
    }),
    resource: z
      .string()
      .min(1, {
        error: () => tStatic(I18N_MODULE, "PERMISSION_FORM_SCHEMA.RESOURCE_REQUIRED"),
      })
      .max(100, {
        error: () => tStatic(I18N_MODULE, "PERMISSION_FORM_SCHEMA.RESOURCE_MAX_100"),
      })
      .trim()
      .refine((s) => !s.includes(" "), {
        error: () => tStatic(I18N_MODULE, "PERMISSION_FORM_SCHEMA.RESOURCE_NO_SPACES"),
      }),
    resourceGroup: z
      .string()
      .nonempty({
        error: () => tStatic(I18N_MODULE, "PERMISSION_FORM_SCHEMA.GROUP_REQUIRED"),
      })
      .trim(),
    tags: z.string().array(),
    description: z.string().max(150, {
      error: () => tStatic(I18N_MODULE, "PERMISSION_FORM_SCHEMA.DESCRIPTION_MAX_150"),
    }),
    dependentPermissions: z.array(z.string()),
    permissionSeverity: z
      .enum(PermissionSeverityLevel, {
        error: () => tStatic(I18N_MODULE, "PERMISSION_FORM_SCHEMA.SEVERITY_REQUIRED"),
      })
      .optional(),
  })
  .refine(
    (arg) => {
      if (arg.type === 1) {
        const regex = /^[a-zA-Z0-9-]+::[a-zA-Z0-9-]+::[a-zA-Z0-9-]+$/;
        return regex.test(arg.resource);
      }
      return true;
    },
    {
      error: () => tStatic(I18N_MODULE, "PERMISSION_FORM_SCHEMA.RESOURCE_FORMAT"),
      path: ["resource"],
    },
  );

export type PermissionFormSchemaType = z.infer<typeof permissionFormSchema>;
