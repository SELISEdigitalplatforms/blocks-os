import { useQueryState } from "nuqs";
import { SSO } from "@blocks-idp/authentication/pages/authentication-config/sso";
import { GRANT_TYPES } from "@blocks-idp/authentication/constants/authentication.constant";
import { AIModels } from "@blocks-ai/pages/aimodels";
import { OIDC } from "@blocks-idp/authentication/components/oidc";
import { IdentityProviders } from "@blocks-idp/authentication/components/identity-provider";
import { ClientCredentials } from "@blocks-idp/authentication/components/client-credentials";
import { CreateClientCredential } from "@blocks-idp/authentication/components/create-client-credential";
import { Certificates } from "@blocks-idp/authentication/pages/authentication-config/general/certificates/certificates";
import { CreateOIDC } from "@blocks-idp/authentication/components/create-oidc";
import { ConfigureCaptcha } from "@blocks-idp/captcha/pages/configure-captcha";
import { ConfigureCaptchaModal } from "@blocks-idp/captcha/modals/configure-captcha-modal";
import { ConfigureMFA } from "@blocks-idp/mfa/pages/configure-mfa/configure-mfa";
import { ConfigureMagicUrlModal } from "@blocks-utilities/components/magic-url-config-dialog/configure-magic-url-modal";
import { MagicUrls } from "@blocks-utilities/pages/magic-urls/magic-urls";
import { StorageContents } from "@blocks-storage/pages/storage/storage-contents";
import { ManagedServices } from "@blocks-identifier/pages/services/managed-services";
import { AddService } from "@blocks-identifier/components/add-service/add-service";
import { EmailConfiguration } from "@blocks-communication/mail/email/email-configure/email-configure";
import NotificationConfigurationList from "@blocks-communication/notification/components/notification-configuration-list";
import { Button } from "@/components/ui-kits/button/button";
import { CirclePlus, ChevronsLeft, Menu, Notebook } from "lucide-react";
import { MouseEvent, useMemo, useState } from "react";
import { CAPTCHA_PROVIDERS, CAPTCHA_PROVIDERS_KEY } from "@blocks-idp/captcha/models/captcha";
import { useGetCaptchaConfigs } from "@blocks-idp/captcha/hooks/use-captcha-config";
import { useProjectStore } from "@/store/useProjectStore";
import { DialogTrigger } from "@radix-ui/react-dialog";
import { toast } from "@/hooks/use-toast";
import { Sheet, SheetClose, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui-kits/sheet/sheet";
import { SECRET_MANAGEMENT_NAV_GROUPS } from "@/constants/secret-management-nav";
import { cn } from "@/lib/utils";
import { AddSecretModal } from "@/cross-modules/secrets/components/add-secret-modal/add-secret-modal";
import { SecretsList } from "@/cross-modules/secrets/components/secrets-list/secrets-list";
import { Banner } from "@/components/ui-kits/banner/banner";
import { SecretType } from "@/cross-modules/secrets/constants/secret-key.enum";

const HIDDEN_BANNER_TABS = ["my-secret", "managed-services", "ai-models", "magic-url"];
export default function SecretManagementPage() {
  const [selectedTab, setSelectedTab] = useQueryState("tab", { defaultValue: "my-secret" });
  const [secretType, setSecretType] = useQueryState("secretType", {
    defaultValue: SecretType.OIDC,
    parse: (v) => (Object.values(SecretType).includes(v as SecretType) ? (v as SecretType) : SecretType.OIDC),
  });
  const tenantId = useProjectStore().selectedProject?.tenantId || "";
  const { data: captchaData } = useGetCaptchaConfigs({ projectKey: tenantId });
  const [isManagedServicesGuideOpen, setIsManagedServicesGuideOpen] = useState(false);
  const [isEmailConfigOpen, setIsEmailConfigOpen] = useState(false);
  const [isNotificationConfigOpen, setIsNotificationConfigOpen] = useState(false);
  const [isAddIdpOpen, setIsAddIdpOpen] = useState(false);
  const currentItem = SECRET_MANAGEMENT_NAV_GROUPS
    .flatMap((g) => g.items)
    .find((item) => item.value === (selectedTab ?? "my-secret"));
  const areAllProvidersConfigured = useMemo(() => {
    if (!captchaData?.configurations) return false;
    const allProviderKeys = Object.keys(CAPTCHA_PROVIDERS) as CAPTCHA_PROVIDERS_KEY[];
    const configuredProviders = new Set(
      captchaData.configurations.map((config: { provider: string }) => config.provider),
    );
    return allProviderKeys.every((key) => configuredProviders.has(key));
  }, [captchaData]);
  const addConfigurationHandler = (e: MouseEvent) => {
    if (areAllProvidersConfigured) {
      toast({
        variant: "info",
        title: "Info",
        description: "No additional captcha configurations can be added.",
      });
      return e.preventDefault();
    }
  };
  const headerActions = (
    <>
      {selectedTab === GRANT_TYPES.authorizationCode && <CreateOIDC />}
      {selectedTab === "client-credentials" && <CreateClientCredential />}
      {selectedTab === "identity-providers" && (
        <Button size="sm" onClick={() => setIsAddIdpOpen(true)}>
          <CirclePlus className="h-5 w-5" />
          <span className="sr-only sm:not-sr-only sm:ml-2.5 sm:text-sm sm:whitespace-nowrap">
            Add Identity Provider
          </span>
        </Button>
      )}
      {selectedTab === "captcha" && (
        <ConfigureCaptchaModal>
          <DialogTrigger asChild>
            <Button size="sm" onClick={addConfigurationHandler}>
              <CirclePlus className="h-5 w-5" />
              <span className="sr-only sm:not-sr-only sm:ml-2.5 sm:text-sm sm:whitespace-nowrap">
                Add Configuration
              </span>
            </Button>
          </DialogTrigger>
        </ConfigureCaptchaModal>
      )}
      {selectedTab === "magic-url" && (
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
      {selectedTab === "managed-services" && (
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
      {selectedTab === "email" && (
        <Button size="sm" onClick={() => setIsEmailConfigOpen(true)}>
          <CirclePlus className="h-5 w-5" />
          <span className="sr-only sm:not-sr-only sm:ml-2.5 sm:text-sm sm:whitespace-nowrap">
            Add Configuration
          </span>
        </Button>
      )}
      {selectedTab === "notification" && (
        <Button size="sm" onClick={() => setIsNotificationConfigOpen(true)}>
          <CirclePlus className="h-5 w-5" />
          <span className="sr-only sm:not-sr-only sm:ml-2.5 sm:text-sm sm:whitespace-nowrap">
            Add Configuration
          </span>
        </Button>
      )}
      {selectedTab === "my-secret" && (
        <AddSecretModal />
      )}
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
              <p className="text-xs text-muted-foreground">{currentItem.desc}</p>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">{headerActions}</div>
      </div>
      <div className="flex-1 overflow-y-auto p-6">
        {!HIDDEN_BANNER_TABS.includes(selectedTab ?? "") && (
          <Banner
            variant="warning"
            title="Secret values are hidden."
          >
            Once entered, they can't be displayed again — you can only view and manage configurations.
          </Banner>
        )}
        {selectedTab === GRANT_TYPES.authorizationCode && <OIDC />}
        {selectedTab === "identity-providers" && (
          <IdentityProviders addOpen={isAddIdpOpen} onAddOpenChange={setIsAddIdpOpen} />
        )}
        {selectedTab === "client-credentials" && <ClientCredentials />}
        {selectedTab === "managed-services" && (
          <ManagedServices
            guideOpen={isManagedServicesGuideOpen}
            onGuideOpenChange={setIsManagedServicesGuideOpen}
          />
        )}
        {selectedTab === "my-secret" && <SecretsList />}
        {selectedTab === GRANT_TYPES.social && <SSO />}
        {selectedTab === "external-idp" && <Certificates />}
        {selectedTab === "captcha" && <ConfigureCaptcha />}
        {selectedTab === "mfa" && <ConfigureMFA />}
        {selectedTab === "magic-url" && <MagicUrls />}
        {selectedTab === "storage" && <StorageContents />}
        {selectedTab === "email" && (
          <EmailConfiguration
            addConfigOpen={isEmailConfigOpen}
            onAddConfigOpenChange={setIsEmailConfigOpen}
          />
        )}
        {selectedTab === "notification" && (
          <NotificationConfigurationList
            addConfigOpen={isNotificationConfigOpen}
            onAddConfigOpenChange={setIsNotificationConfigOpen}
          />
        )}
        {selectedTab === "ai-models" && <AIModels />}
      </div>
    </div>
  );
}
