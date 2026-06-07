import { Link } from "react-router-dom"
import { X } from "lucide-react"
import StepVerticalTrackBar from "@/components/stepper/vertical-track-bar"
import StepHorizontalTrackBar from "@/components/stepper/horizontal-track-bar"
import StepperProvider, { useStepper } from "@/components/stepper/stepper-provider"
import type { Steps } from "@/components/stepper/stepper-models"
import { EnvironmentServiceSelectionForm } from "./environment-service-selection-form"
import { ReviewConfirmForm } from "./review-confirm-form"
import { useDataMigrationFormState } from "./migration-form-state"

const stepData: Steps = [
  { id: 1, title: "Environments & services" },
  { id: 2, title: "Review & confirm" },
]

export const EnvironmentMigrationWizard = () => (
  <StepperProvider steps={stepData}>
    <EnvironmentMigrationWizardContent />
  </StepperProvider>
)

const EnvironmentMigrationWizardContent = () => {
  const { resetFormData } = useDataMigrationFormState()
  const { currentStep } = useStepper()

  return (
    <>
      <div className="flex flex-col md:hidden">
        <div className="mt-16 flex-1 p-5">
          <div className="flex flex-col items-center justify-center md:hidden">
            <div className="flex gap-2">
              <Link
                to="/project-overview/environments"
                onClick={resetFormData}
                aria-label="Close migration"
              >
                <X size={32} strokeWidth={1} />
              </Link>
              <p className="mt-[2px] text-lg font-semibold">Environment migration</p>
            </div>
            <p className="mb-7 mt-2 text-sm font-normal text-medium-emphasis">
              Configure your source, target, and services to migrate.
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
              <Link
                to="/project-overview/environments"
                onClick={resetFormData}
                aria-label="Close migration"
              >
                <X size={32} strokeWidth={1} />
              </Link>
              <p className="mt-[2px] text-lg font-semibold">Environment migration</p>
            </div>
            <p className="mb-7 mt-2 text-sm font-normal text-medium-emphasis">
              Configure your source, target, and services to migrate.
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
  )
}
