import { tStatic } from "@seliseblocks/genesis-os";
import { z } from "zod";

const I18N_MODULE = "os.idp.roles";

export const addRoleFormDefaultValue = {
  name: "",
  slug: "",
  description: "",
  parentRoleSlug: "",
};

// Mirrors the server's limits deliberately, so a value the API would accept is not blocked here
// and the server's own messages stay reachable: name 150, slug 200, description 150.
export const createAddRoleFormSchema = () =>
  z.object({
    name: z
      .string()
      .trim()
      .min(1, tStatic(I18N_MODULE, "ADD_ROLE.NAME_REQUIRED"))
      .max(150, tStatic(I18N_MODULE, "ADD_ROLE.MAX_150")),
    slug: z
      .string()
      .trim()
      .min(1, tStatic(I18N_MODULE, "ADD_ROLE.SLUG_REQUIRED"))
      .max(200, tStatic(I18N_MODULE, "ADD_ROLE.MAX_200"))
      .refine((s) => !s.includes(" "), tStatic(I18N_MODULE, "ADD_ROLE.SLUG_NO_SPACES")),
    description: z.string().trim().max(150, tStatic(I18N_MODULE, "ADD_ROLE.MAX_150")).optional(),
    parentRoleSlug: z.string().optional(),
  });

export type AddRoleFormValues = z.infer<ReturnType<typeof createAddRoleFormSchema>>;
