import { tStatic } from "@seliseblocks/genesis-os";
import { z } from "zod";

const I18N_MODULE = "os.idp.roles";

// DEADCODE 2026-07-29: no references in client or e2e; commented pending review
// export const updateRoleFormDefaultValue = {
//   name: "",
//   description: "",
// };

export const createUpdateRoleFormSchema = () =>
  z.object({
    name: z
      .string()
      .trim()
      .min(1, tStatic(I18N_MODULE, "UPDATE_ROLE.NAME_REQUIRED"))
      .max(50, tStatic(I18N_MODULE, "UPDATE_ROLE.NAME_MAX_50")),
    description: z
      .string()
      .trim()
      .max(150, tStatic(I18N_MODULE, "UPDATE_ROLE.DESCRIPTION_MAX_150"))
      .optional(),
    parentRoleSlug: z.string().nullish(),
  });

export type UpdateRoleFormValues = z.infer<ReturnType<typeof createUpdateRoleFormSchema>>;
