import { tStatic } from "@seliseblocks/genesis-os";
import { z } from "zod";

export const addOrganizationFormDefaultValue = {
  name: "",
};

export const addOrganizationFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, {
      error: () => tStatic("os.idp.organizations", "ADD_ORGANIZATION_SCHEMA.NAME_REQUIRED"),
    })
    .max(100, {
      error: () => tStatic("os.idp.organizations", "ADD_ORGANIZATION_SCHEMA.NAME_MAX_100"),
    }),
});
