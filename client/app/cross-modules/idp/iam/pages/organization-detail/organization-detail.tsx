import PageBreadcrumb from "@/components/breadcrumb/breadcrumb";
import { useGetOrganizationById } from "@blocks-idp/iam/hooks/use-organization";
import { useProjectStore, useT } from "@seliseblocks/genesis-os";
import { Card } from "@/components/ui-kits/card/card";
import { Badge } from "@/components/ui-kits/badge/badge";
import { Skeleton } from "@/components/ui-kits/skeleton/skeleton";
import { Calendar, Globe, History, Languages, Mail, MapPin, Phone } from "lucide-react";
import {
  OrganizationUsers,
  InviteOrganizationUser,
} from "@blocks-idp/iam/modules/organization-management/organization-users";
import type { IOrganization } from "@blocks-idp/iam/models/organization";

type InfoRowProps = {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
};

const EMPTY_VALUE = "—";

const InfoRow = ({ icon, label, value }: InfoRowProps) => (
  <div className="flex items-center justify-between gap-3 py-2 text-sm">
    <span className="flex shrink-0 items-center gap-2 text-muted-foreground">
      {icon}
      {label}
    </span>
    <div className="min-w-0 truncate text-right font-medium text-high-emphasis">
      {value ?? EMPTY_VALUE}
    </div>
  </div>
);

const formatDate = (value?: string) => {
  if (!value) return undefined;
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
};

export const OrganizationDetail = ({ id }: { id: string }) => {
  const { t } = useT("os.idp.iam");
  const tenantId = useProjectStore().selectedProject?.tenantId || "";
  const { data, isLoading } = useGetOrganizationById({ itemId: id, projectKey: tenantId });

  const org: IOrganization | undefined = data?.organization;

  // The shared breadcrumb map already resolves /app/iam/organization-detail back to the
  // organizations list, so only the leaf segment title has to be supplied here.
  const breadcrumbTitles = org?.name
    ? { [`/app/iam/organization-detail/${id}`]: org.name }
    : undefined;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="mb-4 shrink-0 md:mb-6">
        <PageBreadcrumb breadcrumbIndex={4} customTitles={breadcrumbTitles} />
      </div>

      <div className="mb-4 flex shrink-0 flex-wrap items-center gap-3 md:mb-6">
        {isLoading ? (
          <Skeleton className="h-8 w-48" />
        ) : (
          <h3 className="text-2xl font-bold tracking-tight text-high-emphasis">
            {org?.name ?? t("ORGANIZATION_DETAIL.TITLE_FALLBACK")}
          </h3>
        )}
        {org && (
          <Badge variant={org.isDisabled ? "secondary" : "success"}>
            {org.isDisabled ? t("common:DISABLED") : t("ORGANIZATION_DETAIL.STATUS_ACTIVE")}
          </Badge>
        )}
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-6 lg:grid-cols-12">
        <aside className="lg:col-span-3 xl:col-span-2">
          <Card className="sticky top-4 border-none shadow-xs">
            <div className="divide-y divide-border">
              <InfoRow
                icon={<Mail className="h-3.5 w-3.5" />}
                label={t("common:EMAIL")}
                value={org?.email}
              />
              <InfoRow
                icon={<Phone className="h-3.5 w-3.5" />}
                label={t("ORGANIZATION_DETAIL.LABEL_PHONE")}
                value={org?.phoneNumber}
              />
              <InfoRow
                icon={<Globe className="h-3.5 w-3.5" />}
                label={t("ORGANIZATION_DETAIL.LABEL_WEBSITE")}
                value={org?.websiteUrl}
              />
              <InfoRow
                icon={<Languages className="h-3.5 w-3.5" />}
                label={t("ORGANIZATION_DETAIL.LABEL_LANGUAGE")}
                value={org?.language}
              />
              <InfoRow
                icon={<MapPin className="h-3.5 w-3.5" />}
                label={t("ORGANIZATION_DETAIL.LABEL_ADDRESSES")}
                value={
                  Array.isArray(org?.addresses) && org.addresses.length > 0
                    ? t("ORGANIZATION_DETAIL.ADDRESSES_CONFIGURED", { count: org.addresses.length })
                    : t("ORGANIZATION_DETAIL.ADDRESSES_NONE")
                }
              />
              <InfoRow
                icon={<Calendar className="h-3.5 w-3.5" />}
                label={t("ORGANIZATION_DETAIL.LABEL_CREATED")}
                value={formatDate(org?.createdDate)}
              />
              <InfoRow
                icon={<History className="h-3.5 w-3.5" />}
                label={t("ORGANIZATION_DETAIL.LABEL_UPDATED")}
                value={formatDate(org?.lastUpdatedDate)}
              />
            </div>
          </Card>
        </aside>

        <section className="flex min-h-0 flex-col lg:col-span-9 xl:col-span-10">
          <OrganizationUsers
            organizationId={id}
            action={<InviteOrganizationUser organizationId={id} organizationName={org?.name} />}
          />
        </section>
      </div>
    </div>
  );
};
