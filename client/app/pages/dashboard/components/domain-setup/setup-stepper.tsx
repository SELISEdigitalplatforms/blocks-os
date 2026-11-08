import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { useT } from "@seliseblocks/genesis-os";

const STEP_TITLES = ["Add DNS records", "Verify & secure", "Connect your app"] as const;

export type SetupStepIndex = 0 | 1 | 2;

interface SetupStepperProps {
  current: SetupStepIndex;
  /** The current step stopped on an error. */
  failed?: boolean;
}

const stepMarker = ({
  isDone,
  isFailed,
  index,
}: {
  isDone: boolean;
  isFailed: boolean;
  index: number;
}) => {
  if (isDone) return <Check className="h-3.5 w-3.5" />;
  if (isFailed) return "!";
  return index + 1;
};

export const SetupStepper = ({ current, failed = false }: SetupStepperProps) => {
  const { t } = useT("os.dashboard");
  return (
    <ol className="flex items-center gap-3" aria-label={t("SETUP_STEPPER.SETUP_STEPS")}>
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
                {stepMarker({ isDone, isFailed: isCurrent && failed, index })}
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
};
