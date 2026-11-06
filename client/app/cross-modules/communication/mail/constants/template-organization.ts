import type { IEmailConfig } from "@blocks-communication/mail/models/email";
import {
  DEFAULT_ORGANIZATION_ID,
  organizationOf,
} from "@blocks-communication/mail/constants/organization";

/**
 * The select value for "Organization default". A template stores it as an empty
 * mailConfigurationId; the select needs a non-empty value, and the form's required rule still
 * catches a configuration nobody picked.
 */
export const ORGANIZATION_DEFAULT_CONFIGURATION = "__organization_default__";

export const toConfigurationValue = (mailConfigurationId?: string | null) =>
  mailConfigurationId?.trim() ? mailConfigurationId : ORGANIZATION_DEFAULT_CONFIGURATION;

export const fromConfigurationValue = (value: string) =>
  value === ORGANIZATION_DEFAULT_CONFIGURATION ? "" : value;

const isOutbound = (config: IEmailConfig) => !config.isInbound;

/**
 * The outbound configurations a template of the organization may name: its own, and the Default
 * organization's, which every organization shares. Inbound configurations can't send mail.
 */
export const outboundConfigurationGroups = (configs: IEmailConfig[], organizationId: string) => {
  const outbound = configs.filter(isOutbound);
  return {
    own:
      organizationId === DEFAULT_ORGANIZATION_ID
        ? []
        : outbound.filter((config) => organizationOf(config) === organizationId),
    shared: outbound.filter((config) => organizationOf(config) === DEFAULT_ORGANIZATION_ID),
  };
};

/**
 * What "Organization default" sends through, as blocks-logic picks it: the organization's own
 * default, then the project default. Only from the configurations already loaded.
 */
export const resolveOrganizationDefault = (
  configs: IEmailConfig[],
  organizationId: string,
): IEmailConfig | undefined => {
  const outbound = configs.filter(isOutbound);
  return (
    outbound.find(
      (config) => config.isOrganizationDefault && organizationOf(config) === organizationId,
    ) ?? outbound.find((config) => config.isDefault)
  );
};

/** A language's name from the project's languages; its code when the project doesn't list it. */
export const languageNameOf = (
  languageCode: string | undefined | null,
  languages: Array<{ languageCode: string; languageName: string }> | undefined,
) => {
  if (!languageCode) return "-";
  return (
    languages?.find((language) => language.languageCode === languageCode)?.languageName ??
    languageCode
  );
};
