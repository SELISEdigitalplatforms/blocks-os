import { getRuntimeEnv, type RuntimeKey } from "@/lib/runtime-env";
import { IConnectDetails } from "@/cross-modules/connect/models/connect.model";

/** Which Blocks service each template connects to, as the base URL a client should call. */
const TEMPLATE_BASE_URL_KEYS: Record<string, RuntimeKey> = {
  localization: "BLOCKS_LOCALIZATION_BASE_URL",
};

export const resolveConnectBaseUrl = (templateKey: string): string => {
  const key = TEMPLATE_BASE_URL_KEYS[templateKey];
  return key ? getRuntimeEnv(key).replace(/\/$/, "") : "";
};

type ProjectDomainSource = {
  customDomain?: string | null;
  applications?: { domain: string }[] | null;
} | null;

/** The project's own domain: its custom domain when set, otherwise its first application's. */
export const resolveProjectDomain = (project: ProjectDomainSource | undefined): string =>
  project?.customDomain || project?.applications?.[0]?.domain || "";

/** The JSON a developer pastes into their app's configuration. */
export const toConnectJson = (details: IConnectDetails): string =>
  JSON.stringify(
    {
      clientId: details.clientId,
      clientSecret: details.clientSecret,
      "x-blocks-key": details.xBlocksKey,
      baseUrl: details.baseUrl,
      domain: details.domain,
    },
    null,
    2,
  );
