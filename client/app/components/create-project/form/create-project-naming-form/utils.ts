import { z } from "zod";

export const createProjectNamingFormDefaultValue = {
  name: "",
  description: "",
  isAcceptBlocksTerms: false,
  isUseBlocksExclusively: false,
};

export const createProjectNamingFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Name is required")
    .min(3, "Project name must be at least 3 characters")
    .max(100, "Project name should be a maximum of 100 characters"),
  description: z.string().trim().max(500, "Keep the description under 500 characters"),
  isAcceptBlocksTerms: z.boolean().refine((val) => val),
  isUseBlocksExclusively: z.boolean().refine((val) => val),
});
