/**
 * Returns the trimmed search text when it is long enough to query on,
 * otherwise an empty string so the filter is dropped from the request.
 */
export function normalizeSearchQueryText(raw: string, minLength = 3): string {
  const t = raw.trim();
  return t.length >= minLength ? t : "";
}
