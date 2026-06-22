import { Banner } from "@/components/ui-kits/banner/banner";
import { Button } from "@/components/ui-kits/button/button";
import { SECRET_MANAGEMENT_NAV_GROUPS } from "@/constants/secret-management-nav";
import { AddSecretModal } from "@/cross-modules/secrets/components/add-secret-modal/add-secret-modal";
import { toast } from "@/hooks/use-toast";
import { AddService } from "@blocks-identifier/components/add-service/add-service";
import { CreateClientCredential } from "@blocks-idp/authentication/components/create-client-credential";
import { CreateOIDC } from "@blocks-idp/authentication/components/create-oidc";
import { GRANT_TYPES } from "@blocks-idp/authentication/constants/authentication.constant";
import { useGetCaptchaConfigs } from "@blocks-idp/captcha/hooks/use-captcha-config";
import { ConfigureCaptchaModal } from "@blocks-idp/captcha/modals/configure-captcha-modal";
import {
  CAPTCHA_PROVIDERS,
  CAPTCHA_PROVIDERS_KEY,
} from "@blocks-idp/captcha/models/captcha";
import { ConfigureMagicUrlModal } from "@blocks-utilities/components/magic-url-config-dialog/configure-magic-url-modal";
import { DialogTrigger } from "@radix-ui/react-dialog";
import { useProjectStore } from "@seliseblocks/blocks-kit";
import { CirclePlus, Notebook } from "lucide-react";
import { parseAsBoolean, useQueryState } from "nuqs";
import { MouseEvent, useMemo } from "react";
import { Outlet, useLocation } from "react-router-dom";

const HIDDEN_BANNER_PATHS = [
  "my-secret",
  "managed-services",
  "ai-models",
  "magic-url",
];

export default function SecretManagementLayout() {
  const { pathname } = useLocation();
  const currentPath = pathname.split("/").pop() ?? "my-secret";

  const tenantId = useProjectStore().selectedProject?.tenantId || "";
  const { data: captchaData } = useGetCaptchaConfigs({ projectKey: tenantId });

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

  const currentItem = SECRET_MANAGEMENT_NAV_GROUPS.flatMap((g) => g.items).find(
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
    <>
      {currentPath === "oidc" && <CreateOIDC />}
      {currentPath === "client-credentials" && <CreateClientCredential />}
      {currentPath === "identity-providers" && (
        <Button size="sm" onClick={() => setIsAddIdpOpen(true)}>
          <CirclePlus className="h-5 w-5" />
          <span className="sr-only sm:not-sr-only sm:ml-2.5 sm:text-sm sm:whitespace-nowrap">
            Add Identity Provider
          </span>
        </Button>
      )}
      {currentPath === "captcha" && (
        <ConfigureCaptchaModal>
          <DialogTrigger asChild>
            <Button size="sm" onClick={handleAddCaptchaConfig}>
              <CirclePlus className="h-5 w-5" />
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
              <CirclePlus className="h-5 w-5" />
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
          <CirclePlus className="h-5 w-5" />
          <span className="sr-only sm:not-sr-only sm:ml-2.5 sm:text-sm sm:whitespace-nowrap">
            Add Configuration
          </span>
        </Button>
      )}
      {currentPath === "notification" && (
        <Button size="sm" onClick={() => setIsNotificationConfigOpen(true)}>
          <CirclePlus className="h-5 w-5" />
          <span className="sr-only sm:not-sr-only sm:ml-2.5 sm:text-sm sm:whitespace-nowrap">
            Add Configuration
          </span>
        </Button>
      )}
      {currentPath === "my-secret" && <AddSecretModal />}
    </>
  );

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <div className="flex shrink-0 items-center justify-between px-6 py-4">
        <div className="flex items-center gap-3">
          {currentItem && (
            <div>
              <h1 className="text-lg font-semibold text-[hsl(var(--high-emphasis))]">
                {currentItem.label}
              </h1>
              <p className="text-xs text-muted-foreground">
                {currentItem.desc}
              </p>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">{headerActions}</div>
      </div>
      <div className="flex-1 overflow-y-auto p-6">
        {!HIDDEN_BANNER_PATHS.includes(currentPath) && (
          <Banner variant="warning" title="Secret values are hidden.">
            Once entered, they can't be displayed again — you can only view and
            manage configurations.
          </Banner>
        )}
        <Outlet />
      </div>
    </div>
  );
}
