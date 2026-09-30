import { IIntegrationDetails } from "@/cross-modules/integration/models/integration.model";

type ProjectDomainSource = {
  customDomain?: string | null;
  applications?: { domain: string }[] | null;
} | null;

/** The project's own domain: its custom domain when set, otherwise its first application's. */
export const resolveProjectDomain = (project: ProjectDomainSource | undefined): string =>
  project?.customDomain || project?.applications?.[0]?.domain || "";

/** The JSON a developer pastes into their app's configuration. */
export const toIntegrationJson = (details: IIntegrationDetails): string =>
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
