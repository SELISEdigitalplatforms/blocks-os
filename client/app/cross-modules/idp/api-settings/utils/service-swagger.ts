import { isAgentsEnabled, isStudioEnabled } from "@/lib/features";
import { getRuntimeEnv, RuntimeKey } from "@/lib/runtime-env";

/**
 * Services whose base URL is configured through a `BLOCKS_<NAME>_BASE_URL`
 * runtime variable. The endpoint's `service` (the permission ResourceGroup, e.g.
 * "blocks-iam") maps onto these names once the "blocks-" prefix is stripped.
 */
const SERVICES_WITH_BASE_URL = [
  "IAM",
  "LOCALIZATION",
  "AGENTS",
  "DATA",
  "OS",
  "UTILITIES",
  "LOGIC",
  "MONITOR",
  "RELEASE",
  "STUDIO",
] as const;

const trimTrailingSlash = (value: string) => value.replace(/\/+$/, "");

const isAbsoluteUrl = (value: string) => /^https?:\/\//i.test(value);

/**
 * Resolves the origin a service is served from: the endpoint's own `baseUrl`
 * when the backend provides an absolute one, otherwise the configured runtime
 * base URL for that service. Returns "" when the service is unknown.
 */
export const getServiceBaseUrl = (service: string, baseUrl?: string): string => {
  const name = service
    .trim()
    .toUpperCase()
    .replace(/^BLOCKS[-_]/, "")
    .replace(/-/g, "_");

  // Services that only some installations run: no link unless their feature is on.
  if (name === "AGENTS" && !isAgentsEnabled()) return "";
  if (name === "STUDIO" && !isStudioEnabled()) return "";

  if (baseUrl && isAbsoluteUrl(baseUrl)) return trimTrailingSlash(baseUrl);

  const isKnown = (SERVICES_WITH_BASE_URL as readonly string[]).includes(name);
  if (!isKnown) return "";

  return trimTrailingSlash(getRuntimeEnv(`BLOCKS_${name}_BASE_URL` as RuntimeKey));
};

/** Swagger UI URL for a service, or "" when its base URL cannot be resolved. */
export const getServiceSwaggerUrl = (service: string, baseUrl?: string): string => {
  const base = getServiceBaseUrl(service, baseUrl);
  return base ? `${base}/swagger/index.html` : "";
};
