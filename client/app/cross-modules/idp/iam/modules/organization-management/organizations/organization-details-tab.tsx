import { useT } from "@seliseblocks/genesis-os";
import { IOrganization } from "@blocks-idp/iam/models/organization";
import { Card, CardContent } from "@/components/ui-kits/card/card";
import { Calendar, Clock, ExternalLink, Globe, Mail, Phone, Power, SquarePen } from "lucide-react";

type DetailRowProps = {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
};

const EMPTY_VALUE = "—";

const DetailRow = ({ icon, label, value }: DetailRowProps) => (
  <div className="flex items-center gap-4 py-3 text-sm">
    <span className="flex w-52 shrink-0 items-center gap-2 text-muted-foreground">
      {icon}
      {label}
    </span>
    <div className="min-w-0 flex-1 text-high-emphasis">{value ?? EMPTY_VALUE}</div>
  </div>
);

const formatDateTime = (value?: string) => {
  if (!value) return undefined;
  try {
    return new Date(value).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return value;
  }
};

export const OrganizationDetailsTab = ({ organization }: { organization: IOrganization }) => {
  const { t } = useT("os.idp.organizations");
  return (
    <Card className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden">
      <CardContent className="min-h-0 flex-1 overflow-y-auto">
        <DetailRow
          icon={<SquarePen className="h-4 w-4" />}
          label={t("common:DESCRIPTION")}
          value={organization.description}
        />
        <DetailRow
          icon={<Power className="h-4 w-4" />}
          label={t("common:STATUS")}
          value={
            organization.isDisabled
              ? t("common:DISABLED")
              : t("ORGANIZATION_DETAILS_TAB.STATUS_ACTIVE")
          }
        />
        <DetailRow
          icon={<Globe className="h-4 w-4" />}
          label={t("ORGANIZATION_DETAILS_TAB.WEBSITE")}
          value={
            organization.websiteUrl && (
              <a
                href={organization.websiteUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-primary hover:underline"
              >
                {organization.websiteUrl}
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            )
          }
        />
        <DetailRow
          icon={<Mail className="h-4 w-4" />}
          label={t("common:EMAIL")}
          value={organization.email}
        />
        <DetailRow
          icon={<Phone className="h-4 w-4" />}
          label={t("ORGANIZATION_DETAILS_TAB.PHONE")}
          value={organization.phoneNumber}
        />
        <DetailRow
          icon={<Calendar className="h-4 w-4" />}
          label={t("ORGANIZATION_DETAILS_TAB.CREATED")}
          value={formatDateTime(organization.createdDate)}
        />
        <DetailRow
          icon={<Clock className="h-4 w-4" />}
          label={t("ORGANIZATION_DETAILS_TAB.LAST_UPDATED")}
          value={formatDateTime(organization.lastUpdatedDate)}
        />
      </CardContent>
    </Card>
  );
};
