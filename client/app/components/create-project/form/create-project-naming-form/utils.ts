import { z } from "zod";

export const PROJECT_TYPE_OPTIONS = [
  {
    value: "regular",
    label: "Regular project",
    description: "Start empty. You can set up Connect yourself later.",
  },
  {
    value: "template",
    label: "Template project",
    description:
      "Connect is set up automatically in each environment, the first time the environment is opened after it is ready.",
  },
] as const;

export const createProjectNamingFormDefaultValue = {
  name: "",
  projectType: "regular" as "regular" | "template",
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
  projectType: z.enum(["regular", "template"]),
  isAcceptBlocksTerms: z.boolean().refine((val) => val),
  isUseBlocksExclusively: z.boolean().refine((val) => val),
});
