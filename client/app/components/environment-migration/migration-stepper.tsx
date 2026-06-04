import { cn } from "@/lib/utils"

const MIGRATION_STEPS = [
  { id: 1, title: "Environments & services" },
  { id: 2, title: "Review & confirm" },
] as const

type MigrationStepperProps = {
  activeStep?: 1 | 2
}

export const MigrationStepper = ({ activeStep = 1 }: MigrationStepperProps) => {
  return (
    <nav aria-label="Migration steps" className="space-y-0">
      {MIGRATION_STEPS.map((step, index) => {
        const isActive = step.id === activeStep
        const isLast = index === MIGRATION_STEPS.length - 1

        return (
          <div
            key={step.id}
            className={cn("relative flex flex-col", !isLast && "pb-1")}
          >
            <div className="flex items-center gap-3">
              <span
                className={cn(
                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-sm font-semibold",
                  isActive
                    ? "border-foreground bg-foreground text-background"
                    : "border-muted-foreground/40 text-muted-foreground",
                )}
                aria-current={isActive ? "step" : undefined}
              >
                {step.id}
              </span>
              <span
                className={cn(
                  "text-base font-medium",
                  isActive ? "text-foreground" : "text-muted-foreground",
                )}
              >
                {step.title}
              </span>
            </div>
            {!isLast && (
              <div
                className="ml-4 my-2 h-10 w-px bg-border"
                aria-hidden
              />
            )}
          </div>
        )
      })}
    </nav>
  )
}
