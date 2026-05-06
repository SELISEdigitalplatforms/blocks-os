
import { LogMenu } from "@blocks-lmt/components";
import { useQueryState } from "nuqs";
import { GrantTypes } from "./general/grant-types";
// import { SelfSignup } from "./general/self-signup";
import { GeneralSettings } from "./general/settings";
import { Button } from "@/components/ui-kits/button/button";
// import { ClientCredentials } from "@blocks-idp/authentication/components/client-credentials";
// import { CreateClientCredential } from "@blocks-idp/authentication/components/create-client-credential";
import { Permissions } from "@blocks-idp/iam/modules/permission-management";
import { AddRole, Roles } from "@blocks-idp/iam/modules/role-management";
import { PrimaryButton } from "@/components/action-buttons/primary-button";
import { Link } from "react-router-dom";
import { CirclePlus, Settings, X, ChevronsLeft, Menu } from "lucide-react";
import { EmailServiceTable, EmailConfiguration, EmailCommunicationDetails } from "@blocks-communication/mail";
import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui-kits/dialog/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetClose } from "@/components/ui-kits/sheet/sheet";
import { cn } from "@/lib/utils";
import StepperProvider, { useStepper } from "@/components/stepper/stepper-provider";
import StepVerticalTrackBar from "@/components/stepper/vertical-track-bar";
import StepHorizontalTrackBar from "@/components/stepper/horizontal-track-bar";
import BasicInformation from "@blocks-communication/mail/components/email-service/basic-information/basic-information";
import BeePluginStarter from "@blocks-communication/mail/components/bee-plugin-starter/bee-plugin-starter";
import { useSaveMailTemplate } from "@blocks-communication/mail/hooks/use-email-template";
import { useProjectStore } from "@/store/useProjectStore";
import { IEmailTemplate } from "@blocks-communication/mail/models/email";
import { blankTemplate } from "@blocks-communication/mail/constants/email-template";
import { AUTHENTICATION_NAV_GROUPS } from "@/constants/authentication-nav";

const NEW_COMMUNICATION_STEPS = [
  { id: 1, title: "Basic Information" },
  { id: 2, title: "Template" },
];

interface NewCommunicationContentProps {
  onClose: () => void;
  onCreated: (id: string) => void;
}

function NewCommunicationContent({ onClose, onCreated }: NewCommunicationContentProps) {
  const { currentStep, nextStep } = useStepper();
  const [templateData, setTemplateData] = useState<IEmailTemplate>({ itemId: "" });
  const [isFormValid, setIsFormValid] = useState(false);
  const { isPending, mutateAsync: saveTemplate } = useSaveMailTemplate();
  const ref = useRef<{ submit: () => void; isValid: boolean }>(null);
  const beeRef = useRef<{ submit: () => void; preview: () => void }>(null);
  const tenantId = useProjectStore()?.selectedProject?.tenantId || "";

  const formSubmitHandler = async (data: IEmailTemplate) => {
    try {
      data.itemId = templateData?.itemId || "";
      const response = await saveTemplate({ ...data, projectKey: tenantId });
      data.itemId = response.itemId;
      setTemplateData(data);
      nextStep();
    } catch (error) {
      console.log(error);
    }
  };

  const handleBeePluginData = async (data: { htmlFile: string; jsonFile: string }) => {
    try {
      const res = await saveTemplate({
        itemId: templateData?.itemId || "",
        templateBody: data.htmlFile,
        jsonContent: data.jsonFile,
        projectKey: tenantId,
      });
      if (res.isSuccess) {
        onCreated(res.itemId);
      }
    } catch (error) {
      console.log(error);
    }
  };

  return (
    <div className="flex h-full">
      {/* Sidebar (desktop) */}
      <div className="hidden min-h-full w-64 flex-shrink-0 flex-col gap-5 border-r bg-background p-5 pt-10 md:flex">
        <div className="mx-2 my-3">
          <div className="flex items-center gap-2">
            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={onClose}>
              <X className="h-6 w-6" />
            </Button>
            <p className="text-lg font-semibold">New Template</p>
          </div>
          <p className="mb-7 mt-2 text-sm font-normal text-medium-emphasis">Create a new template</p>
        </div>
        <StepVerticalTrackBar />
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-auto p-6">
        {/* Mobile header */}
        <div className="mb-4 flex flex-col items-center justify-center md:hidden">
          <div className="flex items-center gap-2">
            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={onClose}>
              <X className="h-6 w-6" />
            </Button>
            <p className="text-lg font-semibold">New Template</p>
          </div>
          <p className="mt-2 text-sm text-medium-emphasis">Create a new template</p>
          <div className="mt-4 w-full">
            <StepHorizontalTrackBar />
          </div>
        </div>

        {currentStep === 1 ? (
          <div className="[&>main]:mt-0 [&>main]:sm:mt-0">
            <BasicInformation
              ref={ref}
              onSubmit={formSubmitHandler}
              templateData={templateData}
              onValidityChange={setIsFormValid}
            />
          </div>
        ) : (
          <div>
            <div className="mb-5 flex items-center justify-between">
              <h3 className="text-2xl font-semibold">Template</h3>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => beeRef?.current?.preview()}>
                  Preview
                </Button>
                <Button disabled={isPending} onClick={() => beeRef?.current?.submit()}>
                  Save
                </Button>
              </div>
            </div>
            <BeePluginStarter ref={beeRef} onBeeSave={handleBeePluginData} jsonFile={blankTemplate} />
          </div>
        )}

        {currentStep === 1 && (
          <div className="mt-10">
            <Button
              size="lg"
              onClick={() => ref?.current?.submit()}
              disabled={isPending || !isFormValid}
            >
              Save & Continue
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

export const AuthenticationConfig = () => {
  const [selectedTab, setSelectedTab] = useQueryState("tab", { defaultValue: "general" });
  const [configureOpen, setConfigureOpen] = useState(false);
  const [addTemplateOpen, setAddTemplateOpen] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const tenantId = useProjectStore().selectedProject?.tenantId || "";

  const currentItem = AUTHENTICATION_NAV_GROUPS
    .flatMap((g) => g.items)
    .find((item) => item.value === (selectedTab ?? "general"));

  const handleTemplateCreated = (id: string) => {
    setAddTemplateOpen(false);
    setSelectedTemplateId(id);
  };

  const headerActions = (
    <>
      {selectedTab === "roles" && <AddRole />}
      {selectedTab === "permissions" && (
        <Link to="/services/iam/permission-detail/new">
          <PrimaryButton label="Add Permission" />
        </Link>
      )}
      {selectedTab === "email-template" && (
        <div className="flex shrink-0 items-center gap-2">
          <Button
            variant="outline"
            size="default"
            className="gap-1 text-sm font-medium"
            onClick={() => setConfigureOpen(true)}
          >
            <Settings className="h-5 w-5" />
            <span className="sr-only sm:not-sr-only">Configure</span>
          </Button>
          <Button
            size="default"
            variant="default"
            className="bg-primary text-primary-foreground shadow-none"
            onClick={() => setAddTemplateOpen(true)}
          >
            <CirclePlus className="h-5 w-5 lg:mr-2" />
            <span className="sr-only lg:not-sr-only">Add Template</span>
          </Button>
        </div>
      )}
    </>
  );

  return (
    <>
      <div className="flex h-full min-h-0 flex-col overflow-hidden">
        {/* Page header */}
        <div className="flex shrink-0 items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            {/* Mobile sidebar trigger */}
            <Sheet open={isMobileSidebarOpen} onOpenChange={setIsMobileSidebarOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 md:hidden">
                  <Menu className="h-4 w-4" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-52 p-0" hideClose>
              <div className="flex h-full flex-col">
                <SheetHeader className="flex-row items-center justify-between border-b border-border px-4 py-3">
                  <SheetTitle className="text-sm font-semibold">IDP</SheetTitle>
                  <SheetClose asChild>
                    <Button variant="ghost" size="icon" className="!mt-0 h-7 w-7 shrink-0">
                      <ChevronsLeft className="h-4 w-4" />
                    </Button>
                  </SheetClose>
                </SheetHeader>
                <nav className="flex-1 overflow-y-auto py-1">
                  {AUTHENTICATION_NAV_GROUPS.map((group) => (
                    <div key={group.label}>
                      <p className="px-4 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                        {group.label}
                      </p>
                      {group.items.map((item) => {
                        const Icon = item.icon;
                        const isActive = (selectedTab ?? "general") === item.value;
                        return (
                          <button
                            key={item.id}
                            onClick={() => { setSelectedTab(item.value); setIsMobileSidebarOpen(false); }}
                            className={cn(
                              "relative flex h-10 w-full items-center gap-3 px-4 py-1.5 text-sm transition-colors",
                              isActive
                                ? "text-primary"
                                : "text-[hsl(var(--low-emphasis))] hover:text-[hsl(var(--high-emphasis))]",
                            )}
                          >
                            <Icon className="h-5 w-5 shrink-0" />
                            <span>{item.label}</span>
                            {isActive && (
                              <div className="absolute right-0 top-2.5 h-5 w-1 rounded-l-lg bg-primary" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  ))}
                </nav>
              </div>
            </SheetContent>
            </Sheet>

            {/* Page title */}
            {currentItem && (
              <div>
                <h1 className="text-lg font-semibold text-[hsl(var(--high-emphasis))]">
                  {currentItem.label}
                </h1>
                <p className="text-xs text-muted-foreground">{currentItem.desc}</p>
              </div>
            )}
          </div>

          {/* Header actions */}
          <div className="flex items-center gap-2">{headerActions}</div>
        </div>

        {/* Content body */}
        <div className="flex-1 overflow-y-auto p-6">
        {selectedTab === "general" && (
          <div className="grid grid-cols-1 gap-6">
            <GeneralSettings />
            <GrantTypes />
          </div>
        )}
        {selectedTab === "signin-flow" && (
          <div className="rounded-lg border border-border bg-card p-6">
            <h3 className="text-lg font-semibold">Signin flow</h3>
            <p className="mt-2 text-muted-foreground">Configure your signin flow settings</p>
          </div>
        )}
        {selectedTab === "signup-flow" && (
          <div className="rounded-lg border border-border bg-card p-6">
            <h3 className="text-lg font-semibold">Signup flow</h3>
            <p className="mt-2 text-muted-foreground">Configure your signup flow settings</p>
          </div>
        )}
        {selectedTab === "email-template" && (
          selectedTemplateId ? (
            <EmailCommunicationDetails
              params={{ id: selectedTemplateId }}
              onBack={() => setSelectedTemplateId(null)}
            />
          ) : (
            <EmailServiceTable onRowClick={(id) => setSelectedTemplateId(String(id))} />
          )
        )}
        {selectedTab === "oidc-template" && (
          <div className="rounded-lg border border-border bg-card p-6">
            <h3 className="text-lg font-semibold">OIDC template</h3>
            <p className="mt-2 text-muted-foreground">Configure your OIDC template settings</p>
          </div>
        )}
        {selectedTab === "roles" && <Roles />}
        {selectedTab === "permissions" && <Permissions />}
      </div>
    </div>

    <Dialog open={configureOpen} onOpenChange={setConfigureOpen}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Email Configuration</DialogTitle>
        </DialogHeader>
        <EmailConfiguration />
      </DialogContent>
    </Dialog>

    <Sheet open={addTemplateOpen} onOpenChange={setAddTemplateOpen}>
      <SheetContent side="right" className="flex h-full w-full max-w-full flex-col overflow-hidden p-0 sm:max-w-full" hideClose>
        <StepperProvider steps={NEW_COMMUNICATION_STEPS}>
          <NewCommunicationContent
            onClose={() => setAddTemplateOpen(false)}
            onCreated={handleTemplateCreated}
          />
        </StepperProvider>
      </SheetContent>
    </Sheet>
    </>
  );
};
