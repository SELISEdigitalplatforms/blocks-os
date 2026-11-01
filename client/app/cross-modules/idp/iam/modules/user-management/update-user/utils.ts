import { tStatic } from "@seliseblocks/genesis-os";
import { z } from "zod";

const tr = (key: string) => tStatic("os.idp.users", key);

export const inviteUserFormDefaultValue = {
  firstName: "",
  lastName: "",
};

export const buildUpdateUserFormSchema = () =>
  z.object({
    firstName: z
      .string()
      .trim()
      .min(1, tr("UPDATE_USER_UTILS.FIRST_NAME_REQUIRED"))
      .max(150, tr("UPDATE_USER_UTILS.FIRST_NAME_MAX")),
    lastName: z
      .string()
      .trim()
      .min(1, tr("UPDATE_USER_UTILS.LAST_NAME_REQUIRED"))
      .max(150, tr("UPDATE_USER_UTILS.LAST_NAME_MAX")),
  });

// Used for the form value type and tests; the form calls the builder at render time.
export const inviteUserFormSchema = buildUpdateUserFormSchema();
