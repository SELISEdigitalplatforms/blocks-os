import { useEffect } from "react";
import { useQueryState } from "nuqs";
import StepperProvider, { useStepper } from "@/components/stepper/stepper-provider";
import { Steps } from "@/components/stepper/stepper-models";
import { WIZARD_STEPS } from "@/components/create-project/wizard-shell";
import { CreateProjectNamingForm } from "@/components/create-project/form/create-project-naming-form/create-project-naming-form";
import { CreateProjectEnvironmentsForm } from "@/components/create-project/form/create-project-environments-form/create-project-environments-form";
import { CreateProjectResourcesForm } from "@/components/create-project/form/create-project-resources-form/create-project-resources-form";
import { CreateProjectReviewForm } from "@/components/create-project/form/create-project-review-form/create-project-review-form";

const stepData: Steps = WIZARD_STEPS;

/** The step a returning Git-provider sign-in lands on: Add repositories. */
const REPOSITORIES_STEP = 3;

export const CreateProjectWrapper = () => {
  return (
    <StepperProvider steps={stepData}>
      <CreateProject />
    </StepperProvider>
  );
};

const CreateProject = () => {
  const [tab, setTab] = useQueryState("tab", { defaultValue: "1" });
  const { currentStep, goToStep, setCompletedSteps, completedSteps } = useStepper();

  // Back from connecting a Git provider (?tab=2 from older links, ?tab=3 now): reopen the
  // repositories step with the steps before it marked done.
  useEffect(() => {
    const step = parseInt(tab ?? "", 10);
    if (step !== 2 && step !== REPOSITORIES_STEP) return;
    const before = Array.from({ length: REPOSITORIES_STEP - 1 }, (_, i) => i + 1);
    if (!before.every((s) => completedSteps.includes(s))) {
      setCompletedSteps(before);
      return;
    }
    goToStep(REPOSITORIES_STEP);
    setTab("0");
  }, [tab, completedSteps, goToStep, setCompletedSteps, setTab]);

  return (
    <>
      {currentStep === 1 && <CreateProjectNamingForm />}
      {currentStep === 2 && <CreateProjectEnvironmentsForm />}
      {currentStep === 3 && <CreateProjectResourcesForm />}
      {currentStep === 4 && <CreateProjectReviewForm />}
    </>
  );
};
