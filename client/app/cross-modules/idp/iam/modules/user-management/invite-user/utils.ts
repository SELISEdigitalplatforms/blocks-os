import { z } from "zod";

export const inviteUserFormDefaultValue = {
  email: "",
  organizationIds: [] as string[],
  roles: [] as { slug: string }[],
  permissions: [] as { resource: string }[],
};

export const buildInviteUserFormSchema = (isMultiOrgEnabled: boolean) =>
  z.object({
    email: z
      .string()
      .trim()
      .min(1, "Email is required")
      .check(z.email("Please enter a valid email address")),
    organizationIds: isMultiOrgEnabled
      ? z
          // zod 3's default message, kept so the form reads the same after the zod 4 upgrade.
          .array(z.string().min(1, "String must contain at least 1 character(s)"))
          .min(1, "Please select an organization")
      : z.array(z.string()).optional(),
    roles: z.array(z.object({ slug: z.string() })),
    permissions: z.array(z.object({ resource: z.string() })),
  });

export const inviteUserFormSchema = buildInviteUserFormSchema(true);
