/**
 * Shared display-name and initials fallback for users.
 *
 * A user who has not activated yet (or was provisioned without a profile) has no
 * first or last name, so every surface that shows a user needs the same ladder:
 * real name -> the email's local part -> a neutral placeholder. Keeping it here
 * means the users table, the organization members table, the profile header and
 * the mobile profile sidebar cannot drift apart.
 */

export const USER_DISPLAY_NAME_FALLBACK = "-";
export const USER_INITIALS_FALLBACK = "?";

export type UserNameFields = {
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
};

const trimmed = (value?: string | null) => value?.trim() ?? "";

/**
 * The part of the email before "@". Empty for a missing email and for a
 * malformed one with nothing before the separator (e.g. "@example.com"), so
 * callers can treat both the same way.
 */
const emailLocalPart = (email?: string | null) => trimmed(trimmed(email).split("@")[0]);

/** "First Last" -> the email's local part -> "-". */
export function getUserDisplayName(user?: UserNameFields | null): string {
  const first = trimmed(user?.firstName);
  const last = trimmed(user?.lastName);

  if (first || last) return [first, last].filter(Boolean).join(" ");
  return emailLocalPart(user?.email) || USER_DISPLAY_NAME_FALLBACK;
}

/** "FL" -> the first letter of the email's local part -> "?". */
export function getUserInitials(user?: UserNameFields | null): string {
  const first = trimmed(user?.firstName);
  const last = trimmed(user?.lastName);

  if (first || last) return `${first[0] ?? ""}${last[0] ?? ""}`.toUpperCase();
  return emailLocalPart(user?.email)[0]?.toUpperCase() || USER_INITIALS_FALLBACK;
}
