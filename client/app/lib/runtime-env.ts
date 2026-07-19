/// <reference types="vite/client" />
const PLACEHOLDER_PREFIX = "__BLOCKS_";

export type RuntimeKey =
  | "BLOCKS_BASE_DOMAIN"
  | "BLOCKS_X_BLOCKS_KEY"
  | "BLOCKS_GOOGLE_SITE_KEY"
  | "BLOCKS_CONSTRUCT_URL"
  | "BLOCKS_GITHUB_SSO_CLIENT_ID"
  | "BLOCKS_OIDC_CLIENT_ID"
  | "BLOCKS_BASE_DOMAIN"
  | "BLOCKS_DEV_HOST"
  | "BLOCKS_IAM_BASE_URL"
  | "BLOCKS_IAM_CALLBACK_URL"
  | "BLOCKS_LOCALIZATION_BASE_URL"
  | "BLOCKS_LOCALIZATION_CALLBACK_URL"
  | "BLOCKS_AGENTS_BASE_URL"
  | "BLOCKS_AGENTS_CALLBACK_URL"
  | "BLOCKS_DATA_BASE_URL"
  | "BLOCKS_DATA_CALLBACK_URL"
  | "BLOCKS_OS_BASE_URL"
  | "BLOCKS_OS_CALLBACK_URL"
  | "BLOCKS_UTILITIES_BASE_URL"
  | "BLOCKS_UTILITIES_CALLBACK_URL"
  | "BLOCKS_LOGIC_BASE_URL"
  | "BLOCKS_LOGIC_CALLBACK_URL"
  | "BLOCKS_MONITOR_BASE_URL"
  | "BLOCKS_MONITOR_CALLBACK_URL"
  | "BLOCKS_RELEASE_BASE_URL"
  | "BLOCKS_RELEASE_CALLBACK_URL"
  | "BLOCKS_STUDIO_BASE_URL"
  | "BLOCKS_STUDIO_CALLBACK_URL"
  | "BLOCKS_DATA_CLIENT_ID"
  | "BLOCKS_IAM_CLIENT_ID"
  | "BLOCKS_LOCALIZATION_CLIENT_ID"
  | "BLOCKS_AGENTS_CLIENT_ID"
  | "BLOCKS_OS_CLIENT_ID"
  | "BLOCKS_UTILITIES_CLIENT_ID"
  | "BLOCKS_LOGIC_CLIENT_ID"
  | "BLOCKS_MONITOR_CLIENT_ID"
  | "BLOCKS_RELEASE_CLIENT_ID"
  | "BLOCKS_STUDIO_CLIENT_ID"
  | "BLOCKS_CNAME_BASE_URL";

const isPlaceholder = (value?: string) =>
  !!value && value.startsWith(PLACEHOLDER_PREFIX) && value.endsWith("__");

/**
 * @param loadEnvMap When set (e.g. Vite `loadEnv` in `vite.config.ts`), used first so Node-side
 *   tooling matches `.env` / mode files before `window` / `import.meta.env`.
 */
export const getRuntimeEnv = (
  key: RuntimeKey,
  loadEnvMap?: Record<string, string>,
): string => {
  if (loadEnvMap) {
    const fromLoadEnv = loadEnvMap[key];
    if (fromLoadEnv && !isPlaceholder(fromLoadEnv)) {
      return fromLoadEnv;
    }
  }

  const windowValue =
    typeof window !== "undefined"
      ? (
          window as Window & {
            __BLOCKS_ENV__?: Partial<Record<RuntimeKey, string>>;
          }
        ).__BLOCKS_ENV__?.[key]
      : undefined;
  if (windowValue && !isPlaceholder(windowValue)) {
    return windowValue;
  }

  const fromViteDefine =
    typeof import.meta !== "undefined" &&
    typeof import.meta.env !== "undefined" &&
    import.meta.env !== null
      ? (import.meta.env as Record<string, string | undefined>)[key]
      : undefined;

  if (fromViteDefine && !isPlaceholder(fromViteDefine)) {
    return fromViteDefine;
  }

  return "";
};
