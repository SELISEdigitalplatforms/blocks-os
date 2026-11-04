import { tStatic, useT } from "@seliseblocks/genesis-os";

/** Translation module of the notification and push screens. */
export const NOTIFICATION_I18N_MODULE = "os.communication.notification";

type Values = Parameters<typeof tStatic>[2];

/** Text outside React; call it when the text is shown, never at import time. */
export const tn = (key: string, values?: Values): string =>
  tStatic(NOTIFICATION_I18N_MODULE, key, values);

/** Subscribes a component to language changes, so constants that read text lazily re-render. */
export const useNotificationT = () => useT(NOTIFICATION_I18N_MODULE);

/** A select or radio option whose label is translated when it is read. */
export const lazyOption = <V extends string | number>(value: V, key: string) => ({
  value,
  get label() {
    return tn(key);
  },
});

type Spec = string | readonly string[] | (() => string) | { readonly [name: string]: Spec };

export type TextOf<S> = S extends string | (() => string)
  ? string
  : S extends readonly string[]
    ? string[]
    : { readonly [K in keyof S]: TextOf<S[K]> };

const define = (spec: Spec): unknown => {
  if (typeof spec === "string") return tn(spec);
  if (typeof spec === "function") return spec();
  if (Array.isArray(spec)) return spec.map((key) => tn(key));
  return textMap(spec as { readonly [name: string]: Spec });
};

/**
 * An object whose values are read from the translations each time they are used.
 * A string is a translation key, a list is a list of keys, a function builds a text with values.
 */
export const textMap = <S extends { readonly [name: string]: Spec }>(spec: S): TextOf<S> => {
  const out: Record<string, unknown> = {};
  for (const [name, value] of Object.entries(spec)) {
    Object.defineProperty(out, name, { enumerable: true, get: () => define(value) });
  }
  return out as TextOf<S>;
};
