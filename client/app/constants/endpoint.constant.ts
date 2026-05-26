import { getRuntimeEnv } from "@/lib/runtime-env";

const trimTrailingSlash = (value: string) => value.replace(/\/$/, "");

export const API_BASES = {
  COMMUNICATION: "/api",
  CLOUD_CONFIGURATION: "/api",
  UDS: "/api",
  UILM: "/api",
  UTILITIES: "/api",
  CLOUD_BUILD: "/api",
  IAM: `${trimTrailingSlash(getRuntimeEnv("BLOCKS_IAM_BASE_URL"))}/api`,
  IDENTIFIER: "/api",
  LMT: "/api",
  MFA: "/api",
  ALERT: "/api",
  AI: "/api",
  LOGIC: `${trimTrailingSlash(getRuntimeEnv("BLOCKS_LOGIC_BASE_URL"))}/api`,
  RELEASE: `${trimTrailingSlash(getRuntimeEnv("BLOCKS_RELEASE_BASE_URL"))}/api`,
  STUDIO: `${trimTrailingSlash(getRuntimeEnv("BLOCKS_STUDIO_BASE_URL"))}/api`,
} as const;
