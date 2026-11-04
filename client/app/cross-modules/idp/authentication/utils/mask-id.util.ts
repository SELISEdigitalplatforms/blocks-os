const VISIBLE = 4;
const SHORT_VISIBLE = 2;
const STARS = "*".repeat(8);

/**
 * Masks an id for display only: first 4 + stars + last 4 (first 2 + stars for short ids).
 * Plain text, so it lays out like any other text; copy buttons still copy the full id.
 */
export const maskId = (value: string | null | undefined): string => {
  if (!value) return "";
  if (value.length <= VISIBLE * 2) return `${value.slice(0, SHORT_VISIBLE)}${STARS}`;
  return `${value.slice(0, VISIBLE)}${STARS}${value.slice(-VISIBLE)}`;
};
