import { useEffect } from "react";
import { Link } from "react-router";
import { X } from "lucide-react";
import { useQueryState } from "nuqs";
import StepVerticalTrackBar from "@/components/stepper/vertical-track-bar";
import StepHorizontalTrackBar from "@/components/stepper/horizontal-track-bar";
import StepperProvider, { useStepper } from "@/components/stepper/stepper-provider";
import { Steps } from "@/components/stepper/stepper-models";
import { useCreateProjectFormState } from "@/components/create-project/utils";
import { CreateProjectNamingForm } from "@/components/create-project/form/create-project-naming-form/create-project-naming-form";
import { CreateProjectResourcesForm } from "@/components/create-project/form/create-project-resources-form/create-project-resources-form";
import { CreateProjectEnvironmentsForm } from "@/components/create-project/form/create-project-environments-form/create-project-environments-form";
import { useT } from "@seliseblocks/genesis-os";
const STEP_COUNT = 3;
export const CreateProjectWrapper = () => {
  const { t } = useT("os.create-project");
  const stepData: Steps = [
    { id: 1, title: t("CREATE_PROJECT.NAME_YOUR_PROJECT") },
    { id: 2, title: t("CREATE_PROJECT.ADD_RESOURCES") },
    { id: 3, title: t("CREATE_PROJECT.CONFIGURE_ENVIRONMENTS") },
  ];
  return (
    <StepperProvider steps={stepData}>
      <CreateProject />
    </StepperProvider>
  );
};
const CreateProject = () => {
  const { t } = useT("os.create-project");
  const { resetFormData } = useCreateProjectFormState();
  const [tab, setTab] = useQueryState("tab", { defaultValue: "1" });
  const { currentStep, goToStep, setCompletedSteps, completedSteps } = useStepper();
  useEffect(() => {
    if (tab) {
      const step = parseInt(tab, 10);
      if (!isNaN(step) && step > 0 && step <= STEP_COUNT && step === 2) {
        if (!completedSteps.includes(1)) {
          setCompletedSteps([1]);
          return;
        }
        goToStep(step);
        setTab("0");
      }
    }
  }, [tab, completedSteps, goToStep, setCompletedSteps, setTab]);
  return (
    <>
      {/* mobile design */}
      <div className="flex flex-col md:hidden">
        <div className="mt-16 flex-1 p-5">
          <div className="flex flex-col items-center justify-center md:hidden">
            <div className="flex gap-2">
              <Link to="/console">
                <X onClick={resetFormData} size={32} strokeWidth={1} />
              </Link>
              <p className="mt-[2px] text-lg font-semibold">{t("CREATE_PROJECT.CREATE_A_PROJECT")}</p>
            </div>
            <p className="mb-7 mt-2 text-sm font-normal text-medium-emphasis">
              {t("CREATE_PROJECT.GET_STARTED")}
            </p>
            <StepHorizontalTrackBar />
          </div>
        </div>
        <div className="p-5">
          {currentStep === 1 && <CreateProjectNamingForm />}
          {currentStep === 2 && <CreateProjectResourcesForm />}
          {currentStep === 3 && <CreateProjectEnvironmentsForm />}
        </div>
      </div>
      {/* desktop design */}
      <div className="hidden gap-12 px-10 md:flex">
        <div className="min-h-screen max-w-80 gap-5 bg-background p-5 pt-24 dark:bg-gray-900">
          <div className="mx-2 my-3">
            <div className="flex gap-2">
              <Link to="/console">
                <X onClick={resetFormData} size={32} strokeWidth={1} />
              </Link>
              <p className="mt-[2px] text-lg font-semibold">{t("CREATE_PROJECT.CREATE_A_PROJECT")}</p>
            </div>
            <p className="mb-7 mt-2 text-sm font-normal text-medium-emphasis">
              {t("CREATE_PROJECT.GET_STARTED")}
            </p>
          </div>
          <StepVerticalTrackBar />
        </div>
        <div className="mt-24 w-full">
          {currentStep === 1 && <CreateProjectNamingForm />}
          {currentStep === 2 && <CreateProjectResourcesForm />}
          {currentStep === 3 && <CreateProjectEnvironmentsForm />}
        </div>
      </div>
    </>
  );
};
