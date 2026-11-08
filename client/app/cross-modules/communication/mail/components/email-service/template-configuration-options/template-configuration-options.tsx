import { Badge } from "@/components/ui-kits/badge/badge";
import { SelectItem } from "@/components/ui-kits/select/select";
import { useT } from "@seliseblocks/genesis-os";
import type { IEmailConfig } from "@blocks-communication/mail/models/email";
import {
  ORGANIZATION_DEFAULT_CONFIGURATION,
  outboundConfigurationGroups,
} from "@blocks-communication/mail/constants/template-organization";

interface TemplateConfigurationOptionsProps {
  configs: IEmailConfig[];
  /** The template's organization. */
  organizationId: string;
  organizationName: string;
  /** Multi-org on: each configuration carries a chip saying whose it is. */
  showOrganization: boolean;
}

/**
 * The Email Configuration choices of a template: "Organization default", the organization's own
 * outbound configurations, then the Default organization's. Inbound ones never appear. Render it
 * inside SelectContent; `ConfigurationHint` explains the choice under the select.
 */
export function TemplateConfigurationOptions({
  configs,
  organizationId,
  organizationName,
  showOrganization,
}: Readonly<TemplateConfigurationOptionsProps>) {
  const { t } = useT("os.communication.mail");
  const { own, shared } = outboundConfigurationGroups(configs, organizationId);

  const chipFor = (config: IEmailConfig, owner: string) => {
    if (!showOrganization) return undefined;
    return config.isDefault ? (
      <Badge variant="secondary" className="py-0.5">
        {t("EMAIL_CONFIGURE.PROJECT_DEFAULT")}
      </Badge>
    ) : (
      <Badge variant="outline" className="py-0.5 font-medium text-low-emphasis">
        {owner}
      </Badge>
    );
  };

  return (
    <>
      <SelectItem value={ORGANIZATION_DEFAULT_CONFIGURATION}>
        {t("TEMPLATE_ORGANIZATION.ORGANIZATION_DEFAULT")}
      </SelectItem>
      {own.map((config) => (
        <SelectItem
          key={config.itemId}
          value={config.itemId}
          trailing={chipFor(config, organizationName)}
        >
          {config.name}
        </SelectItem>
      ))}
      {shared.map((config) => (
        <SelectItem
          key={config.itemId}
          value={config.itemId}
          trailing={chipFor(config, t("EMAIL_CONFIGURE.DEFAULT_ORGANIZATION"))}
        >
          {config.name}
        </SelectItem>
      ))}
    </>
  );
}

/** The line under a template's Email Configuration select. */
export function ConfigurationHint({ value }: Readonly<{ value?: string }>) {
  const { t } = useT("os.communication.mail");
  return (
    <p className="text-sm text-low-emphasis">
      {value === ORGANIZATION_DEFAULT_CONFIGURATION
        ? t("TEMPLATE_ORGANIZATION.ORGANIZATION_DEFAULT_DESCRIPTION")
        : t("TEMPLATE_ORGANIZATION.OUTBOUND_ONLY_HINT")}
    </p>
  );
}
