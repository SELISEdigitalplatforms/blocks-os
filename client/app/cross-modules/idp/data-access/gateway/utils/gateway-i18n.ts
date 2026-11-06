import { tStatic, type TranslateValues } from "@seliseblocks/genesis-os";

/** Translation module of the data-access gateway (access control, rule sets). */
export const GATEWAY_MODULE = "os.idp.gateway";

/** Text outside React. Call it when the value is shown, never at import time. */
export const gt = (key: string, values?: TranslateValues): string =>
  tStatic(GATEWAY_MODULE, key, values);

/**
 * A record whose values are looked up each time they are read, so a constant
 * table follows a language change. `keys` maps a record key to a literal
 * translation key.
 */
export const lazyLabels = <K extends string | number>(
  keys: Record<K, string>,
): Record<K, string> => {
  const labels = {} as Record<K, string>;
  for (const name of Object.keys(keys) as K[]) {
    Object.defineProperty(labels, name, {
      enumerable: true,
      get: () => gt(keys[name]),
    });
  }
  return labels;
};

/** An option whose `label` is looked up each time it is read. */
export const labelledOption = <T extends object>(
  labelKey: string,
  rest: T,
): T & { label: string } =>
  Object.defineProperty({ ...rest } as T & { label: string }, "label", {
    enumerable: true,
    get: () => gt(labelKey),
  });
