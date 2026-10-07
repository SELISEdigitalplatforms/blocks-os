/**
 * Mapping between the Max redemptions form field (a string, so that "" and "0" stay
 * distinct) and IAM's `defaultMaxRedemptions` (null = IAM default of one use, 0 = unlimited
 * until the link expires, n = n uses).
 */

/** IAM stores the value as an Int32. */
export const MAX_REDEMPTIONS_LIMIT = 2147483647;

const toNumber = (value: string | undefined | null): number | null => {
  const trimmed = (value ?? "").trim();
  return trimmed === "" ? null : Number(trimmed);
};

/** Create: an empty field sends null so IAM applies its single-use default. Never 0. */
export const toCreateMaxRedemptions = (value: string | undefined | null): number | null =>
  toNumber(value);

/**
 * Edit: IAM ignores null on PATCH, and null resolves to 1 at generation anyway, so a cleared
 * field sends 1 to make the stored value match what the admin sees.
 */
export const toEditMaxRedemptions = (value: string | undefined | null): number =>
  toNumber(value) ?? 1;

/** Edit, load: null shows an empty field. */
export const fromConfigurationMaxRedemptions = (value: number | null | undefined): string =>
  value === null || value === undefined ? "" : String(value);

/** List label for the "Max uses" cell. */
export const maxRedemptionsLabel = (value: number | null | undefined): string => {
  if (value === null || value === undefined || value === 1) return "Single use";
  if (value === 0) return "Unlimited";
  return `${value} uses`;
};

/** List label for the "Existing-user password" cell. Missing or null reads as required. */
export const existingUserPasswordLabel = (value: boolean | null | undefined): string =>
  value === false ? "Not required" : "Required";
