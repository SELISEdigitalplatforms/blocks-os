import { Badge } from "@/components/ui-kits/badge/badge";
import { SelectItem } from "@/components/ui-kits/select/select";
import { cn } from "@/lib/utils";
import { useT } from "@seliseblocks/genesis-os";
import type { IEmailConfig } from "@blocks-communication/mail/models/email";
import {
  ORGANIZATION_DEFAULT_CONFIGURATION,
  outboundConfigurationGroups,
} from "@blocks-communication/mail/constants/template-organization";

const CHIP_CLASS = "shrink-0 px-1.5 py-0 text-[10px]";

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

  // Small tinted pills, as the Disabled badge on the Organizations list.
  const chipFor = (config: IEmailConfig, owner: "own" | "default") => {
    if (!showOrganization) return undefined;
    if (config.isDefault) {
      return (
        <Badge variant="secondary" className={CHIP_CLASS}>
          {t("EMAIL_CONFIGURE.PROJECT_DEFAULT")}
        </Badge>
      );
    }
    return owner === "own" ? (
      <Badge variant="success" className={cn(CHIP_CLASS, "max-w-40")} title={organizationName}>
        <span className="truncate">{organizationName}</span>
      </Badge>
    ) : (
      <Badge variant="info" className={CHIP_CLASS}>
        {t("TEMPLATE_ORGANIZATION.DEFAULT_CHIP")}
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
          trailing={chipFor(config, "own")}
        >
          {config.name}
        </SelectItem>
      ))}
      {shared.map((config) => (
        <SelectItem
          key={config.itemId}
          value={config.itemId}
          trailing={chipFor(config, "default")}
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
