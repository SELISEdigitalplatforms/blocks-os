import { SHORT_URL_BASES } from "@blocks-utilities/constants/endpoint.constant";
import { getRuntimeEnv } from "@/lib/runtime-env";
import { z } from "zod";

/** Local dev serves from localhost but talks to the dev backend, so it shares the dev short base. */
const LOCAL_HOSTNAMES = new Set(["localhost", "127.0.0.1", "[::1]"]);

/**
 * Short-URL base for the environment the app is served from, keyed off the leading label of the
 * hostname (`dev-os-546.blocksdevelopers.com` -> "dev"). Matching a bare substring against the
 * whole URL does not work here: every non-prod host sits under `blocksdevelopers.com`, which itself
 * contains "dev", so a stage host would resolve to the dev base.
 */
export const getDefaultShortUrlBase = (): string => {
  const apiBase = getRuntimeEnv("BLOCKS_OS_BASE_URL") || "";

  let hostname: string;
  try {
    hostname = new URL(apiBase).hostname;
  } catch {
    return SHORT_URL_BASES.prod;
  }

  if (LOCAL_HOSTNAMES.has(hostname)) return SHORT_URL_BASES.dev;

  const label = hostname.split(".")[0].split("-")[0];

  return label !== "prod" && SHORT_URL_BASES[label] ? SHORT_URL_BASES[label] : SHORT_URL_BASES.prod;
};

export const isValidUrl = (url: string): boolean => {
  try {
    const urlObj = new URL(url);
    if (urlObj.protocol !== "http:" && urlObj.protocol !== "https:") {
      return false;
    }
    return true;
  } catch {
    return false;
  }
};

export const magicUrlSchema = z.object({
  uri: z
    .string()
    .min(1, "URI is required")
    .regex(/^(https?:\/\/)?([\da-z.-]+)\.([a-z.]{2,6})([/\w .-]*)*\/?$/, "Please enter a valid URI")
    .refine(
      (val) => {
        try {
          new URL(val.startsWith("http") ? val : `https://${val}`);
          return true;
        } catch {
          return false;
        }
      },
      { message: "Please enter a valid URI" },
    ),
  name: z.string().min(1, "Name is required").max(100, "Name must be at most 100 characters"),
});
