import { PageHeader } from "@/components/page-header/page-header";
import PageBreadcrumb from "@/components/breadcrumb/breadcrumb";
import { BREADCRUMB_CUSTOM_TITLES } from "@/constants/breadcrumb-custom-title";
import { Button } from "@/components/ui-kits/button/button";
import { DialogTrigger } from "@/components/ui-kits/dialog/dialog";
import { SECRET_MANAGEMENT_NAV_GROUPS } from "@/constants/secret-management-nav";
import { AddSecretModal } from "@/cross-modules/secrets/components/add-secret-modal/add-secret-modal";
import { CreateClientCredential } from "@blocks-idp/authentication/components/create-client-credential/create-client-credential";
import { useListAuthClientCredentials } from "@blocks-idp/authentication/hooks/use-auth-clients";
import { toast } from "@/hooks/use-toast";
import { AddService } from "@blocks-identifier/components/add-service/add-service";
import { CreateOIDC } from "@blocks-idp/authentication/components/create-oidc";
import { useGetSavedPublicCertificates } from "@blocks-idp/authentication/hooks/use-identifier";
import { useGetCaptchaConfigs } from "@blocks-idp/captcha/hooks/use-captcha-config";
import { ConfigureCaptchaModal } from "@blocks-idp/captcha/modals/configure-captcha-modal";
import { CAPTCHA_PROVIDERS, CAPTCHA_PROVIDERS_KEY } from "@blocks-idp/captcha/models/captcha";
import { ConfigureMagicUrlModal } from "@blocks-utilities/components/magic-url-config-dialog/configure-magic-url-modal";
import {
  OidcBrandingHeaderProvider,
  useOidcBrandingHeaderOptional,
} from "@blocks-idp/authentication/contexts/oidc-branding-header-context";
import { PrimaryButton } from "@/components/action-buttons/primary-button";
import { useProjectStore } from "@seliseblocks/genesis-os";
import { Pencil, Plus, Loader2, Notebook, Waypoints } from "lucide-react";
import { parseAsBoolean, parseAsString, useQueryState } from "nuqs";
import { MouseEvent, useMemo } from "react";
import { Outlet, useLocation } from "react-router";
import { useScopedPath } from "@seliseblocks/genesis-os/hooks";

function SecretManagementHeaderActions({
  isOidcBranding,
  currentPath,
  handleAddCaptchaConfig,
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
  handleAddCaptchaConfig: (e: MouseEvent) => void;
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

  if (isOidcBranding && brandingHeader?.actions) {
    const { onSave, onUndo, isBusy } = brandingHeader.actions;
    return (
      <>
        <Button type="button" variant="outline" size="sm" onClick={onUndo} disabled={isBusy}>
          Undo
        </Button>
        <Button type="button" size="sm" onClick={onSave} disabled={isBusy}>
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
      {!isOidcBranding && currentPath === "oidc" && <CreateOIDC />}
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
            <Button size="sm" onClick={handleAddCaptchaConfig}>
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
      {currentPath === "my-secret" && <AddSecretModal />}
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
  const currentPath = pathname.split("/").pop() ?? "my-secret";
  const oidcBrandingMatch = pathname.match(/\/oidc\/([^/]+)\/branding$/);
  const isOidcBranding = Boolean(oidcBrandingMatch);
  const oidcClientId = oidcBrandingMatch?.[1];
  const secretManagementBase = scoped("secret-management");

  const tenantId = useProjectStore().selectedProject?.tenantId || "";
  // Each query drives header actions for its own page only, so gate it on the
  // active route to avoid fetching every page's data on every page.
  const { data: captchaData } = useGetCaptchaConfigs(
    { projectKey: tenantId },
    currentPath === "captcha",
  );
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

  if (isOidcBranding && oidcClientId) {
    BREADCRUMB_CUSTOM_TITLES[`${secretManagementBase}/oidc`] = "OIDC";
    BREADCRUMB_CUSTOM_TITLES[`${secretManagementBase}/oidc/${oidcClientId}`] = null;
    BREADCRUMB_CUSTOM_TITLES[`${secretManagementBase}/oidc/${oidcClientId}/branding`] = "Template";
  }

  const currentItem = isOidcBranding
    ? null
    : SECRET_MANAGEMENT_NAV_GROUPS.flatMap((g) => g.items).find(
        (item) => item.value === currentPath,
      );

  const areAllProvidersConfigured = useMemo(() => {
    if (!captchaData?.configurations) return false;
    const allProviderKeys = Object.keys(CAPTCHA_PROVIDERS) as CAPTCHA_PROVIDERS_KEY[];
    const configuredProviders = new Set(
      captchaData.configurations.map((config: { provider: string }) => config.provider),
    );
    return allProviderKeys.every((key) => configuredProviders.has(key));
  }, [captchaData]);

  const handleAddCaptchaConfig = (e: MouseEvent) => {
    if (areAllProvidersConfigured) {
      toast({
        variant: "info",
        title: "Info",
        description: "No additional captcha configurations can be added.",
      });
      e.preventDefault();
    }
  };

  const headerActions = (
    <SecretManagementHeaderActions
      isOidcBranding={isOidcBranding}
      currentPath={currentPath}
      handleAddCaptchaConfig={handleAddCaptchaConfig}
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
                breadcrumbIndex={4}
                listClassName="text-base sm:text-lg"
                className="flex"
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
