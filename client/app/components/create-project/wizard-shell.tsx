import { ReactNode } from "react";
import { Link } from "react-router";
import { Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useStepper } from "@/components/stepper/stepper-provider";
import { useCreateProjectFormState } from "./utils";

export const WIZARD_STEPS = [
  { id: 1, title: "Name your project" },
  { id: 2, title: "Choose environments" },
  { id: 3, title: "Add repositories" },
  { id: 4, title: "Review and create" },
];

/** Where Cancel and the X land: the console, with the half-filled wizard thrown away. */
export const WIZARD_EXIT = "/app/console";

interface WizardShellProps {
  /** One line under "Create a project" for this step. */
  intro: string;
  /** The tinted box at the foot of the rail. */
  note: { title: string; body: string };
  /** Extra rail content under the note, e.g. the running total on step 2. */
  railExtra?: ReactNode;
  children: ReactNode;
}

/**
 * The create-project frame: a step rail on the left (desktop) or a segmented progress bar
 * (phone), and the step's content. Each finished step shows what was chosen under its title.
 */
export const WizardShell = ({ intro, note, railExtra, children }: WizardShellProps) => {
  const { currentStep, goToStep } = useStepper();
  const { naming, selection, repositories, resetFormData } = useCreateProjectFormState();

  const deploymentTotal = Object.values(repositories.deployments).reduce(
    (s, envs) => s + envs.length,
    0,
  );
  const summaries: Record<number, string> = {
    1: naming.name,
    2: selection.environments.join(" · "),
    3:
      repositories.assets.length === 0
        ? "none yet"
        : `${deploymentTotal} across ${selection.environments.length} environments`,
  };

  return (
    <div className="flex min-h-screen flex-col bg-surface-app md:flex-row">
      <aside className="hidden w-[260px] shrink-0 flex-col gap-7 border-r border-border bg-card px-5 py-8 md:flex">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2.5">
            <Link
              to={WIZARD_EXIT}
              onClick={resetFormData}
              aria-label="Close and return to the console"
              className="text-medium-emphasis hover:text-high-emphasis"
            >
              <X size={22} strokeWidth={1.4} />
            </Link>
            <span className="text-[17px] font-semibold text-high-emphasis">Create a project</span>
          </div>
          <p className="text-[12.5px] leading-normal text-medium-emphasis">{intro}</p>
        </div>

        <ol className="flex flex-col gap-1" aria-label="Steps">
          {WIZARD_STEPS.map((step, index) => {
            const done = step.id < currentStep;
            const active = step.id === currentStep;
            const last = index === WIZARD_STEPS.length - 1;
            return (
              <li key={step.id} className="flex gap-3">
                <div className="flex flex-col items-center gap-1">
                  <span
                    aria-current={active ? "step" : undefined}
                    className={cn(
                      "flex h-6 w-6 items-center justify-center rounded-full text-[11.5px] font-bold",
                      done && "bg-primary text-white",
                      active && "border-2 border-primary bg-card text-primary",
                      !done && !active && "border-2 border-border bg-card text-low-emphasis",
                    )}
                  >
                    {done ? <Check size={13} strokeWidth={3} aria-hidden="true" /> : step.id}
                  </span>
                  {!last && <span className={cn("h-6 w-0.5", done ? "bg-primary" : "bg-border")} />}
                </div>
                <div className="pt-0.5">
                  {done ? (
                    <button
                      type="button"
                      onClick={() => goToStep(step.id)}
                      className="text-left text-[13.5px] font-medium text-high-emphasis hover:underline"
                    >
                      {step.title}
                    </button>
                  ) : (
                    <div
                      className={cn(
                        "text-[13.5px]",
                        active ? "font-semibold text-primary" : "font-medium text-medium-emphasis",
                      )}
                    >
                      {step.title}
                    </div>
                  )}
                  {done && summaries[step.id] && (
                    <div className="max-w-[170px] truncate font-mono text-[11.5px] text-medium-emphasis">
                      {summaries[step.id]}
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ol>

        <div className="mt-auto flex flex-col gap-3">
          <div className="rounded-lg border border-blocks-primary-100 bg-blocks-primary-25 px-3.5 py-3">
            <div className="mb-1 text-[12.5px] font-semibold text-high-emphasis">{note.title}</div>
            <p className="text-[11.5px] leading-normal text-medium-emphasis">{note.body}</p>
          </div>
          {railExtra}
        </div>
      </aside>

      {/* Phone: the rail becomes a four-segment bar with the same information. */}
      <div className="flex flex-col gap-3 border-b border-border bg-card px-4 pb-4 pt-5 md:hidden">
        <div className="flex items-center gap-2.5">
          <Link
            to={WIZARD_EXIT}
            onClick={resetFormData}
            aria-label="Close and return to the console"
            className="flex h-11 w-11 items-center justify-center text-medium-emphasis"
          >
            <X size={22} strokeWidth={1.4} />
          </Link>
          <span className="text-base font-semibold text-high-emphasis">Create a project</span>
        </div>
        <div className="flex gap-1" aria-hidden="true">
          {WIZARD_STEPS.map((step) => (
            <span
              key={step.id}
              className={cn(
                "h-1 flex-1 rounded-full",
                step.id <= currentStep ? "bg-primary" : "bg-border",
              )}
            />
          ))}
        </div>
        <div className="text-xs text-medium-emphasis">
          Step {currentStep} of {WIZARD_STEPS.length} · {WIZARD_STEPS[currentStep - 1]?.title}
        </div>
      </div>

      <main className="flex min-w-0 flex-1 flex-col">{children}</main>
    </div>
  );
};

interface WizardFooterProps {
  note: ReactNode;
  back?:
    { label?: string; onClick: () => void } | { label?: string; to: string; onClick?: () => void };
  primary: ReactNode;
}

/** The step's bottom bar: a status line on the left, Back/Cancel and the primary action on the right. */
export const WizardFooter = ({ note, back, primary }: WizardFooterProps) => (
  <div className="mt-auto flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
    <span className="text-[12.5px] text-medium-emphasis" aria-live="polite">
      {note}
    </span>
    <div className="flex gap-2.5">
      {back &&
        ("to" in back ? (
          <Link
            to={back.to}
            onClick={back.onClick}
            className="inline-flex h-10 items-center rounded-md border border-input bg-background px-4 text-sm font-medium text-high-emphasis hover:bg-accent"
          >
            {back.label ?? "Cancel"}
          </Link>
        ) : (
          <button
            type="button"
            onClick={back.onClick}
            className="inline-flex h-10 items-center rounded-md border border-input bg-background px-4 text-sm font-medium text-high-emphasis hover:bg-accent"
          >
            {back.label ?? "Back"}
          </button>
        ))}
      {primary}
    </div>
  </div>
);
