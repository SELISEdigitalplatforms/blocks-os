import { useState } from "react";
import {
  Building2,
  ChevronRight,
  Copy,
  Eye,
  EyeOff,
  Pencil,
  Power,
  PowerOff,
  Shield,
  Users,
  Key,
} from "lucide-react";
import { Badge } from "@/components/ui-kits/badge/badge";
import { Button } from "@/components/ui-kits/button/button";
import { Card, CardContent } from "@/components/ui-kits/card/card";
import { Skeleton } from "@/components/ui-kits/skeleton/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui-kits/table/table";
import { CopyToClipboardButton } from "@/components/copy-to-clipboard-button";
import { MaskedText } from "@/components/masked-text";
import { showErrorToast, showSuccessToast } from "@/hooks/use-toast";
import { isErrorWithErrors } from "@/lib/error";
import { IdentityProvider } from "@blocks-idp/authentication/models/identity-provider.model";
import {
  useGetIdentityProviders,
  useUpdateIdentityProviderStatus,
} from "@blocks-idp/authentication/hooks/use-identity-provider";
import { IdentityProviderFormDialog } from "./identity-provider-form-dialog";
import { format } from "date-fns";

const PROVIDER_CONFIG: Record<
  string,
  { label: string; Icon: React.ElementType; iconBg: string; iconColor: string }
> = {
  social: {
    label: "Social",
    Icon: Users,
    iconBg: "bg-blue-100 dark:bg-blue-950",
    iconColor: "text-blue-600 dark:text-blue-400",
  },
  byos: {
    label: "BYOS",
    Icon: Key,
    iconBg: "bg-purple-100 dark:bg-purple-950",
    iconColor: "text-purple-600 dark:text-purple-400",
  },
  "blocks-oidc": {
    label: "Blocks OIDC",
    Icon: Shield,
    iconBg: "bg-emerald-100 dark:bg-emerald-950",
    iconColor: "text-emerald-600 dark:text-emerald-400",
  },
};

const DEFAULT_PROVIDER_CONFIG = {
  label: "OIDC",
  Icon: Shield,
  iconBg: "bg-muted",
  iconColor: "text-muted-foreground",
};

const SKELETON_ROWS = 3;

interface KVRowProps {
  label: string;
  value: string;
  isSecret?: boolean;
}

const KVRow = ({ label, value, isSecret = false }: KVRowProps) => {
  const [revealed, setRevealed] = useState(false);

  return (
    <TableRow className="group bg-muted/20 hover:bg-muted/30">
      <TableCell className="w-8 pl-4" />
      <TableCell className="py-2 pl-8 font-mono text-xs text-muted-foreground" colSpan={1}>
        {label}
      </TableCell>
      <TableCell className="py-2" colSpan={2}>
        <div className="flex items-center gap-2">
          <div className="min-w-0 flex-1 font-mono text-xs">
            {value ? (
              revealed || !isSecret ? (
                <span className="break-all text-high-emphasis">{value}</span>
              ) : (
                <MaskedText text={value} length={Math.min(value.length, 36)} />
              )
            ) : (
              <span className="italic text-muted-foreground">empty</span>
            )}
          </div>
          {value && (
            <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
              {isSecret && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 text-muted-foreground hover:text-high-emphasis"
                  onClick={() => setRevealed((r) => !r)}
                >
                  {revealed ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                </Button>
              )}
              <CopyToClipboardButton textToCopy={value}>
                <span />
              </CopyToClipboardButton>
            </div>
          )}
        </div>
      </TableCell>
      <TableCell />
    </TableRow>
  );
};

interface IdentityProviderRowProps {
  item: IdentityProvider;
  defaultExpanded?: boolean;
}

const IdentityProviderRow = ({ item, defaultExpanded = false }: IdentityProviderRowProps) => {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [showEditModal, setShowEditModal] = useState(false);
  const { mutateAsync: updateStatus, isPending: isUpdating } = useUpdateIdentityProviderStatus();

  const cfg = PROVIDER_CONFIG[item.providerType] ?? DEFAULT_PROVIDER_CONFIG;
  const Icon = cfg.Icon;
  const createdAt = item.createdDate ? format(new Date(item.createdDate), "dd MMM yyyy") : "—";

  const handleToggleStatus = async () => {
    try {
      const res = await updateStatus({
        id: item.itemId!,
        request: { isActive: !item.isActive },
      });
      if (!res.isSuccess) return showErrorToast({ errors: res.errors });
      showSuccessToast({
        description: `Identity provider ${item.isActive ? "disabled" : "enabled"} successfully`,
      });
    } catch (err) {
      if (isErrorWithErrors(err)) return showErrorToast({ errors: err.errors });
      showErrorToast({ errors: "Something went wrong" });
    }
  };

  const kvPairs: { key: string; value: string; isSecret?: boolean }[] = [
    { key: "Client ID", value: item.clientId, isSecret: true },
    { key: "Client Secret", value: item.clientSecret, isSecret: true },
    { key: "Issuer URL", value: item.issuer ?? "" },
    { key: "Authorization URL", value: item.authorizationUrl ?? "" },
    { key: "Token URL", value: item.tokenUrl ?? "" },
    { key: "User Info URL", value: item.userInfoUrl ?? "" },
    { key: "Well-known URI", value: item.jwksUri ?? "" },
    { key: "Scope", value: item.scope ?? "" },
    { key: "Audience", value: item.audience ?? "" },
    { key: "Redirect URI(s)", value: (item.redirectUris ?? item.redirectUri)?.join(", ") ?? "" },
    {
      key: "Roles",
      value: item.initialRoles?.length ? item.initialRoles.join(", ") : "",
    },
    {
      key: "Permissions",
      value: item.initialPermissions?.length ? item.initialPermissions.join(", ") : "",
    },
    // {
    //   key: "PKCE",
    //   value: item.requirePkce ? "Required" : "",
    // },
  ].filter((pair) => pair.value);

  return (
    <>
      <TableRow
        className={`${kvPairs.length > 0 ? "cursor-pointer" : ""} hover:bg-muted/50`}
        onClick={() => kvPairs.length > 0 && setExpanded((e) => !e)}
      >
        <TableCell className="w-8 py-3.5 pl-4">
          {kvPairs.length > 0 ? (
            <ChevronRight
              className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${expanded ? "rotate-90" : ""}`}
            />
          ) : (
            <span className="block h-4 w-4" />
          )}
        </TableCell>
        <TableCell className="py-3.5">
          <div className="flex items-center gap-3">
            <div
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${cfg.iconBg}`}
            >
              <Icon className={`h-4 w-4 ${cfg.iconColor}`} />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{item.displayName}</p>
              <p className="truncate font-mono text-xs text-muted-foreground">{item.provider}</p>
            </div>
          </div>
        </TableCell>
        <TableCell className="py-3.5">
          <Badge variant="outline" className="text-xs">
            {cfg.label}
          </Badge>
        </TableCell>
        <TableCell className="py-3.5 text-sm text-muted-foreground">{createdAt}</TableCell>
        <TableCell className="py-3.5 pr-4 text-right" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-end gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              onClick={() => setShowEditModal(true)}
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
              onClick={handleToggleStatus}
              disabled={isUpdating}
            >
              {item.isActive ? (
                <PowerOff className="h-3.5 w-3.5" />
              ) : (
                <Power className="h-3.5 w-3.5" />
              )}
            </Button>
          </div>
        </TableCell>
      </TableRow>

      {expanded &&
        kvPairs.map(({ key, value, isSecret }) => (
          <KVRow key={key} label={key} value={value} isSecret={isSecret} />
        ))}

      <IdentityProviderFormDialog
        open={showEditModal}
        onOpenChange={(open) => {
          if (!open) setShowEditModal(false);
        }}
        editItem={item}
      />
    </>
  );
};

const LoadingSkeleton = () => (
  <Card>
    <CardContent className="p-0">
      <div className="border-b px-4 py-3 flex items-center gap-4 bg-muted/40">
        <Skeleton className="h-3 w-4" />
        <Skeleton className="h-3 w-28" />
        <Skeleton className="h-3 w-12" />
        <Skeleton className="h-3 w-24" />
      </div>
      {Array.from({ length: SKELETON_ROWS }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 border-b px-4 py-4 last:border-0">
          <Skeleton className="h-4 w-4 rounded" />
          <div className="flex items-center gap-2 flex-1">
            <Skeleton className="h-9 w-9 rounded-lg" />
            <div>
              <Skeleton className="mb-1 h-4 w-32" />
              <Skeleton className="h-3 w-24" />
            </div>
          </div>
          <Skeleton className="h-5 w-16 rounded-full" />
          <Skeleton className="h-3 w-24" />
          <div className="ml-auto flex gap-1.5">
            <Skeleton className="h-7 w-7 rounded" />
            <Skeleton className="h-7 w-7 rounded" />
          </div>
        </div>
      ))}
    </CardContent>
  </Card>
);

export function IdentityProviderList() {
  const { data, isLoading, isFetching } = useGetIdentityProviders();

  const providers = data?.data ?? [];

  if (isLoading) return <LoadingSkeleton />;

  if (providers.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-16">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
            <Building2 className="h-6 w-6 text-muted-foreground" />
          </div>
          <p className="text-sm font-medium text-high-emphasis">No identity providers yet</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Add your first identity provider to get started.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-8 pl-4" />
              <TableHead className="text-xs font-semibold uppercase tracking-wide text-high-emphasis">
                Provider
              </TableHead>
              <TableHead className="text-xs font-semibold uppercase tracking-wide text-high-emphasis">
                Type
              </TableHead>
              <TableHead className="text-xs font-semibold uppercase tracking-wide text-high-emphasis">
                Created On
              </TableHead>
              <TableHead className="w-20" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {providers.map((provider, index) => (
              <IdentityProviderRow
                key={provider.itemId}
                item={provider}
                defaultExpanded={index === 0}
              />
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
