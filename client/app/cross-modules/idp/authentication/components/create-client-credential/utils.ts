import { z } from "zod";
import type { TFunction } from "@seliseblocks/genesis-os";

/**
 * @param isMultiOrgEnabled Whether the workspace has multi-organization turned on. When it is
 * off there is no organization picker and no organization to send: the server pins the
 * credential to the caller's own scope.
 * @param isEdit Editing never re-scopes an existing credential, so the field is not required
 * even under multi-org.
 */
export const buildCreateClientSchema = (
  isMultiOrgEnabled: boolean,
  isEdit: boolean,
  t: TFunction,
) =>
  z.object({
    itemId: z.string().trim().optional().nullable(),
    // zod 3's default messages, kept so the form reads the same after the zod 4 upgrade.
    clientNameService: z
      .string()
      .trim()
      .min(1, t("CREATE_CLIENT_CREDENTIAL.CLIENT_NAME_REQUIRED"))
      .max(80, t("CREATE_CLIENT_CREDENTIAL.CLIENT_NAME_TOO_LONG")),
    accessTokenValidForNumberMinutes: z
      .number({
        error: (issue) =>
          issue.input === undefined
            ? t("CREATE_CLIENT_CREDENTIAL.REQUIRED")
            : t("CREATE_CLIENT_CREDENTIAL.LIFETIME_NUMBER"),
      })
      // Number.isInteger, not .int(): zod 4's .int() also rejects unsafe integers and stops the
      // checks after it. zod 3 showed the invalid_type_error above for a fraction.
      .refine(Number.isInteger, t("CREATE_CLIENT_CREDENTIAL.LIFETIME_NUMBER"))
      .min(5, t("CREATE_CLIENT_CREDENTIAL.LIFETIME_MIN"))
      .max(120, t("CREATE_CLIENT_CREDENTIAL.LIFETIME_MAX")),
    isActive: z.boolean(),
    organizationId:
      isMultiOrgEnabled && !isEdit
        ? z.string().trim().min(1, t("CREATE_CLIENT_CREDENTIAL.ORGANIZATION_REQUIRED"))
        : z.string().trim().optional(),
    roles: z.array(z.string().trim()).min(1, t("CREATE_CLIENT_CREDENTIAL.ROLE_REQUIRED")),
    permissions: z.array(z.string().trim()).max(10, t("CREATE_CLIENT_CREDENTIAL.PERMISSIONS_MAX")),
  });

export type CreateClientModalFormValues = z.infer<ReturnType<typeof buildCreateClientSchema>>;

export const CreateClientModalFormDefaultValues: CreateClientModalFormValues = {
  itemId: null,
  clientNameService: "",
  accessTokenValidForNumberMinutes: 15,
  isActive: true,
  organizationId: "",
  roles: [],
  permissions: [],
};
