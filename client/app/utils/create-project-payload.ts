import { getRuntimeEnv } from "@/lib/runtime-env";
import { shortGuidGenerator } from "@/components/create-project/utils";

/** A GitHub repository linked to the project, as the wizard's resources step collects them. */
export type CreateProjectAsset = {
  full_name: string;
  html_url: string;
  id?: number | string;
};

export type CreateProjectEnvironment = { value: string };

export type BuildCreateProjectPayloadInput = {
  name: string;
  isAcceptBlocksTerms: boolean;
  isUseBlocksExclusively: boolean;
  environments: CreateProjectEnvironment[];
  assets?: CreateProjectAsset[];
  baseDomain?: string;
  shortGuid?: string;
};

export type CreateProjectPayload = {
  name: string;
  isAcceptBlocksTerms: boolean;
  isUseBlocksExclusively: boolean;
  resources: { name: string; link: string; resourceId: string }[];
  applicationContexts: { environment: string; domain: string; cookieDomain: string }[];
};

/**
 * The one place the Project/Create request body is built. Both the create-project wizard and
 * the /connect flow's no-project branch must send an identical payload shape (AC3.4): same
 * domain derivation, same terms flags, same resources mapping.
 */
export const buildCreateProjectPayload = ({
  name,
  isAcceptBlocksTerms,
  isUseBlocksExclusively,
  environments,
  assets = [],
  baseDomain = getRuntimeEnv("BLOCKS_BASE_DOMAIN") || "seliseblocks.com",
  shortGuid = shortGuidGenerator(5),
}: BuildCreateProjectPayloadInput): CreateProjectPayload => ({
  name,
  isAcceptBlocksTerms,
  isUseBlocksExclusively,
  resources: assets.map((asset) => ({
    name: asset.full_name,
    link: asset.html_url,
    resourceId: asset.id !== undefined ? String(asset.id) : "",
  })),
  applicationContexts:
    environments.map((env) => ({
      environment: env.value,
      domain: `https://${env.value === "main" ? "" : env.value}-${shortGuid}.${baseDomain}`,
      cookieDomain: baseDomain,
    })) || [],
});
