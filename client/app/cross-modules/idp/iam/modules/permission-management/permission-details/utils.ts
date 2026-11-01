import { tStatic } from "@seliseblocks/genesis-os";
import { z } from "zod";

export const addPermissionFormDefaultValue = {
  name: "",
  type: "",
  tags: [],
  resource: "",
  resourceGroup: "",
  description: "",
  dependentPermissions: [],
};

export const addPermissionFormSchema = z
  .object({
    name: z
      .string()
      .min(1, { error: () => tStatic("os.idp.permissions", "ADD_PERMISSION_SCHEMA.NAME_REQUIRED") })
      .max(50, { error: () => tStatic("os.idp.permissions", "ADD_PERMISSION_SCHEMA.NAME_MAX_50") })
      .trim(),
    type: z
      .string()
      .min(1, {
        error: () => tStatic("os.idp.permissions", "ADD_PERMISSION_SCHEMA.TYPE_REQUIRED"),
      }),
    resource: z
      .string()
      .min(1, {
        error: () => tStatic("os.idp.permissions", "ADD_PERMISSION_SCHEMA.RESOURCE_REQUIRED"),
      })
      .max(50, {
        error: () => tStatic("os.idp.permissions", "ADD_PERMISSION_SCHEMA.RESOURCE_MAX_50"),
      })
      .trim()
      .refine((s) => !s.includes(" "), {
        error: () => tStatic("os.idp.permissions", "ADD_PERMISSION_SCHEMA.RESOURCE_NO_SPACES"),
      }),
    resourceGroup: z
      .string()
      .nonempty({
        error: () => tStatic("os.idp.permissions", "ADD_PERMISSION_SCHEMA.GROUP_REQUIRED"),
      })
      .trim(),
    tags: z.string().array(),
    description: z
      .string()
      .max(150, {
        error: () => tStatic("os.idp.permissions", "ADD_PERMISSION_SCHEMA.DESCRIPTION_MAX_150"),
      })
      .optional(),
    dependentPermissions: z.array(z.string()),
  })
  .refine(
    (arg) => {
      if (arg.type === "1") {
        const regex = /^[a-zA-Z0-9]+::[a-zA-Z0-9]+::[a-zA-Z0-9]+$/;
        return regex.test(arg.resource);
      }
      return true;
    },
    {
      error: () => tStatic("os.idp.permissions", "ADD_PERMISSION_SCHEMA.RESOURCE_FORMAT"),
      path: ["resource"],
    },
  );
