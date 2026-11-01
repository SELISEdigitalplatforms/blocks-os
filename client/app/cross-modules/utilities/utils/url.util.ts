import { SHORT_URL_BASES } from "@blocks-utilities/constants/endpoint.constant";
import { getRuntimeEnv } from "@/lib/runtime-env";
import { z } from "zod";
import { tStatic } from "@seliseblocks/genesis-os";

const I18N_MODULE = "os.utilities";

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

export const createMagicUrlSchema = () =>
  z.object({
    uri: z
      .string()
      .min(1, tStatic(I18N_MODULE, "URL_UTIL.URI_IS_REQUIRED"))
      .regex(
        /^(https?:\/\/)?([\da-z.-]+)\.([a-z.]{2,6})[/\w .-]*\/?$/,
        tStatic(I18N_MODULE, "URL_UTIL.PLEASE_ENTER_A_VALID_URI"),
      )
      .refine(
        (val) => {
          try {
            new URL(val.startsWith("http") ? val : `https://${val}`);
            return true;
          } catch {
            return false;
          }
        },
        { message: tStatic(I18N_MODULE, "URL_UTIL.PLEASE_ENTER_A_VALID_URI") },
      ),
    name: z
      .string()
      .min(1, tStatic(I18N_MODULE, "URL_UTIL.NAME_IS_REQUIRED"))
      .max(100, tStatic(I18N_MODULE, "URL_UTIL.NAME_MUST_BE_AT_MOST")),
  });
