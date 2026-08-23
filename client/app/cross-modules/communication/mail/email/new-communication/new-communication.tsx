import PageBreadcrumb from "@/components/breadcrumb/breadcrumb";
import { Badge } from "@/components/ui-kits/badge/badge";
import { Button } from "@/components/ui-kits/button/button";
import { Step, Stepper, useStepper, type StepItem } from "@/components/ui-kits/stepper";
import { toast } from "@/hooks/use-toast";
import BasicInformation from "@blocks-communication/mail/components/email-service/basic-information/basic-information";
import BeePluginStarter from "@blocks-communication/mail/components/bee-plugin-starter/bee-plugin-starter";
import { blankTemplate } from "@blocks-communication/mail/constants/email-template";
import { useSaveMailTemplate } from "@blocks-communication/mail/hooks/use-email-template";
import { IEmailTemplate } from "@blocks-communication/mail/models/email";
import { useProjectStore } from "@seliseblocks/genesis-os";
import { useScopedPath } from "@seliseblocks/genesis-os/hooks";
import { FileText, LayoutTemplate } from "lucide-react";
import { useRef, useState } from "react";
import { useNavigate } from "react-router";

const EMAIL_TEMPLATE_STEPS: StepItem[] = [{ id: "basic-information" }, { id: "template" }];

const basicInformationLabel = (
  <span className="flex flex-wrap items-center gap-2">
    Basic information
    <Badge
      variant="secondary"
      className="px-1.5 py-0 text-[10px] font-medium uppercase tracking-wide"
    >
      Required
    </Badge>
  </span>
);

const templateLabel = (
  <span className="flex flex-wrap items-center gap-2">
    Template
    <Badge
      variant="outline"
      className="px-1.5 py-0 text-[10px] font-medium uppercase tracking-wide"
    >
      Design
    </Badge>
  </span>
);

type BasicInformationStepProps = {
  templateData: IEmailTemplate;
  setTemplateData: (data: IEmailTemplate) => void;
  onStepComplete: () => void;
};

const BasicInformationStep = ({
  templateData,
  setTemplateData,
  onStepComplete,
}: BasicInformationStepProps) => {
  const { nextStep } = useStepper();
  const ref = useRef<{ submit: () => void; isValid: boolean } | undefined>(undefined);
  const [isFormValid, setIsFormValid] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const handleSaveSuccess = (data: IEmailTemplate) => {
    setTemplateData(data);
    onStepComplete();
    nextStep();
  };

  return (
    <div className="mt-6 w-full">
      <BasicInformation
        onSaveSuccess={handleSaveSuccess}
        templateData={templateData}
        onValidityChange={setIsFormValid}
        onPendingChange={setIsSaving}
        ref={ref}
        actions={
          <Button
            type="button"
            size="default"
            className="w-full sm:w-auto"
            onClick={() => ref?.current?.submit()}
            disabled={isSaving || !isFormValid}
          >
            Save &amp; continue
          </Button>
        }
      />
    </div>
  );
};

type TemplateDesignStepProps = {
  templateData: IEmailTemplate;
  setTemplateData: (data: IEmailTemplate) => void;
};

const TemplateDesignStep = ({ templateData, setTemplateData }: TemplateDesignStepProps) => {
  const { isPending, mutateAsync: saveTemplate } = useSaveMailTemplate();
  const beeRef = useRef<{ submit: () => void; preview: () => void } | undefined>(undefined);
  const navigate = useNavigate();
  const scoped = useScopedPath();
  const tenantId = useProjectStore()?.selectedProject?.tenantId || "";
  const emailBasePath = scoped("email-management");

  const handleBeePluginData = async (data: { htmlFile: string; jsonFile: string }) => {
    const currentData: IEmailTemplate = {
      itemId: templateData?.itemId || "",
      templateBody: data.htmlFile,
      jsonContent: data.jsonFile,
    };

    try {
      const payload = {
        ...currentData,
        projectKey: tenantId,
      };
      const res = await saveTemplate(payload);
      setTemplateData(currentData);
      if (res.isSuccess) {
        navigate(`${emailBasePath}/communications/${res.itemId}`);
        return;
      }

      toast({
        variant: "destructive",
        title: "Error",
        description: JSON.stringify(res.errors),
      });
      navigate(emailBasePath);
    } catch {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Something went wrong",
      });
      navigate(emailBasePath);
    }
  };

  return (
    <div className="mt-6 flex w-full flex-col gap-4">
      <div className="flex flex-col gap-3 rounded-sm border border-border bg-card px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold text-high-emphasis">Template design</h2>
          <p className="text-sm text-low-emphasis">
            Build and preview the email body for this template.
          </p>
        </div>
        <div className="flex shrink-0 flex-col-reverse gap-2 sm:flex-row sm:items-center">
          <Button
            type="button"
            variant="outline"
            size="default"
            className="w-full shadow-none sm:w-auto"
            onClick={() => beeRef?.current?.preview()}
          >
            Preview
          </Button>
          <Button
            type="button"
            size="default"
            className="w-full sm:w-auto"
            disabled={isPending}
            onClick={() => beeRef?.current?.submit()}
          >
            Save template
          </Button>
        </div>
      </div>
      <div className="flex min-h-[calc(100vh-22rem)] w-full flex-1 flex-col overflow-hidden rounded-sm border border-border bg-card shadow-none">
        <BeePluginStarter onBeeSave={handleBeePluginData} ref={beeRef} jsonFile={blankTemplate} />
      </div>
    </div>
  );
};

function EmailTemplateStepper() {
  const completedStepRef = useRef(0);
  const [templateData, setTemplateData] = useState<IEmailTemplate>({
    itemId: "",
  });
  const { isPending } = useSaveMailTemplate();

  const handleClickStep = (step: number, setStep: (step: number) => void) => {
    if (step <= completedStepRef.current) {
      setStep(step);
    }
  };

  const handleStepComplete = () => {
    completedStepRef.current = 1;
  };

  return (
    <Stepper
      initialStep={0}
      steps={EMAIL_TEMPLATE_STEPS}
      responsive
      state={isPending ? "loading" : undefined}
      onClickStep={handleClickStep}
      styles={{
        "main-container":
          "w-full justify-start gap-y-4 rounded-sm border border-border bg-card px-4 py-4 sm:px-6 sm:py-5 md:gap-y-0",
        "horizontal-step":
          "flex-1 [&:not(:last-child)]:after:w-full sm:[&:not(:last-child)]:after:w-full lg:[&:not(:last-child)]:after:w-full",
        "horizontal-step-container": "min-w-0",
        "step-label-container": "min-w-0",
        "step-label": "font-medium",
        "step-description": "max-w-none",
      }}
    >
      <Step
        icon={FileText}
        label={basicInformationLabel}
        description="Name, mail configuration, and subject line"
      >
        <BasicInformationStep
          templateData={templateData}
          setTemplateData={setTemplateData}
          onStepComplete={handleStepComplete}
        />
      </Step>

      <Step
        icon={LayoutTemplate}
        label={templateLabel}
        description="Build and preview your email body"
      >
        <TemplateDesignStep templateData={templateData} setTemplateData={setTemplateData} />
      </Step>
    </Stepper>
  );
}

export default function NewCommunication() {
  const scoped = useScopedPath();
  const emailBasePath = scoped("email-management");
  const breadcrumbTitles = {
    [emailBasePath]: "Email Management",
    [`${emailBasePath}/new-communication`]: "New Template",
  };

  return (
    <main className="flex min-h-0 w-full flex-1 flex-col gap-4 p-4 sm:gap-6 sm:p-6">
      <header className="w-full space-y-4">
        <PageBreadcrumb
          breadcrumbIndex={3}
          className="flex"
          customTitles={breadcrumbTitles}
        />
      </header>

      <div className="w-full flex-1">
        <EmailTemplateStepper />
      </div>
    </main>
  );
}
