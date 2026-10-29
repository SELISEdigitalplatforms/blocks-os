/**
 * Points `window.location` at `url` for the duration of a test, returning a restore function.
 *
 * Needed by anything that exercises a `SELF_ORIGIN_KEYS` entry in `getRuntimeEnv`
 * (`BLOCKS_OS_BASE_URL`), which resolves against the origin the page was served from rather than
 * the injected `window.__BLOCKS_ENV__` value. jsdom's `Location` is a non-configurable platform
 * object, so `origin` cannot be redefined on the instance -- the whole `location` property has to
 * be swapped. A `URL` stands in for it faithfully enough: it exposes `origin`, `href`, `protocol`,
 * `host`, `pathname`, `search` and `hash` with the same semantics.
 */
export const stubOrigin = (url: string): (() => void) => {
  const original = Object.getOwnPropertyDescriptor(window, "location");

  Object.defineProperty(window, "location", {
    configurable: true,
    value: new URL(url),
  });

  return () => {
    if (original) {
      Object.defineProperty(window, "location", original);
    } else {
      delete (window as unknown as Record<string, unknown>).location;
    }
  };
};
