import { useState } from "react";
import { Pencil, Trash2, Power, PowerOff } from "lucide-react";
import { Badge } from "@/components/ui-kits/badge/badge";
import { Button } from "@/components/ui-kits/button/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui-kits/card/card";
import { showErrorToast, showSuccessToast } from "@/hooks/use-toast";
import { isErrorWithErrors } from "@/lib/error";
import { IdentityProvider } from "@blocks-idp/authentication/models/identity-provider.model";
import {
  useUpdateIdentityProviderStatus,
} from "@blocks-idp/authentication/hooks/use-identity-provider";
import { IdentityProviderFormDialog } from "./identity-provider-form-dialog";

const PROVIDER_TYPE_LABELS: Record<string, string> = {
  oidc: "OIDC",
  oauth2: "OAuth 2.0",
  saml: "SAML 2.0",
  ldap: "LDAP",
};

type Props = {
  provider: IdentityProvider;
};

const InfoItem = ({ label, value }: { label: string; value?: string }) => {
  if (!value) return null;
  return (
    <div className="min-w-0">
      <p className="mb-1 text-xs font-medium text-muted-foreground">{label}</p>
      <p className="truncate text-sm text-foreground">{value}</p>
    </div>
  );
};

export function IdentityProviderCard({ provider }: Props) {
  const [editOpen, setEditOpen] = useState(false);
  const { mutateAsync: updateStatus, isPending: isTogglingStatus } =
    useUpdateIdentityProviderStatus();

  const handleToggleStatus = async () => {
    try {
      const res = await updateStatus({
        id: provider.itemId!,
        request: { isActive: !provider.isActive },
      });
      if (!res.isSuccess) return showErrorToast({ errors: res.errors });
      showSuccessToast({
        description: `Identity provider ${provider.isActive ? "disabled" : "enabled"} successfully`,
      });
    } catch (err) {
      if (isErrorWithErrors(err)) return showErrorToast({ errors: err.errors });
      showErrorToast({ errors: "Something went wrong" });
    }
  };

  return (
    <>
      <Card className="py-5 transition-shadow hover:shadow-md">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                <Power className="h-4 w-4 text-primary" />
              </div>
              <div className="min-w-0">
                <CardTitle className="truncate text-base">{provider.displayName}</CardTitle>
                <p className="text-xs text-muted-foreground truncate">{provider.name}</p>
              </div>
              <Badge
                variant={provider.isActive ? "default" : "secondary"}
                className="shrink-0 text-xs"
              >
                {provider.isActive ? "Active" : "Inactive"}
              </Badge>
              <Badge variant="outline" className="shrink-0 text-xs">
                {PROVIDER_TYPE_LABELS[provider.providerType] ?? provider.providerType}
              </Badge>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => setEditOpen(true)}
                title="Edit"
              >
                <Pencil className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className={`h-8 w-8 ${provider.isActive ? "hover:text-destructive" : "hover:text-primary"}`}
                onClick={handleToggleStatus}
                disabled={isTogglingStatus}
                title={provider.isActive ? "Disable" : "Enable"}
              >
                {provider.isActive ? (
                  <PowerOff className="h-4 w-4" />
                ) : (
                  <Power className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {provider.description && (
            <p className="mb-4 text-sm text-muted-foreground">{provider.description}</p>
          )}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <InfoItem label="Client ID" value={provider.clientId} />
            <InfoItem label="Issuer URL" value={provider.issuerUrl} />
            <InfoItem label="Authorization URL" value={provider.authorizationUrl} />
            <InfoItem label="Token URL" value={provider.tokenUrl} />
            <InfoItem label="UserInfo URL" value={provider.userInfoUrl} />
            <InfoItem label="Scopes" value={provider.scope} />
          </div>
        </CardContent>
      </Card>

      <IdentityProviderFormDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        editItem={provider}
      />
    </>
  );
}
