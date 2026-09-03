import { z } from "zod";

/**
 * @param isMultiOrgEnabled Whether the workspace has multi-organization turned on. When it is
 * off there is no organization picker and no organization to send: the server pins the
 * credential to the caller's own scope.
 * @param isEdit Editing never re-scopes an existing credential, so the field is not required
 * even under multi-org.
 */
export const buildCreateClientSchema = (isMultiOrgEnabled: boolean, isEdit: boolean) =>
  z.object({
    itemId: z.string().trim().optional().nullable(),
    clientNameService: z.string().trim().min(1, "Client name is required").max(80),
    accessTokenValidForNumberMinutes: z
      .number({ invalid_type_error: "Enter a number of minutes" })
      .int()
      .min(5, "Must be at least 5 minutes")
      .max(120, "Must be at most 120 minutes"),
    isActive: z.boolean(),
    organizationId:
      isMultiOrgEnabled && !isEdit
        ? z.string().trim().min(1, "Please select an organization")
        : z.string().trim().optional(),
    roles: z
      .array(z.string().trim())
      .min(1, "At least one role is required"),
    permissions: z.array(z.string().trim()).max(10, "Maximum 10 permissions allowed"),
  });

export const createClientSchema = buildCreateClientSchema(false, false);

export type CreateClientModalFormValues = z.infer<typeof createClientSchema>;

export const CreateClientModalFormDefaultValues: CreateClientModalFormValues = {
  itemId: null,
  clientNameService: "",
  accessTokenValidForNumberMinutes: 15,
  isActive: true,
  organizationId: "",
  roles: [],
  permissions: [],
};
