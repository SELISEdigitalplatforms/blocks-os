import PageBreadcrumb from "@/components/breadcrumb/breadcrumb";
import { BREADCRUMB_CUSTOM_TITLES } from "@/constants/breadcrumb-custom-title";
import { Badge } from "@/components/ui-kits/badge/badge";
import { Button } from "@/components/ui-kits/button/button";
import { Step, Stepper, useStepper, type StepItem } from "@/components/ui-kits/stepper";
import { toast } from "@/hooks/use-toast";
import BasicInformation from "@blocks-communication/mail/components/email-service/basic-information/basic-information";
import BeePluginStarter from "@blocks-communication/mail/components/bee-plugin-starter/bee-plugin-starter";
import { blankTemplate } from "@blocks-communication/mail/constants/email-template";
import { useSaveMailTemplate } from "@blocks-communication/mail/hooks/use-email-template";
import { IEmailTemplate } from "@blocks-communication/mail/models/email";
import { useProjectStore } from "@seliseblocks/blocks-kit";
import { useScopedPath } from "@seliseblocks/blocks-kit/hooks";
import { FileText, LayoutTemplate } from "lucide-react";
import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

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
  const { isPending, mutateAsync: saveTemplate } = useSaveMailTemplate();
  const ref = useRef<{ submit: () => void; isValid: boolean }>();
  const [isFormValid, setIsFormValid] = useState(false);
  const tenantId = useProjectStore()?.selectedProject?.tenantId || "";

  const formSubmitHandler = async (data: IEmailTemplate) => {
    data.itemId = templateData?.itemId || "";
    const payload = {
      ...data,
      projectKey: tenantId,
    };
    const response = await saveTemplate(payload);
    data.itemId = response.itemId;
    setTemplateData(data);
    onStepComplete();
    nextStep();
  };

  return (
    <div className="mt-6 flex flex-col gap-6">
      <BasicInformation
        onSubmit={formSubmitHandler}
        templateData={templateData}
        onValidityChange={setIsFormValid}
        ref={ref}
      />
      <div className="flex flex-col-reverse gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-end">
        <Button
          type="button"
          size="default"
          className="w-full sm:w-auto"
          onClick={() => ref?.current?.submit()}
          disabled={isPending || !isFormValid}
        >
          Save &amp; continue
        </Button>
      </div>
    </div>
  );
};

type TemplateDesignStepProps = {
  templateData: IEmailTemplate;
  setTemplateData: (data: IEmailTemplate) => void;
};

const TemplateDesignStep = ({ templateData, setTemplateData }: TemplateDesignStepProps) => {
  const { isPending, mutateAsync: saveTemplate } = useSaveMailTemplate();
  const beeRef = useRef<{ submit: () => void; preview: () => void }>();
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
    <div className="mt-6 flex flex-col gap-4">
      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-end">
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
      <div className="flex min-h-[480px] flex-col overflow-hidden rounded-lg border border-border bg-card shadow-none">
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
          "w-full justify-start gap-y-4 rounded-lg border border-border bg-card px-4 py-4 sm:px-6 sm:py-5 md:gap-y-0",
        "horizontal-step":
          "flex-none shrink-0 [&:not(:last-child)]:flex-none [&:not(:last-child)]:after:flex-none [&:not(:last-child)]:after:w-8 sm:[&:not(:last-child)]:after:w-12 lg:[&:not(:last-child)]:after:w-16",
        "horizontal-step-container": "min-w-0",
        "step-label-container": "min-w-0",
        "step-label": "font-medium",
        "step-description": "max-w-[12rem] sm:max-w-none",
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
  BREADCRUMB_CUSTOM_TITLES["/email-management"] = "Email Management";
  BREADCRUMB_CUSTOM_TITLES["/email-management/new-communication"] = "New Template";

  return (
    <main className="flex min-h-0 flex-1 flex-col gap-4 p-4 sm:gap-6 sm:p-6">
      <header>
        <PageBreadcrumb
          breadcrumbIndex={3}
          listClassName="text-sm sm:text-base md:text-lg"
          className="flex"
        />
      </header>

      <EmailTemplateStepper />
    </main>
  );
}
