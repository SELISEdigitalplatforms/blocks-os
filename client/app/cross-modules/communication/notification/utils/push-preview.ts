import type { IBlocksLanguageKey, ILanguageConfig } from "@blocks-localization/models/language";

const sameCulture = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

const textOf = (key: IBlocksLanguageKey | undefined, culture: string): string => {
  const value = key?.resources?.find((r) => sameCulture(r.culture, culture))?.value;
  return value?.trim() ? value : "";
};

const TITLE_SUFFIX = /_TITLE$/i;
const BODY_SUFFIX = /_BODY$/i;

/** Title and message dropdowns prefer keys named `*_TITLE` / `*_BODY`; all keys when none match. */
export const splitKeyNames = (keys: IBlocksLanguageKey[]) => {
  const names = keys.map((k) => k.keyName);
  const titles = names.filter((n) => TITLE_SUFFIX.test(n));
  const bodies = names.filter((n) => BODY_SUFFIX.test(n));
  return {
    titles: titles.length > 0 ? titles : names,
    bodies: bodies.length > 0 ? bodies : names,
  };
};

/** The saved key stays selectable even when Localization no longer lists it. */
export const withCurrent = (names: string[], current: string): string[] =>
  current && !names.includes(current) ? [current, ...names] : names;

/** The language the user's text falls back to when the chosen one has none. */
export const defaultCulture = (languages: ILanguageConfig[]): string =>
  languages.find((l) => l.isDefault)?.languageCode ?? languages[0]?.languageCode ?? "en-US";

/** Text in the chosen language, else the default language, else the key name. */
export const previewText = (
  keys: IBlocksLanguageKey[],
  keyName: string,
  culture: string,
  fallbackCulture: string,
): string => {
  if (!keyName) return "";
  const key = keys.find((k) => k.keyName === keyName);
  return textOf(key, culture) || textOf(key, fallbackCulture) || keyName;
};

/** Languages that lack the title or the message text. */
export const missingLanguages = (
  keys: IBlocksLanguageKey[],
  languages: ILanguageConfig[],
  titleKey: string,
  bodyKey: string,
): string[] => {
  if (!titleKey || !bodyKey) return [];
  const title = keys.find((k) => k.keyName === titleKey);
  const body = keys.find((k) => k.keyName === bodyKey);
  return languages
    .filter((l) => !textOf(title, l.languageCode) || !textOf(body, l.languageCode))
    .map((l) => l.languageName);
};

const FIELD = /\{\{\s*(\w+)\s*\}\}/g;

/** The `{{field}}` names used by the chosen texts, in first-seen order. */
export const placeholderFields = (texts: string[]): string[] => {
  const found = new Set<string>();
  for (const text of texts) {
    for (const match of text.matchAll(FIELD)) found.add(match[1]);
  }
  return [...found];
};
