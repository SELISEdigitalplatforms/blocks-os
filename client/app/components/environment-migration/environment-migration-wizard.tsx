import { Link } from "react-router";
import { useProjectStore, useT, tStatic } from "@seliseblocks/genesis-os";
import { X } from "lucide-react";
import StepVerticalTrackBar from "@/components/stepper/vertical-track-bar";
import StepHorizontalTrackBar from "@/components/stepper/horizontal-track-bar";
import StepperProvider, { useStepper } from "@/components/stepper/stepper-provider";
import type { Steps } from "@/components/stepper/stepper-models";
import { EnvironmentServiceSelectionForm } from "./environment-service-selection-form";
import { ReviewConfirmForm } from "./review-confirm-form";
import { useDataMigrationFormState } from "./migration-form-state";

const getStepData = (): Steps => [
  { id: 1, title: tStatic("os.environments", "ENVIRONMENT_MIGRATION_WIZARD.ENVIRONMENTS_SERVICES") },
  { id: 2, title: tStatic("os.environments", "ENVIRONMENT_MIGRATION_WIZARD.REVIEW_CONFIRM") },
];

export const EnvironmentMigrationWizard = () => (
  <StepperProvider steps={getStepData()}>
    <EnvironmentMigrationWizardContent />
  </StepperProvider>
);

const EnvironmentMigrationWizardContent = () => {
  const { t } = useT("os.environments");
  const { resetFormData } = useDataMigrationFormState();
  const { currentStep } = useStepper();
  const { selectedTenantGroup } = useProjectStore();
  const environmentsPath = selectedTenantGroup
    ? `/app/project/${selectedTenantGroup}/environments`
    : "/app/console";

  return (
    <>
      <div className="flex flex-col md:hidden">
        <div className="mt-16 flex-1 p-5">
          <div className="flex flex-col items-center justify-center md:hidden">
            <div className="flex gap-2">
              <Link to={environmentsPath} onClick={resetFormData} aria-label={t("ENVIRONMENT_MIGRATION_WIZARD.CLOSE_MIGRATION")}>
                <X size={32} strokeWidth={1} />
              </Link>
              <p className="mt-[2px] text-lg font-semibold">{t("ENVIRONMENT_MIGRATION_WIZARD.ENVIRONMENT_MIGRATION")}</p>
            </div>
            <p className="mb-7 mt-2 text-sm font-normal text-medium-emphasis">
              {t("ENVIRONMENT_MIGRATION_WIZARD.CONFIGURE_YOUR_SOURCE_TARGET_AND")}
            </p>
            <StepHorizontalTrackBar />
          </div>
        </div>
        <div className="p-5">
          {currentStep === 1 && <EnvironmentServiceSelectionForm />}
          {currentStep === 2 && <ReviewConfirmForm />}
        </div>
      </div>

      <div className="hidden gap-12 px-10 md:flex">
        <div className="min-h-screen max-w-80 gap-5 bg-background p-5 pt-24 dark:bg-gray-900">
          <div className="mx-2 my-3">
            <div className="flex gap-2">
              <Link to={environmentsPath} onClick={resetFormData} aria-label={t("ENVIRONMENT_MIGRATION_WIZARD.CLOSE_MIGRATION")}>
                <X size={32} strokeWidth={1} />
              </Link>
              <p className="mt-[2px] text-lg font-semibold">{t("ENVIRONMENT_MIGRATION_WIZARD.ENVIRONMENT_MIGRATION")}</p>
            </div>
            <p className="mb-7 mt-2 text-sm font-normal text-medium-emphasis">
              {t("ENVIRONMENT_MIGRATION_WIZARD.CONFIGURE_YOUR_SOURCE_TARGET_AND")}
            </p>
          </div>
          <StepVerticalTrackBar />
        </div>
        <div className="mt-24 w-full">
          {currentStep === 1 && <EnvironmentServiceSelectionForm />}
          {currentStep === 2 && <ReviewConfirmForm />}
        </div>
      </div>
    </>
  );
};
