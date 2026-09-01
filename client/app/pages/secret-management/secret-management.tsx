import { PageHeader } from "@/components/page-header/page-header";
import PageBreadcrumb from "@/components/breadcrumb/breadcrumb";
import { Button } from "@/components/ui-kits/button/button";
import { DialogTrigger } from "@/components/ui-kits/dialog/dialog";
import { SECRET_MANAGEMENT_NAV_GROUPS } from "@/constants/secret-management-nav";
import { CreateSecretButton } from "@/cross-modules/secrets/components/secret-form-modal/create-secret-button";
import { CreateClientCredential } from "@blocks-idp/authentication/components/create-client-credential/create-client-credential";
import { useListAuthClientCredentials } from "@blocks-idp/authentication/hooks/use-auth-clients";
import { AddService } from "@blocks-identifier/components/add-service/add-service";
import { CreateOIDC } from "@blocks-idp/authentication/components/create-oidc";
import { useGetSavedPublicCertificates } from "@blocks-idp/authentication/hooks/use-identifier";
import { ConfigureCaptchaModal } from "@blocks-idp/captcha/modals/configure-captcha-modal";
import { ConfigureMagicUrlModal } from "@blocks-utilities/components/magic-url-config-dialog/configure-magic-url-modal";
import {
  OidcBrandingHeaderProvider,
  useOidcBrandingHeaderOptional,
} from "@blocks-idp/authentication/contexts/oidc-branding-header-context";
import { PrimaryButton } from "@/components/action-buttons/primary-button";
import { useProjectStore } from "@seliseblocks/genesis-os";
import { Pencil, Plus, Loader2, Notebook, Waypoints, LayoutTemplate } from "lucide-react";
import { parseAsBoolean, parseAsString, useQueryState } from "nuqs";
import { Outlet, useLocation, useNavigate } from "react-router";
import { useScopedPath } from "@seliseblocks/genesis-os/hooks";

function SecretManagementHeaderActions({
  isOidcBranding,
  currentPath,
  setIsAddIdpOpen,
  setIsEmailConfigOpen,
  setIsNotificationConfigOpen,
  setIsManagedServicesGuideOpen,
  setIsJwtClaimOpen,
  setIsEditExternalIdpOpen,
  setIsClientCredentialOpen,
  externalIdpConfigured,
}: {
  isOidcBranding: boolean;
  currentPath: string;
  setIsAddIdpOpen: (value: boolean) => void;
  setIsEmailConfigOpen: (value: boolean) => void;
  setIsNotificationConfigOpen: (value: boolean) => void;
  setIsManagedServicesGuideOpen: (value: boolean) => void;
  setIsJwtClaimOpen: (value: boolean) => void;
  setIsEditExternalIdpOpen: (value: boolean) => void;
  setIsClientCredentialOpen: (value: boolean) => void;
  externalIdpConfigured: boolean;
}) {
  const brandingHeader = useOidcBrandingHeaderOptional();
  const navigate = useNavigate();
  const scoped = useScopedPath();

  if (isOidcBranding && brandingHeader?.actions) {
    const { onSave, onUndo, isBusy, isDirty, isValid } = brandingHeader.actions;
    return (
      <>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onUndo}
          disabled={isBusy || !isDirty}
        >
          Undo
        </Button>
        <Button type="button" size="sm" onClick={onSave} disabled={isBusy || !isDirty || !isValid}>
          {isBusy ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving…
            </>
          ) : (
            "Save"
          )}
        </Button>
      </>
    );
  }

  return (
    <>
      {!isOidcBranding && currentPath === "oidc" && (
        <>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => navigate(scoped("secret-management/oidc/branding"))}
          >
            <LayoutTemplate className="h-4 w-4" />
            <span className="ml-2">Manage Template</span>
          </Button>
          <CreateOIDC />
        </>
      )}
      {currentPath === "client-credentials" && (
        <Button size="sm" onClick={() => setIsClientCredentialOpen(true)}>
          <Plus className="h-5 w-5" />
          <span className="sr-only sm:not-sr-only sm:ml-2.5 sm:text-sm sm:whitespace-nowrap">
            Add
          </span>
        </Button>
      )}
      {currentPath === "identity-providers" && (
        <Button size="sm" onClick={() => setIsAddIdpOpen(true)}>
          <Plus className="h-5 w-5" />
          <span className="sr-only sm:not-sr-only sm:ml-2.5 sm:text-sm sm:whitespace-nowrap">
            Add
          </span>
        </Button>
      )}
      {currentPath === "captcha" && (
        <ConfigureCaptchaModal>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="h-5 w-5" />
              <span className="sr-only sm:not-sr-only sm:ml-2.5 sm:text-sm sm:whitespace-nowrap">
                Add Configuration
              </span>
            </Button>
          </DialogTrigger>
        </ConfigureCaptchaModal>
      )}
      {currentPath === "magic-url" && (
        <ConfigureMagicUrlModal>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="h-5 w-5" />
              <span className="sr-only sm:not-sr-only sm:ml-2.5 sm:text-sm sm:whitespace-nowrap">
                Add Configuration
              </span>
            </Button>
          </DialogTrigger>
        </ConfigureMagicUrlModal>
      )}
      {currentPath === "my-services" && (
        <>
          <Button variant="outline" size="sm" onClick={() => setIsManagedServicesGuideOpen(true)}>
            <Notebook className="aspect-square w-4" />
            <span className="sr-only sm:not-sr-only sm:ml-2 sm:text-sm sm:whitespace-nowrap">
              Setup Guide
            </span>
          </Button>
          <AddService />
        </>
      )}
      {currentPath === "email" && (
        <Button size="sm" onClick={() => setIsEmailConfigOpen(true)}>
          <Plus className="h-5 w-5" />
          <span className="sr-only sm:not-sr-only sm:ml-2.5 sm:text-sm sm:whitespace-nowrap">
            Add Configuration
          </span>
        </Button>
      )}
      {currentPath === "notification" && (
        <Button size="sm" onClick={() => setIsNotificationConfigOpen(true)}>
          <Plus className="h-5 w-5" />
          <span className="sr-only sm:not-sr-only sm:ml-2.5 sm:text-sm sm:whitespace-nowrap">
            Add Configuration
          </span>
        </Button>
      )}
      {currentPath === "secret" && <CreateSecretButton />}
      {currentPath === "external-idp" && (
        <>
          {externalIdpConfigured ? (
            <>
              <Button size="sm" variant="outline" onClick={() => setIsJwtClaimOpen(true)}>
                <Waypoints className="h-5 w-5" />
                <span className="sr-only sm:not-sr-only sm:ml-2.5 sm:text-sm sm:whitespace-nowrap">
                  Map JWT Claim
                </span>
              </Button>
              <PrimaryButton
                Icon={Pencil}
                label="Edit"
                size="sm"
                onClick={() => setIsEditExternalIdpOpen(true)}
              />
            </>
          ) : (
            <PrimaryButton
              Icon={Plus}
              label="Add"
              size="sm"
              onClick={() => setIsEditExternalIdpOpen(true)}
            />
          )}
        </>
      )}
    </>
  );
}

export default function SecretManagementLayout() {
  const { pathname } = useLocation();
  const scoped = useScopedPath();
  const currentPath = pathname.split("/").pop() ?? "secret";
  const oidcBrandingMatch = pathname.match(/\/oidc\/branding$/);
  const isOidcBranding = Boolean(oidcBrandingMatch);
  const secretManagementBase = scoped("secret-management");

  const tenantId = useProjectStore().selectedProject?.tenantId || "";
  // Each query drives header actions for its own page only, so gate it on the
  // active route to avoid fetching every page's data on every page.
  const { data: externalIdpData } = useGetSavedPublicCertificates(
    currentPath === "external-idp" ? tenantId : "",
  );
  const { data: clientsData } = useListAuthClientCredentials(
    { projectKey: tenantId },
    currentPath === "client-credentials",
  );

  // Shared via URL so child routes can read/close the same modal
  const [, setIsAddIdpOpen] = useQueryState("addIdp", parseAsBoolean.withDefault(false));
  const [, setIsEmailConfigOpen] = useQueryState("emailConfig", parseAsBoolean.withDefault(false));
  const [, setIsNotificationConfigOpen] = useQueryState(
    "notificationConfig",
    parseAsBoolean.withDefault(false),
  );
  const [, setIsManagedServicesGuideOpen] = useQueryState(
    "guideOpen",
    parseAsBoolean.withDefault(false),
  );
  const [, setIsJwtClaimOpen] = useQueryState("jwtClaim", parseAsBoolean.withDefault(false));
  const [, setIsEditExternalIdpOpen] = useQueryState(
    "editExternalIdp",
    parseAsBoolean.withDefault(false),
  );
  const [isClientCredentialOpen, setIsClientCredentialOpen] = useQueryState(
    "clientCredentialOpen",
    parseAsBoolean.withDefault(false),
  );
  const [clientCredentialItemId, setClientCredentialItemId] = useQueryState(
    "clientCredentialItemId",
    parseAsString.withDefault(""),
  );

  const breadcrumbTitles = isOidcBranding
    ? {
        [`${secretManagementBase}/oidc`]: "OIDC",
        [`${secretManagementBase}/oidc/branding`]: "Template",
      }
    : undefined;

  const currentItem = isOidcBranding
    ? null
    : SECRET_MANAGEMENT_NAV_GROUPS.flatMap((g) => g.items).find(
        (item) => item.value === currentPath,
      );

  const headerActions = (
    <SecretManagementHeaderActions
      isOidcBranding={isOidcBranding}
      currentPath={currentPath}
      setIsAddIdpOpen={setIsAddIdpOpen}
      setIsEmailConfigOpen={setIsEmailConfigOpen}
      setIsNotificationConfigOpen={setIsNotificationConfigOpen}
      setIsManagedServicesGuideOpen={setIsManagedServicesGuideOpen}
      setIsJwtClaimOpen={setIsJwtClaimOpen}
      setIsEditExternalIdpOpen={setIsEditExternalIdpOpen}
      setIsClientCredentialOpen={setIsClientCredentialOpen}
      externalIdpConfigured={!!externalIdpData?.isConfigured}
    />
  );

  return (
    <OidcBrandingHeaderProvider>
      <div className="flex h-full min-h-0 flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto px-6 pb-6 pt-4">
          {isOidcBranding ? (
            <header className="mb-4 flex items-center justify-between gap-4 sm:mb-6">
              <PageBreadcrumb
                breadcrumbIndex={3}
                className="flex"
                customTitles={breadcrumbTitles}
              />
              <div className="flex shrink-0 items-center gap-2">{headerActions}</div>
            </header>
          ) : currentItem ? (
            <PageHeader
              title={currentItem.label}
              description={currentItem.desc}
              actions={headerActions}
            />
          ) : null}
          <Outlet />
        </div>
      </div>
      {currentPath === "client-credentials" && (
        <CreateClientCredential
          editClient={
            clientCredentialItemId
              ? ((clientsData ?? []).find((c) => c.itemId === clientCredentialItemId) ?? null)
              : null
          }
          open={isClientCredentialOpen}
          onOpenChange={(open) => {
            setIsClientCredentialOpen(open);
            if (!open) setClientCredentialItemId("");
          }}
          hideTrigger
        />
      )}
    </OidcBrandingHeaderProvider>
  );
}
