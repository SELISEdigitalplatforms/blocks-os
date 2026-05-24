import { getRuntimeEnv } from "@/lib/runtime-env";

export const DEPLOYMENT_BASE_URL =
  "https://dev-deployment.blocksdevelopers.com";


const DEFAULT_BLOCKS_LOGIC_SITE_ORIGIN = "https://dev-logic.blocksdevelopers.com" as const;

const trimTrailingSlash = (value: string) => value.replace(/\/$/, "");

const resolveBlocksLogicSiteOrigin = (): string => {
  const fromEnv = trimTrailingSlash(getRuntimeEnv("BLOCKS_LOGIC_BASE_URL").trim());
  if (fromEnv) return fromEnv;
  return DEFAULT_BLOCKS_LOGIC_SITE_ORIGIN;
};

/** Logic host origin without `/api` (SignalR hub lives here). Resolved from `BLOCKS_LOGIC_BASE_URL`. */
export const BLOCKS_LOGIC_SITE_ORIGIN = resolveBlocksLogicSiteOrigin();

export const API_BASES = {
  COMMUNICATION: "/api",
  CLOUD_CONFIGURATION: "/api",
  UDS: "/api",
  UILM: "/api",
  UTILITIES: "/api",
  CLOUD_BUILD: "/api",
  IDP: getRuntimeEnv("BLOCKS_IDP_BASE_URL") + "/api",
  IDENTIFIER: "/api",
  LMT: "/api",
  MFA: "/api",
  ALERT: "/api",
  AI: "/api",
  STUDIO: "/api",
  LOGIC: `${BLOCKS_LOGIC_SITE_ORIGIN}/api`,
} as const;