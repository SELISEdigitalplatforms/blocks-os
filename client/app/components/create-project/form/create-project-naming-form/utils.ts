import { z } from "zod";
import { tStatic } from "@seliseblocks/genesis-os";

const I18N_MODULE = "os.create-project";

export const createProjectNamingFormDefaultValue = {
  name: "",
  description: "",
  isAcceptBlocksTerms: false,
  isUseBlocksExclusively: false,
};

export const createCreateProjectNamingFormSchema = () =>
  z.object({
    name: z
      .string()
      .trim()
      .min(1, tStatic(I18N_MODULE, "UTILS.NAME_IS_REQUIRED"))
      .min(3, tStatic(I18N_MODULE, "UTILS.PROJECT_NAME_MUST_BE_AT"))
      .max(100, tStatic(I18N_MODULE, "UTILS.PROJECT_NAME_SHOULD_BE_A")),
    description: z.string().trim().max(500, "Keep the description under 500 characters"),
    isAcceptBlocksTerms: z.boolean().refine((val) => val),
    isUseBlocksExclusively: z.boolean().refine((val) => val),
  });
