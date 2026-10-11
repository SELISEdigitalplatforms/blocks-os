import { Minus, Plus } from "lucide-react";
import type { ICatalogueResponse } from "@blocks-identifier/models/catalogue.model";
import {
  DevTier,
  formatMoney,
  isRecurringTopUp,
  maxSteps,
  meterRows,
} from "@/components/create-project/wizard-model";

interface TopUpGroupsProps {
  catalogue: ICatalogueResponse;
  environment: string;
  devTier: DevTier;
  /** steps per meter for this environment */
  steps: Record<string, number>;
  onChange: (meter: string, steps: number) => void;
  disabled?: boolean;
}

/**
 * Every purchasable meter of one environment, split the way it bills: one-off units that carry
 * past the period boundary, and recurring units charged every period while held. Steps stop at
 * the environment's ceiling (catalogue `maxMultipleOfIncluded`), except where it has none.
 */
export const TopUpGroups = ({
  catalogue,
  environment,
  devTier,
  steps,
  onChange,
  disabled,
}: TopUpGroupsProps) => {
  const market = catalogue.market;
  const rows = meterRows(catalogue)
    .filter((row) => catalogue.topUpSteps[row.id] && row.meter.purchasable !== false)
    .map((row) => ({
      ...row,
      step: catalogue.topUpSteps[row.id],
      max: maxSteps(catalogue, environment, row.id, devTier),
      count: steps[row.id] ?? 0,
    }))
    .filter((row) => row.max > 0 || row.count > 0);

  const groups = [
    {
      key: "once",
      chip: "One-off",
      note: "charged once, units carry past the boundary",
      chipClass: "bg-blocks-primary-50 text-blocks-primary-700",
      rows: rows.filter((r) => !isRecurringTopUp(r.step.billing)),
    },
    {
      key: "rent",
      chip: "Recurring",
      note: "charged every period while held",
      chipClass: "bg-warning-100 text-warning-800",
      rows: rows.filter((r) => isRecurringTopUp(r.step.billing)),
    },
  ].filter((g) => g.rows.length > 0);

  if (groups.length === 0) {
    return (
      <p className="text-[12.5px] text-medium-emphasis">
        Nothing in this environment can be topped up.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {groups.map((group) => {
        const subtotal = group.rows.reduce((s, r) => s + (r.step.price ?? 0) * r.count, 0);
        return (
          <div key={group.key} className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <span
                className={`rounded px-1.5 py-0.5 text-[9.5px] font-semibold uppercase tracking-wide ${group.chipClass}`}
              >
                {group.chip}
              </span>
              <span className="text-[11.5px] text-low-emphasis">{group.note}</span>
              <span className="ml-auto font-mono text-[12px] text-high-emphasis">
                {subtotal > 0 ? formatMoney(market, subtotal) : ""}
              </span>
            </div>
            <ul className="flex flex-col divide-y divide-border rounded-md border border-border">
              {group.rows.map((row) => {
                const atMax = row.count >= row.max;
                return (
                  <li key={row.id} className="flex items-center gap-2 px-3 py-2">
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="text-[12.5px] text-high-emphasis">{row.label}</span>
                      <span className="font-mono text-[10.5px] text-low-emphasis">
                        +{row.step.step.toLocaleString("en-US")} per step
                        {row.step.price != null ? ` · ${formatMoney(market, row.step.price)}` : ""}
                        {Number.isFinite(row.max) ? ` · up to ${row.max}` : ""}
                      </span>
                    </span>
                    <button
                      type="button"
                      disabled={disabled || row.count === 0}
                      onClick={() => onChange(row.id, row.count - 1)}
                      aria-label={`One step less ${row.label}`}
                      className="flex h-11 w-11 items-center justify-center rounded-md border border-input text-medium-emphasis disabled:opacity-40 md:h-8 md:w-8"
                    >
                      <Minus size={14} aria-hidden="true" />
                    </button>
                    <span className="w-6 text-center font-mono text-[13px]" aria-live="polite">
                      {row.count}
                    </span>
                    <button
                      type="button"
                      disabled={disabled || atMax}
                      onClick={() => onChange(row.id, row.count + 1)}
                      aria-label={`One step more ${row.label}`}
                      className="flex h-11 w-11 items-center justify-center rounded-md border border-input text-medium-emphasis disabled:opacity-40 md:h-8 md:w-8"
                    >
                      <Plus size={14} aria-hidden="true" />
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </div>
  );
};
