import { format } from "date-fns";
import { ShieldCheck, User } from "lucide-react";
import { Badge } from "@/components/ui-kits/badge/badge";
import { CopyToClipboardButton } from "@/components/copy-to-clipboard-button";
import {
  useResolvedRoleNames,
  useResolvedUserNames,
} from "@/cross-modules/secrets/hooks/use-access-labels";
import {
  SECRET_TYPE,
  type SecretResult,
} from "@/cross-modules/secrets/models/secret.model";

const formatMoment = (value?: string | null): string => {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : format(date, "dd MMM yyyy, HH:mm");
};

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="space-y-0.5">
    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
    <div className="text-sm text-high-emphasis">{children}</div>
  </div>
);

const LabelledChips = ({
  ids,
  labels,
  icon: Icon,
}: {
  ids: string[];
  labels: Record<string, string>;
  icon: typeof User;
}) => (
  <div className="flex flex-wrap gap-1.5">
    {ids.map((id) => (
      <Badge key={id} variant="secondary" className="gap-1 font-normal">
        <Icon className="h-3 w-3 shrink-0 text-muted-foreground" />
        <span className="max-w-[200px] truncate" title={labels[id] ?? id}>
          {labels[id] ?? id}
        </span>
      </Badge>
    ))}
  </div>
);

/**
 * Expanded-row detail for one secret.
 *
 * Renders only fields the API actually returns. There is deliberately no key count, no
 * key-value pairs, no "managed by", no resource reference and no Key Vault name, URI or
 * version: none of those exist in the contract, and the vault coordinates are withheld by
 * design rather than merely absent.
 */
export function SecretDetail({ secret }: { secret: SecretResult }) {
  const access = secret.access ?? { userIds: [], roles: [] };
  const isApi = secret.type === SECRET_TYPE.Api;

  const userNames = useResolvedUserNames(isApi ? access.userIds : []);
  const roleNames = useResolvedRoleNames(isApi ? access.roles : []);

  const hasAccessEntries = access.userIds.length > 0 || access.roles.length > 0;

  return (
    <div className="space-y-4 bg-muted/20 px-4 py-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Secret ID">
          <CopyToClipboardButton textToCopy={secret.secretId}>
            <span className="break-all font-mono text-xs">{secret.secretId}</span>
          </CopyToClipboardButton>
        </Field>

        <Field label="Description">
          {secret.description ? (
            secret.description
          ) : (
            <span className="italic text-muted-foreground">No description</span>
          )}
        </Field>

        <Field label="Created">
          {formatMoment(secret.createdDate)}
          {secret.createdBy && (
            <span className="block truncate font-mono text-xs text-muted-foreground">
              by {secret.createdBy}
            </span>
          )}
        </Field>

        <Field label="Last updated">
          {formatMoment(secret.lastUpdatedDate)}
          {secret.lastUpdatedBy && (
            <span className="block truncate font-mono text-xs text-muted-foreground">
              by {secret.lastUpdatedBy}
            </span>
          )}
        </Field>

        {secret.rotationCount > 0 && (
          <Field label="Rotations">
            {secret.rotationCount}
            <span className="block text-xs text-muted-foreground">
              last {formatMoment(secret.lastRotatedDate)}
              {secret.lastRotatedBy ? ` by ${secret.lastRotatedBy}` : ""}
            </span>
          </Field>
        )}

        {secret.deletedDate && (
          <Field label="Deleted">
            {formatMoment(secret.deletedDate)}
            {secret.deletedBy && (
              <span className="block truncate font-mono text-xs text-muted-foreground">
                by {secret.deletedBy}
              </span>
            )}
          </Field>
        )}
      </div>

      {isApi ? (
        <div className="grid gap-4 border-t pt-4 sm:grid-cols-2">
          <Field label="Allowed users">
            {access.userIds.length ? (
              <LabelledChips ids={access.userIds} labels={userNames} icon={User} />
            ) : (
              <span className="italic text-muted-foreground">None</span>
            )}
          </Field>
          <Field label="Allowed roles">
            {access.roles.length ? (
              <LabelledChips ids={access.roles} labels={roleNames} icon={ShieldCheck} />
            ) : (
              <span className="italic text-muted-foreground">None</span>
            )}
          </Field>
          {!hasAccessEntries && (
            // An empty access list is not "everyone" — it is the creator plus root.
            <p className="text-sm text-muted-foreground sm:col-span-2">
              Only the creator and platform administrators can read this secret.
            </p>
          )}
        </div>
      ) : (
        <p className="border-t pt-4 text-sm text-muted-foreground">
          Service secrets are consumed by backend services.
        </p>
      )}
    </div>
  );
}
