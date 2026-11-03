import { formatDistanceToNow } from "date-fns";
import { getLanguageCode } from "@seliseblocks/genesis-os";

const ENGLISH_DATE_LOCALE = "en-GB";

/**
 * Intl locale for dates in the shown language. English keeps the UK day-first order used so far; any other
 * language the project enables uses its own locale, and a code the browser does not know falls back to English.
 */
export const uiDateLocale = (code: string | undefined = getLanguageCode()): string => {
  if (!code || code.toLowerCase().startsWith("en")) return ENGLISH_DATE_LOCALE;
  try {
    return Intl.DateTimeFormat.supportedLocalesOf([code]).length > 0 ? code : ENGLISH_DATE_LOCALE;
  } catch {
    return ENGLISH_DATE_LOCALE;
  }
};

const RELATIVE_UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["year", 365 * 24 * 3600],
  ["month", 30 * 24 * 3600],
  ["week", 7 * 24 * 3600],
  ["day", 24 * 3600],
  ["hour", 3600],
  ["minute", 60],
  ["second", 1],
];

/**
 * "3 hours ago" / "in 2 days" in the shown language. English keeps the date-fns wording used so far; any other
 * language uses the browser's Intl.RelativeTimeFormat, so no per-language date-fns locale has to be bundled.
 */
export const relativeTimeFromNow = (
  date: Date,
  code: string | undefined = getLanguageCode(),
): string => {
  const locale = uiDateLocale(code);
  if (locale === ENGLISH_DATE_LOCALE) return formatDistanceToNow(date, { addSuffix: true });
  const seconds = Math.round((date.getTime() - Date.now()) / 1000);
  const [unit, size] = RELATIVE_UNITS.find(([, s]) => Math.abs(seconds) >= s) ?? ["second", 1];
  return new Intl.RelativeTimeFormat(locale, { numeric: "auto" }).format(
    Math.round(seconds / size),
    unit,
  );
};
