import { Button } from "@/components/ui-kits/button/button";
import { DialogTrigger } from "@/components/ui-kits/dialog/dialog";
import { SECRET_MANAGEMENT_NAV_GROUPS } from "@/constants/secret-management-nav";
import { AddSecretModal } from "@/cross-modules/secrets/components/add-secret-modal/add-secret-modal";
import { toast } from "@/hooks/use-toast";
import { AddService } from "@blocks-identifier/components/add-service/add-service";
import { CreateClientCredential } from "@blocks-idp/authentication/components/create-client-credential";
import { CreateOIDC } from "@blocks-idp/authentication/components/create-oidc";
import { useGetSavedPublicCertificates } from "@blocks-idp/authentication/hooks/use-identifier";
import { useGetCaptchaConfigs } from "@blocks-idp/captcha/hooks/use-captcha-config";
import { ConfigureCaptchaModal } from "@blocks-idp/captcha/modals/configure-captcha-modal";
import {
  CAPTCHA_PROVIDERS,
  CAPTCHA_PROVIDERS_KEY,
} from "@blocks-idp/captcha/models/captcha";
import { ConfigureMagicUrlModal } from "@blocks-utilities/components/magic-url-config-dialog/configure-magic-url-modal";
import {
  OidcBrandingHeaderProvider,
  useOidcBrandingHeaderOptional,
} from "@blocks-idp/authentication/contexts/oidc-branding-header-context";
import { PrimaryButton } from "@/components/action-buttons/primary-button";
import { useProjectStore } from "@seliseblocks/blocks-kit";
import { Pencil, Plus, ArrowLeft, Loader2, Notebook, Waypoints } from "lucide-react";
import { parseAsBoolean, useQueryState } from "nuqs";
import { MouseEvent, useMemo } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";

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
  externalIdpConfigured: boolean;
}) {
  const brandingHeader = useOidcBrandingHeaderOptional();

  if (isOidcBranding && brandingHeader?.actions) {
    const { onSave, onUndo, isBusy } = brandingHeader.actions;
    return (
      <>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onUndo}
          disabled={isBusy}
        >
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
      {currentPath === "client-credentials" && <CreateClientCredential />}
      {currentPath === "identity-providers" && (
        <Button size="sm" onClick={() => setIsAddIdpOpen(true)}>
          <Plus className="h-5 w-5" />
          <span className="sr-only sm:not-sr-only sm:ml-2.5 sm:text-sm sm:whitespace-nowrap">
            Add Identity Provider
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
      {currentPath === "managed-services" && (
        <>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsManagedServicesGuideOpen(true)}>
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
              <PrimaryButton Icon={Pencil} label="Edit" size="sm" onClick={() => setIsEditExternalIdpOpen(true)} />
            </>
          ) : (
            <PrimaryButton Icon={Plus} label="Add provider" size="sm" onClick={() => setIsEditExternalIdpOpen(true)} />
          )}
        </>
      )}
    </>
  );
}

export default function SecretManagementLayout() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const currentPath = pathname.split("/").pop() ?? "my-secret";
  const isOidcBranding = /\/oidc\/[^/]+\/branding$/.test(pathname);

  const tenantId = useProjectStore().selectedProject?.tenantId || "";
  const { data: captchaData } = useGetCaptchaConfigs({ projectKey: tenantId });
  const { data: externalIdpData } = useGetSavedPublicCertificates(tenantId);

  // Shared via URL so child routes can read/close the same modal
  const [, setIsAddIdpOpen] = useQueryState(
    "addIdp",
    parseAsBoolean.withDefault(false),
  );
  const [, setIsEmailConfigOpen] = useQueryState(
    "emailConfig",
    parseAsBoolean.withDefault(false),
  );
  const [, setIsNotificationConfigOpen] = useQueryState(
    "notificationConfig",
    parseAsBoolean.withDefault(false),
  );
  const [, setIsManagedServicesGuideOpen] = useQueryState(
    "guideOpen",
    parseAsBoolean.withDefault(false),
  );
  const [, setIsJwtClaimOpen] = useQueryState(
    "jwtClaim",
    parseAsBoolean.withDefault(false),
  );
  const [, setIsEditExternalIdpOpen] = useQueryState(
    "editExternalIdp",
    parseAsBoolean.withDefault(false),
  );

  const currentItem = isOidcBranding
    ? {
        label: "Template",
        desc: "Customize the template appearance",
      }
    : SECRET_MANAGEMENT_NAV_GROUPS.flatMap((g) => g.items).find(
        (item) => item.value === currentPath,
      );

  const areAllProvidersConfigured = useMemo(() => {
    if (!captchaData?.configurations) return false;
    const allProviderKeys = Object.keys(
      CAPTCHA_PROVIDERS,
    ) as CAPTCHA_PROVIDERS_KEY[];
    const configuredProviders = new Set(
      captchaData.configurations.map(
        (config: { provider: string }) => config.provider,
      ),
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
      externalIdpConfigured={!!externalIdpData?.isConfigured}
    />
  );

  return (
    <OidcBrandingHeaderProvider>
      <div className="flex h-full min-h-0 flex-col overflow-hidden">
        <div className="flex shrink-0 flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="flex min-w-0 items-center gap-2">
            {isOidcBranding && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0"
                aria-label="Back to OIDC"
                onClick={() => navigate("/app/secret-management/oidc")}
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
            )}
            {currentItem && (
              <div className="space-y-1">
                <h1 className="text-xl font-semibold tracking-tight text-[hsl(var(--high-emphasis))] sm:text-2xl">
                  {currentItem.label}
                </h1>
                <p className="text-sm text-muted-foreground">
                  {currentItem.desc}
                </p>
              </div>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-2 self-end sm:self-auto">{headerActions}</div>
        </div>
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          <Outlet />
        </div>
      </div>
    </OidcBrandingHeaderProvider>
  );
}
