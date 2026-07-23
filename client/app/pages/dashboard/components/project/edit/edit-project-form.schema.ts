import { z } from "zod";

export const editProjectFormSchema = z.object({
  name: z.string().min(1, "Project name is required"),
});

export type EditProjectFormSchema = z.infer<typeof editProjectFormSchema>;

export const editProjectFormDefaultValues: EditProjectFormSchema = {
  name: "",
};
