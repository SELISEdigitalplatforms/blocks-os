import { z } from "zod";
import { tStatic } from "@seliseblocks/genesis-os";

export const createProjectNamingFormDefaultValue = {
  name: "",
  isAcceptBlocksTerms: false,
  isUseBlocksExclusively: false,
};

export const createCreateProjectNamingFormSchema = () => z.object({
  name: z
    .string()
    .trim()
    .min(1, tStatic("os.create-project", "UTILS.NAME_IS_REQUIRED"))
    .min(3, tStatic("os.create-project", "UTILS.PROJECT_NAME_MUST_BE_AT"))
    .max(100, tStatic("os.create-project", "UTILS.PROJECT_NAME_SHOULD_BE_A")),
  isAcceptBlocksTerms: z.boolean().refine((val) => val),
  isUseBlocksExclusively: z.boolean().refine((val) => val),
});
