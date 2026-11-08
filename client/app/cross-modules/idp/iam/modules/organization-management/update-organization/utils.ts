import { tStatic } from "@seliseblocks/genesis-os";
import { z } from "zod";

export const updateOrganizationFormSchema = z.object({
  name: z
    .string()
    .min(1, {
      error: () => tStatic("os.idp.organizations", "UPDATE_ORGANIZATION_SCHEMA.NAME_REQUIRED"),
    })
    .max(100, {
      error: () => tStatic("os.idp.organizations", "UPDATE_ORGANIZATION_SCHEMA.NAME_MAX_100"),
    })
    .trim(),
});
