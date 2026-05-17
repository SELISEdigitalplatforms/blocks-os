const PLACEHOLDER_PREFIX = "__BLOCKS_";

type RuntimeKey =
  | "BLOCKS_API_BASE_URL"
  | "BLOCKS_X_BLOCKS_KEY"
  | "BLOCKS_GOOGLE_SITE_KEY"
  | "BLOCKS_CONSTRUCT_URL"
  | "BLOCKS_GITHUB_SSO_CLIENT_ID"
  | "BLOCKS_IDP_BASE_URL"
  | "BLOCKS_OIDC_CLIENT_ID"
  | "BLOCKS_BASE_DOMAIN"
  | "BLOCKS_LOGIC_BASE_URL"
  | "BLOCKS_OIDC_CLIENT_ID";

declare global {
  interface Window {
    __BLOCKS_ENV__?: Partial<Record<RuntimeKey, string>>;
  }
}

window.__BLOCKS_ENV__ = {
  BLOCKS_API_BASE_URL: "https://dev-os.blocksdevelopers.com",
  BLOCKS_IDP_BASE_URL: "https://dev-idp.blocksdevelopers.com",
  BLOCKS_X_BLOCKS_KEY: "***REMOVED***",
  BLOCKS_GOOGLE_SITE_KEY: "your-google-site-key",
  BLOCKS_CONSTRUCT_URL: "https://dev-construct.blocksdevelopers.com",
  BLOCKS_GITHUB_SSO_CLIENT_ID: "Ov23likdyGSUHGkewKf0",
  BLOCKS_OIDC_CLIENT_ID: "5225b9c1-15bc-41b0-bdc6-d3ceb180ccc5",
  BLOCKS_BASE_DOMAIN: "blocksdevelopers.com",
};

const isPlaceholder = (value?: string) =>
  !!value && value.startsWith(PLACEHOLDER_PREFIX) && value.endsWith("__");

export const getRuntimeEnv = (key: RuntimeKey): string => {
  const windowValue =
    typeof window !== "undefined" ? window.__BLOCKS_ENV__?.[key] : undefined;
  if (windowValue && !isPlaceholder(windowValue)) {
    return windowValue;
  }

  return import.meta.env[key] || "";
};
