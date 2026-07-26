import { Badge } from "@/components/ui-kits/badge/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui-kits/card/card";
import { MaskedText } from "@/components/masked-text";
import { ReactNode, useState } from "react";
import { CopyToClipboardButton } from "@/components/copy-to-clipboard-button";
import { format } from "date-fns";
import { IClientCredentialsConfig } from "@blocks-idp/authentication/models/auth.oidc.model";
import { Button } from "@/components/ui-kits/button/button";
import { useDeleteAuthClient } from "@blocks-idp/authentication/hooks/use-auth-clients";
import { useProjectStore } from "@seliseblocks/blocks-kit";
import { showErrorToast, showSuccessToast } from "@/hooks/use-toast";
import { Dialog } from "@/components/ui-kits/dialog/dialog";
import { ConfirmationModal } from "@/components/confirmation-modal/confirmation-modal";
import { isErrorWithErrors } from "@/lib/error";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui-kits/hover-card/hover-card";
import { Pencil } from "lucide-react";

const Item = ({ label, children }: { label: string; children: ReactNode }) => {
  return (
    <div className="min-w-0">
      <p className="mb-2 text-sm font-medium text-low-emphasis">{label}</p>
      <div className="min-w-0 text-base font-normal text-high-emphasis">{children}</div>
    </div>
  );
};

const Column = ({ children }: { children: ReactNode }) => {
  return <div className="flex min-w-0 flex-col gap-6">{children}</div>;
};

const formatLifetime = (minutes: number) => {
  if (!Number.isFinite(minutes) || minutes <= 0) return "—";
  if (minutes < 60) return `${minutes} min`;
  if (minutes < 1440) {
    const hours = Math.floor(minutes / 60);
    const rem = minutes % 60;
    return rem === 0 ? `${hours} h` : `${hours} h ${rem} m`;
  }
  const days = Math.floor(minutes / 1440);
  const rem = minutes % 1440;
  if (rem === 0) return `${days} d`;
  const hours = Math.floor(rem / 60);
  return hours === 0 ? `${days} d ${rem} m` : `${days} d ${hours} h`;
};

const formatDateTime = (value?: string) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return format(date, "dd/MM/yyyy HH:mm");
};

const VISIBLE_BADGE_LIMIT = 5;

const getBackendErrorMap = (response: unknown) => {
  if (!response || typeof response !== "object") return undefined;

  const typedResponse = response as {
    errors?: unknown;
    error?: { errors?: unknown };
  };

  if (typedResponse.errors && typeof typedResponse.errors === "object") {
    return typedResponse.errors as Record<string, string | string[]>;
  }

  if (typedResponse.error?.errors && typeof typedResponse.error.errors === "object") {
    return typedResponse.error.errors as Record<string, string | string[]>;
  }

  return undefined;
};

// const UserIdValue = ({ userId }: { userId?: string }) => {
//   if (!userId) return <span>—</span>;

//   return (
//     <CopyToClipboardButton textToCopy={userId}>
//       <MaskedText text={userId} length={30} showFirstN={4} showLastN={4} />
//     </CopyToClipboardButton>
//   );
// };

const PermissionChips = ({ permissions }: { permissions: string[] }) => {
  if (!permissions || permissions.length === 0) {
    return <span>N/A</span>;
  }
  const visible = permissions.slice(0, VISIBLE_BADGE_LIMIT);
  const remaining = permissions.length - visible.length;
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {visible.map((permission) => (
        <Badge
          key={permission}
          variant="secondary"
          className="max-w-full truncate text-xs"
          title={permission}
        >
          {permission}
        </Badge>
      ))}
      {remaining > 0 && (
        <HoverCard>
          <HoverCardTrigger asChild>
            <Badge variant="secondary" className="cursor-pointer text-xs">
              +{remaining} more
            </Badge>
          </HoverCardTrigger>
          <HoverCardContent className="max-w-xs">
            <div className="flex flex-wrap gap-1.5">
              {permissions.slice(VISIBLE_BADGE_LIMIT).map((permission) => (
                <Badge
                  key={permission}
                  variant="secondary"
                  className="max-w-full truncate text-xs"
                  title={permission}
                >
                  {permission}
                </Badge>
              ))}
            </div>
          </HoverCardContent>
        </HoverCard>
      )}
    </div>
  );
};

const RoleChips = ({ roles }: { roles: string[] }) => {
  if (!roles.length) return <span>N/A</span>;

  return (
    <div className="flex flex-wrap gap-1.5">
      {roles.map((role) => (
        <Badge key={role} variant="secondary" className="text-xs">
          {role}
        </Badge>
      ))}
    </div>
  );
};

type ClientInfoCardProps = {
  clientCredential: IClientCredentialsConfig;
  onEdit?: (client: IClientCredentialsConfig) => void;
};

export const ClientCredentialsCard = ({ clientCredential, onEdit }: ClientInfoCardProps) => {
  const [open, setOpen] = useState<boolean>(false);
  const tenantId = useProjectStore().selectedProject?.tenantId || "";
  const { mutateAsync, isPending } = useDeleteAuthClient({
    projectKey: tenantId,
  });
  const handleConfirmDelete = async (id: string) => {
    try {
      const res = await mutateAsync({ itemId: id });
      if (!res?.isSuccess) {
        const apiErrors = getBackendErrorMap(res);
        return showErrorToast({
          errors: apiErrors ?? "Failed to delete client credential.",
        });
      }
      showSuccessToast({
        description: "Client credential deleted successfully",
      });
      setOpen(false);
    } catch (error) {
      if (isErrorWithErrors(error)) return showErrorToast({ errors: error.errors });
      return showErrorToast({ errors: "Something went wrong" });
    }
  };
  return (
    <div className="grid gap-4">
      <Card
        className="overflow-hidden rounded-sm border bg-card py-4 shadow-sm sm:py-6"
        key={clientCredential.itemId}
      >
        <CardHeader className="px-4 sm:px-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
            <div className="flex min-w-0 flex-wrap items-center gap-2 sm:gap-3">
              <CardTitle className="text-lg font-semibold text-high-emphasis sm:text-xl">
                {clientCredential.name}
              </CardTitle>
              <Badge variant={clientCredential.isActive ? "success" : "secondary"}>
                {clientCredential.isActive ? "Active" : "Inactive"}
              </Badge>
            </div>
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
              {onEdit && (
                <Button
                  onClick={() => onEdit(clientCredential)}
                  variant="outline"
                  size="sm"
                  className="w-full sm:w-auto"
                  aria-label="Edit client credential"
                >
                  <Pencil className="h-4 w-4" />
                  <span className="ml-2">Edit</span>
                </Button>
              )}
              <Button
                onClick={() => {
                  setOpen(true);
                }}
                variant="outline"
                size="sm"
                className="w-full text-[#D92127] sm:w-auto"
              >
                Delete
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="px-4 sm:px-6">
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-3 lg:gap-6">
            <Column>
              <Item label="Client Id">
                <CopyToClipboardButton textToCopy={clientCredential.itemId}>
                  <MaskedText
                    text={clientCredential.itemId}
                    length={30}
                    showFirstN={4}
                    showLastN={4}
                  />
                </CopyToClipboardButton>
              </Item>
              <Item label="Role(s)">
                <RoleChips roles={clientCredential.roles ?? []} />
              </Item>
            </Column>

            <Column>
              <Item label="Client Secret">
                <CopyToClipboardButton textToCopy={clientCredential.clientSecret}>
                  <MaskedText
                    text={clientCredential.clientSecret}
                    length={30}
                    showFirstN={4}
                    showLastN={4}
                  />
                </CopyToClipboardButton>
              </Item>
              <Item label="Permission(s)">
                <PermissionChips permissions={clientCredential.permissions ?? []} />
              </Item>
            </Column>

            <Column>
              <Item label="Token lifetime">
                <span className="whitespace-nowrap">
                  {formatLifetime(clientCredential.accessTokenValidForNumberMinutes)}
                </span>
              </Item>
              <Item label="Created on">
                <span className="text-sm sm:text-base">
                  {formatDateTime(clientCredential.createdDate)}
                </span>
              </Item>
              <Item label="Updated on">
                <span className="text-sm sm:text-base">
                  {formatDateTime(clientCredential.lastUpdatedDate)}
                </span>
              </Item>
            </Column>
          </div>
        </CardContent>
      </Card>
      <Dialog open={open} onOpenChange={setOpen}>
        <ConfirmationModal
          onCancel={() => setOpen(false)}
          onConfirm={() => handleConfirmDelete(clientCredential.itemId)}
          data={{
            dialogTitle: "Delete",
            dialogSubtitle: `Are you sure you want to delete client-credential`,
          }}
          buttonState={{
            confirm: { disable: isPending },
          }}
        />
      </Dialog>
    </div>
  );
};
