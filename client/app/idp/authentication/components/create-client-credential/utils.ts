import { z } from "zod";

export const createClientSchema = z.object({
  itemId: z.string().trim().optional().nullable(),
  clientNameService: z.string().trim().min(1, "Client name is required").max(80),
  accessTokenValidForNumberMinutes: z
    .number({ invalid_type_error: "Enter a number of minutes" })
    .int()
    .min(1, "Must be at least 1 minute")
    .max(43_200, "Max 30 days"),
  isActive: z.boolean(),
  roles: z.array(z.string().trim()),
  permissions: z.array(z.string().trim()).max(10, "Maximum 10 permissions allowed"),
});

export type CreateClientModalFormValues = z.infer<typeof createClientSchema>;

export const CreateClientModalFormDefaultValues: CreateClientModalFormValues = {
  itemId: null,
  clientNameService: "",
  accessTokenValidForNumberMinutes: 60,
  isActive: true,
  roles: [],
  permissions: [],
};
