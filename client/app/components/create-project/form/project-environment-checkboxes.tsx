import { GitBranch } from "lucide-react";
import { Checkbox } from "@/components/ui-kits/checkbox/checkbox";
import { environmentOptions } from "./create-project-environments-form/utils";

/**
 * The wizard's environment checkbox group: same options, same order, same branch-name hint.
 * Extracted so the /connect no-project branch offers an identical choice (AC3.4).
 */
export const ProjectEnvironmentCheckboxes = ({
  selected,
  onToggle,
  disabled = false,
}: {
  selected: string[];
  onToggle: (environment: string, checked: boolean) => void;
  disabled?: boolean;
}) => (
  <div>
    <div className="mt-2 flex min-h-10 w-fit flex-row items-center gap-1 rounded border border-base-warning bg-warning-100 p-3 text-sm text-warning-800">
      <span>
        Please ensure that the branch name in your Git repository matches the environment&apos;s
        label exactly — for example, use &apos;dev&apos; for the Development environment.
      </span>
    </div>
    <div className="mt-8 text-sm">
      {environmentOptions.map((option) => (
        <div key={option.value} className="mb-4 flex flex-col">
          <div className="flex items-center gap-2">
            <Checkbox
              className="h-5 w-5"
              checked={selected.includes(option.value)}
              onCheckedChange={(checked) => onToggle(option.value, checked === true)}
              disabled={disabled}
              aria-label={option.label}
            />
            <label className="text-lg font-bold">
              <div className="flex flex-row items-center gap-2">
                <span>{option.label}</span>
                <div className="flex flex-row items-center">
                  <GitBranch className="h-3 w-3 text-gray-400" />
                  <span className="text-sm text-gray-400">
                    {option.value === "prod" ? "main" : option.value}
                  </span>
                </div>
              </div>
            </label>
          </div>
          <div className="ml-7 text-base font-normal">{option.subtext}</div>
        </div>
      ))}
    </div>
  </div>
);

/** Sorts selected environment values into the wizard's canonical order. */
export const sortEnvironments = (values: string[]): string[] =>
  [...values].sort(
    (a, b) =>
      (environmentOptions.find((opt) => opt.value === a)?.index ?? 0) -
      (environmentOptions.find((opt) => opt.value === b)?.index ?? 0),
  );
