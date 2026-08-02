import { IOrganization } from "@blocks-idp/iam/models/organization";
import { useGetRoles } from "@blocks-idp/iam/hooks/use-roles";
import { Card, CardContent } from "@/components/ui-kits/card/card";
import {
  Calendar,
  Clock,
  ExternalLink,
  Globe,
  Mail,
  Phone,
  Power,
  SquarePen,
  UserCog,
} from "lucide-react";

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
  // The OS GetRolesPayload carries no projectKey; the role service scopes by the
  // active tenant itself, so the iam-side projectKey argument is dropped here.
  const { data: rolesData } = useGetRoles({
    page: 0,
    pageSize: 1000,
    sort: { property: "Name", isDescending: false },
    filter: { search: "" },
  });
  const roleNameBySlug = new Map((rolesData?.data || []).map((role) => [role.slug, role.name]));
  const defaultRoleNames = (organization.defaultRoleForMembers || [])
    .map((slug) => roleNameBySlug.get(slug) ?? slug)
    .join(", ");

  return (
    <Card className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden">
      <CardContent className="min-h-0 flex-1 overflow-y-auto">
        <DetailRow
          icon={<SquarePen className="h-4 w-4" />}
          label="Description"
          value={organization.description}
        />
        <DetailRow
          icon={<Power className="h-4 w-4" />}
          label="Status"
          value={organization.isDisabled ? "Disabled" : "Active"}
        />
        <DetailRow
          icon={<Globe className="h-4 w-4" />}
          label="Website"
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
        <DetailRow icon={<Mail className="h-4 w-4" />} label="Email" value={organization.email} />
        <DetailRow
          icon={<Phone className="h-4 w-4" />}
          label="Phone"
          value={organization.phoneNumber}
        />
        <DetailRow
          icon={<Calendar className="h-4 w-4" />}
          label="Created"
          value={formatDateTime(organization.createdDate)}
        />
        <DetailRow
          icon={<Clock className="h-4 w-4" />}
          label="Last updated"
          value={formatDateTime(organization.lastUpdatedDate)}
        />
        <DetailRow
          icon={<UserCog className="h-4 w-4" />}
          label="Default role for new members"
          value={defaultRoleNames || undefined}
        />
      </CardContent>
    </Card>
  );
};
