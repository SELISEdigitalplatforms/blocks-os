import PageBreadcrumb from "@/components/breadcrumb/breadcrumb";
import { Badge } from "@/components/ui-kits/badge/badge";
import { Button } from "@/components/ui-kits/button/button";
import { Step, Stepper, useStepper, type StepItem } from "@/components/ui-kits/stepper";
import { showErrorToast, toast } from "@/hooks/use-toast";
import { isErrorWithErrors } from "@/lib/error";
import BasicInformation from "@blocks-communication/mail/components/email-service/basic-information/basic-information";
import MailcraftEditor, {
  IMailcraftEditorRef,
} from "@blocks-communication/mail/components/mailcraft-editor/mailcraft-editor";
import { useSaveMailTemplate } from "@blocks-communication/mail/hooks/use-email-template";
import { useCopyTemplateToOrganizations } from "@blocks-communication/mail/hooks/use-template-copy";
import {
  NO_SHARE,
  isShareReady,
  joinNames,
  toCopyRequest,
  type ShareChoice,
} from "@blocks-communication/mail/constants/share-organizations";
import { templateErrorMessages } from "@blocks-communication/mail/constants/template-errors";
import { IEmailTemplate } from "@blocks-communication/mail/models/email";
import { useProjectStore, useT } from "@seliseblocks/genesis-os";
import { useScopedPath } from "@seliseblocks/genesis-os/hooks";
import { Copy, FileText, LayoutTemplate } from "lucide-react";
import { useRef, useState } from "react";
import { useNavigate } from "react-router";

const I18N_MODULE = "os.communication.mail";

const EMAIL_TEMPLATE_STEPS: StepItem[] = [{ id: "basic-information" }, { id: "template" }];

const BasicInformationLabel = () => {
  const { t } = useT(I18N_MODULE);
  return (
    <span className="flex flex-wrap items-center gap-2">
      {t("NEW_COMMUNICATION.BASIC_INFORMATION")}
      <Badge
        variant="secondary"
        className="px-1.5 py-0 text-[10px] font-medium uppercase tracking-wide"
      >
        {t("NEW_COMMUNICATION.REQUIRED")}
      </Badge>
    </span>
  );
};

const TemplateLabel = () => {
  const { t } = useT(I18N_MODULE);
  return (
    <span className="flex flex-wrap items-center gap-2">
      {t("NEW_COMMUNICATION.TEMPLATE")}
      <Badge
        variant="outline"
        className="px-1.5 py-0 text-[10px] font-medium uppercase tracking-wide"
      >
        {t("NEW_COMMUNICATION.DESIGN")}
      </Badge>
    </span>
  );
};

type BasicInformationStepProps = {
  templateData: IEmailTemplate;
  setTemplateData: (data: IEmailTemplate) => void;
  onStepComplete: () => void;
  shareChoice: ShareChoice;
  onShareChoiceChange: (choice: ShareChoice) => void;
};

const BasicInformationStep = ({
  templateData,
  setTemplateData,
  onStepComplete,
  shareChoice,
  onShareChoiceChange,
}: BasicInformationStepProps) => {
  const { t } = useT(I18N_MODULE);
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
        shareChoice={shareChoice}
        onShareChoiceChange={onShareChoiceChange}
        ref={ref}
        actions={
          <Button
            type="button"
            size="default"
            className="w-full sm:w-auto"
            onClick={() => ref?.current?.submit()}
            // A copy to selected organizations needs at least one of them (SPEC33 C8).
            disabled={isSaving || !isFormValid || !isShareReady(shareChoice)}
          >
            {t("NEW_COMMUNICATION.SAVE_AND_CONTINUE")}
          </Button>
        }
      />
    </div>
  );
};

type TemplateDesignStepProps = {
  templateData: IEmailTemplate;
  setTemplateData: (data: IEmailTemplate) => void;
  shareChoice: ShareChoice;
};

/** SPEC33 §4 TemplateFormDesign: which organizations also get the template when it is saved. */
const ShareStrip = ({ shareChoice }: { shareChoice: ShareChoice }) => {
  const { t } = useT(I18N_MODULE);
  const { prevStep } = useStepper();
  const names = [...shareChoice.selected.values()];
  return (
    <div
      role="status"
      className="flex flex-wrap items-center gap-3 rounded-md border border-blue-200 bg-blue-50 px-4 py-3 text-blue-800"
    >
      <Copy className="h-5 w-5 shrink-0" aria-hidden="true" />
      <span className="min-w-0 flex-1 text-sm leading-relaxed">
        {shareChoice.allOrganizations
          ? t("SHARE_WITH_ORGANIZATIONS.STRIP_ALL")
          : t("SHARE_WITH_ORGANIZATIONS.STRIP", {
              count: names.length,
              names: joinNames(names, t),
            })}
      </span>
      {/* Back to step 1, where the share choice is kept (Q4: A). */}
      <Button type="button" variant="outline" size="sm" onClick={prevStep}>
        {t("SHARE_WITH_ORGANIZATIONS.CHANGE")}
      </Button>
    </div>
  );
};

const TemplateDesignStep = ({
  templateData,
  setTemplateData,
  shareChoice,
}: TemplateDesignStepProps) => {
  const { t } = useT(I18N_MODULE);
  const { isPending, mutateAsync: saveTemplate } = useSaveMailTemplate();
  const { mutateAsync: copyTemplate } = useCopyTemplateToOrganizations();
  const editorRef = useRef<IMailcraftEditorRef | null>(null);
  const navigate = useNavigate();
  const scoped = useScopedPath();
  const tenantId = useProjectStore()?.selectedProject?.tenantId || "";
  const emailBasePath = scoped("email-management");

  // The template is saved either way; a copy that can't start only says so.
  const startCopy = async (templateId: string) => {
    const showFailure = (errors: unknown) =>
      showErrorToast({ errors, customMessages: templateErrorMessages(t) });
    try {
      const res = await copyTemplate(toCopyRequest(templateId, shareChoice));
      if (res?.isSuccess) {
        toast({
          variant: "success",
          title: t("common:SUCCESS"),
          description: t("COPY_TO_ORGANIZATIONS.STARTED"),
        });
        return;
      }
      showFailure(res?.errors);
    } catch (error) {
      showFailure(isErrorWithErrors(error) ? error.errors : undefined);
    }
  };

  const handleEditorSave = async (data: { htmlFile: string }) => {
    const currentData: IEmailTemplate = {
      itemId: templateData?.itemId || "",
      templateBody: data.htmlFile,
    };

    try {
      const payload = {
        ...currentData,
        projectKey: tenantId,
      };
      const res = await saveTemplate(payload);
      setTemplateData(currentData);
      if (res.isSuccess) {
        // The copies are made only now, from the finished email (SPEC33 H7, C10).
        if (shareChoice.copy) {
          await startCopy(res.itemId);
        }
        navigate(`${emailBasePath}/communications/${res.itemId}`);
        return;
      }

      toast({
        variant: "destructive",
        title: t("common:ERROR"),
        description: JSON.stringify(res.errors),
      });
      navigate(emailBasePath);
    } catch {
      toast({
        variant: "destructive",
        title: t("common:ERROR"),
        description: t("NEW_COMMUNICATION.SOMETHING_WENT_WRONG"),
      });
      navigate(emailBasePath);
    }
  };

  return (
    <div className="mt-6 flex w-full flex-col gap-4">
      {shareChoice.copy ? <ShareStrip shareChoice={shareChoice} /> : null}
      <div className="flex flex-col gap-3 rounded-sm border border-border bg-card px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold text-high-emphasis">
            {t("NEW_COMMUNICATION.TEMPLATE_DESIGN")}
          </h2>
          <p className="text-sm text-low-emphasis">
            {t("NEW_COMMUNICATION.TEMPLATE_DESIGN_DESCRIPTION")}
          </p>
        </div>
        <div className="flex shrink-0 flex-col-reverse gap-2 sm:flex-row sm:items-center">
          <Button
            type="button"
            size="default"
            className="w-full sm:w-auto"
            disabled={isPending}
            onClick={() => editorRef?.current?.submit()}
          >
            {t("NEW_COMMUNICATION.SAVE_TEMPLATE")}
          </Button>
        </div>
      </div>
      <div className="flex min-h-[calc(100vh-22rem)] w-full flex-1 flex-col overflow-hidden rounded-sm border border-border bg-card shadow-none">
        <MailcraftEditor onSave={handleEditorSave} ref={editorRef} />
      </div>
    </div>
  );
};

function EmailTemplateStepper() {
  const { t } = useT(I18N_MODULE);
  const completedStepRef = useRef(0);
  const [templateData, setTemplateData] = useState<IEmailTemplate>({
    itemId: "",
  });
  // Kept here so it survives the move between the two steps (SPEC33 §6.4).
  const [shareChoice, setShareChoice] = useState<ShareChoice>(NO_SHARE);
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
          "flex-1 not-last:after:w-full sm:not-last:after:w-full lg:not-last:after:w-full",
        "horizontal-step-container": "min-w-0",
        "step-label-container": "min-w-0",
        "step-label": "font-medium",
        "step-description": "max-w-none",
      }}
    >
      <Step
        icon={FileText}
        label={<BasicInformationLabel />}
        description={t("NEW_COMMUNICATION.BASIC_INFORMATION_DESCRIPTION")}
      >
        <BasicInformationStep
          templateData={templateData}
          setTemplateData={setTemplateData}
          onStepComplete={handleStepComplete}
          shareChoice={shareChoice}
          onShareChoiceChange={setShareChoice}
        />
      </Step>

      <Step
        icon={LayoutTemplate}
        label={<TemplateLabel />}
        description={t("NEW_COMMUNICATION.TEMPLATE_STEP_DESCRIPTION")}
      >
        <TemplateDesignStep
          templateData={templateData}
          setTemplateData={setTemplateData}
          shareChoice={shareChoice}
        />
      </Step>
    </Stepper>
  );
}

export default function NewCommunication() {
  const { t } = useT(I18N_MODULE);
  const scoped = useScopedPath();
  const emailBasePath = scoped("email-management");
  const breadcrumbTitles = {
    [emailBasePath]: t("NEW_COMMUNICATION.BREADCRUMB_EMAIL_MANAGEMENT"),
    [`${emailBasePath}/new-communication`]: t("NEW_COMMUNICATION.BREADCRUMB_NEW_TEMPLATE"),
  };

  return (
    <main className="flex min-h-0 w-full flex-1 flex-col gap-4 p-4 sm:gap-6 sm:p-6">
      <header className="w-full space-y-4">
        <PageBreadcrumb breadcrumbIndex={3} className="flex" customTitles={breadcrumbTitles} />
      </header>

      <div className="w-full flex-1">
        <EmailTemplateStepper />
      </div>
    </main>
  );
}
