import { z } from "zod";
import { tStatic } from "@seliseblocks/genesis-os";

export const createAddServiceSchema = () => z.object({
  serviceName: z
    .string()
    .trim()
    .min(1, tStatic("os.identifier", "UTILS.SERVICE_NAME_IS_REQUIRED"))
    .max(100, tStatic("os.identifier", "UTILS.SERVICE_NAME_TOO_LONG_MAXIMUM")),
  tags: z
    .string()
    .array()
    .refine((tags) => new Set(tags).size === tags.length, tStatic("os.identifier", "UTILS.DUPLICATE_TAGS_ARE_NOT_ALLOWED")),
  serviceType: z.enum(["frontend", "backend"]).default("frontend"),
  description: z.string().optional(),
});

export type AddServiceForm = z.infer<ReturnType<typeof createAddServiceSchema>>;

export const addServiceDefaultValues: AddServiceForm = {
  serviceName: "",
  tags: [],
  description: "",
  serviceType: "frontend",
};
