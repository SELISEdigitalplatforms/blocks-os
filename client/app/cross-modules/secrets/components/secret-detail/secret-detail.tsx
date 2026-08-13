import { format } from "date-fns";
import { Clock, Fingerprint, PenLine, RefreshCw, ShieldCheck, Trash2, User } from "lucide-react";
import { Badge } from "@/components/ui-kits/badge/badge";
import { CopyToClipboardButton } from "@/components/copy-to-clipboard-button";
import {
  useResolvedRoleNames,
  useResolvedUserNames,
} from "@/cross-modules/secrets/hooks/use-access-labels";
import { SECRET_TYPE, type SecretResult } from "@/cross-modules/secrets/models/secret.model";

/**
 * Actor ids are deliberately not rendered.
 *
 * The API returns them as raw GUIDs, and a 36-character identifier trailing every timestamp is
 * noise, not provenance — the audit log is where "who" belongs, resolved and searchable.
 */
const formatMoment = (value?: string | null): string => {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : format(date, "dd MMM yyyy, HH:mm");
};

const Stat = ({
  icon: Icon,
  label,
  children,
}: {
  icon: typeof Clock;
  label: string;
  children: React.ReactNode;
}) => (
  <div className="flex items-start gap-2.5">
    <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-background text-muted-foreground ring-1 ring-border">
      <Icon className="h-3.5 w-3.5" />
    </span>
    <div className="min-w-0">
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <div className="text-sm text-high-emphasis">{children}</div>
    </div>
  </div>
);

const ChipList = ({
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
      <Badge key={id} variant="secondary" className="w-fit gap-1 font-normal">
        <Icon className="h-3 w-3 shrink-0 text-muted-foreground" />
        <span className="max-w-[220px] truncate" title={labels[id] ?? id}>
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
    // No border or fill: the panel reads as part of its row rather than as a nested card.
    <div className="px-4 py-3">
      <div className="grid gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
        <Stat icon={Fingerprint} label="Secret ID">
          <CopyToClipboardButton textToCopy={secret.secretId}>
            <span className="break-all font-mono text-xs">{secret.secretId}</span>
          </CopyToClipboardButton>
        </Stat>

        <Stat icon={PenLine} label="Description">
          {secret.description || <span className="italic text-muted-foreground">None</span>}
        </Stat>

        <Stat icon={Clock} label="Created">
          {formatMoment(secret.createdDate)}
        </Stat>

        <Stat icon={Clock} label="Last updated">
          {formatMoment(secret.lastUpdatedDate)}
        </Stat>

        {secret.rotationCount > 0 && (
          <Stat icon={RefreshCw} label="Rotations">
            <span>
              {secret.rotationCount}
              <span className="ml-1.5 text-xs text-muted-foreground">
                last {formatMoment(secret.lastRotatedDate)}
              </span>
            </span>
          </Stat>
        )}

        {secret.deletedDate && (
          <Stat icon={Trash2} label="Deleted">
            {formatMoment(secret.deletedDate)}
          </Stat>
        )}
      </div>

      {isApi && (
        <div className="mt-4 grid gap-x-8 gap-y-4 sm:grid-cols-2">
          <Stat icon={User} label="Allowed users">
            {access.userIds.length ? (
              <ChipList ids={access.userIds} labels={userNames} icon={User} />
            ) : (
              <span className="italic text-muted-foreground">None</span>
            )}
          </Stat>
          <Stat icon={ShieldCheck} label="Allowed roles">
            {access.roles.length ? (
              <ChipList ids={access.roles} labels={roleNames} icon={ShieldCheck} />
            ) : (
              <span className="italic text-muted-foreground">None</span>
            )}
          </Stat>
          {!hasAccessEntries && (
            // An empty access list is not "everyone" — it is the creator plus root.
            <p className="text-xs text-muted-foreground sm:col-span-2">
              Only the creator and platform administrators can read this secret.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
