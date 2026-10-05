import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

const STEP_TITLES = ["Add DNS records", "Verify & secure", "Connect your app"] as const;

export type SetupStepIndex = 0 | 1 | 2;

interface SetupStepperProps {
  current: SetupStepIndex;
  /** The current step stopped on an error. */
  failed?: boolean;
}

export const SetupStepper = ({ current, failed = false }: SetupStepperProps) => (
  <ol className="flex items-center gap-3" aria-label="Setup steps">
    {STEP_TITLES.map((title, index) => {
      const isDone = index < current;
      const isCurrent = index === current;
      const isLast = index === STEP_TITLES.length - 1;

      return (
        <li
          key={title}
          className={cn("flex items-center gap-3", !isLast && "flex-1")}
          aria-current={isCurrent ? "step" : undefined}
        >
          <span className="flex items-center gap-2">
            <span
              className={cn(
                "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                isDone && "bg-green-700 text-white",
                isCurrent && !failed && "bg-primary text-white",
                isCurrent && failed && "bg-destructive text-white",
                !isDone && !isCurrent && "border border-border text-muted-foreground",
              )}
            >
              {isDone ? <Check className="h-3.5 w-3.5" /> : isCurrent && failed ? "!" : index + 1}
            </span>
            <span
              className={cn(
                "hidden whitespace-nowrap text-sm sm:inline",
                isCurrent ? "font-semibold text-high-emphasis" : "text-muted-foreground",
              )}
            >
              {title}
            </span>
          </span>
          {!isLast && (
            <span
              aria-hidden="true"
              className={cn("h-px flex-1", isDone ? "bg-green-700" : "bg-border")}
            />
          )}
        </li>
      );
    })}
  </ol>
);
