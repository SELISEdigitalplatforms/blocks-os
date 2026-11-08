import { tStatic } from "@seliseblocks/genesis-os";
import { z } from "zod";

const tr = (key: string) => tStatic("os.idp.users", key);

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
      .min(1, tr("INVITE_USER_UTILS.EMAIL_REQUIRED"))
      .check(z.email(tr("INVITE_USER_UTILS.EMAIL_INVALID"))),
    organizationIds: isMultiOrgEnabled
      ? z
          // zod 3's default message, kept so the form reads the same after the zod 4 upgrade.
          .array(z.string().min(1, tr("INVITE_USER_UTILS.ORGANIZATION_ID_MIN_LENGTH")))
          .min(1, tr("INVITE_USER_UTILS.ORGANIZATION_REQUIRED"))
      : z.array(z.string()).optional(),
    roles: z.array(z.object({ slug: z.string() })),
    permissions: z.array(z.object({ resource: z.string() })),
  });

// Used for the form value type and tests; the form itself calls the builder at render time
// so messages follow the current language.
export const inviteUserFormSchema = buildInviteUserFormSchema(true);
