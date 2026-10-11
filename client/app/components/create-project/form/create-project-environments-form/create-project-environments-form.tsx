import { useEffect, useState } from "react";
import { ChevronRight, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui-kits/button/button";
import { useStepper } from "@/components/stepper/stepper-provider";
import { useCatalogue } from "@blocks-identifier/hooks/use-catalogue";
import type { ICatalogueResponse } from "@blocks-identifier/models/catalogue.model";
import { TopUpGroups } from "@blocks-identifier/components/top-up/top-up-groups";
import { useCreateProjectFormState } from "../../utils";
import { WizardFooter, WizardShell } from "../../wizard-shell";
import {
  DevTier,
  WizardSelection,
  environmentPrice,
  environmentsByRank,
  formatLimit,
  formatMoney,
  freeTierEnvironment,
  isFreeTier,
  limitsFor,
  meterRows,
  previewOrder,
} from "../../wizard-model";
import { environmentOptions } from "./utils";

/** A one-line description per environment. The catalogue has none, so the static list supplies it. */
const blurbFor = (env: string) => environmentOptions.find((o) => o.value === env)?.subtext ?? "";

const HARD_STOP_NOTE = {
  title: "Every limit is a hard stop",
  body: "Nothing runs past its limit and nothing is billed as excess. When you need more, you buy it.",
};

export const sortByRank = (catalogue: ICatalogueResponse, envs: string[]) =>
  [...new Set(envs)].sort(
    (a, b) => (catalogue.environments[a]?.rank ?? 0) - (catalogue.environments[b]?.rank ?? 0),
  );

export const CreateProjectEnvironmentsForm = () => {
  const { nextStep, previousStep } = useStepper();
  const { selection, setSelection } = useCreateProjectFormState();
  const { data: catalogue, loading, error, reload } = useCatalogue();
  // null until the user picks: the free-tier environment is shown first. "" = pane closed.
  const [picked, setFocus] = useState<string | null>(null);

  // The free-tier environment comes with every project: it is always in the selection.
  useEffect(() => {
    if (!catalogue) return;
    const free = freeTierEnvironment(catalogue);
    if (free && !selection.environments.includes(free)) {
      setSelection({ environments: sortByRank(catalogue, [...selection.environments, free]) });
    }
  }, [catalogue, selection.environments, setSelection]);

  if (loading && !catalogue) {
    return (
      <WizardShell intro="Tick every environment you need." note={HARD_STOP_NOTE}>
        <div className="p-10 text-sm text-medium-emphasis" role="status">
          Loading environments and prices…
        </div>
      </WizardShell>
    );
  }

  if (!catalogue) {
    return (
      <WizardShell intro="Tick every environment you need." note={HARD_STOP_NOTE}>
        <div className="flex flex-col items-start gap-3 p-10">
          <p className="text-sm text-high-emphasis">The environment list could not be loaded.</p>
          {error?.message && <p className="text-[12.5px] text-medium-emphasis">{error.message}</p>}
          <div className="flex gap-2.5">
            <Button variant="outline" onClick={previousStep}>
              Back
            </Button>
            <Button onClick={reload}>Try again</Button>
          </div>
        </div>
      </WizardShell>
    );
  }

  const free = freeTierEnvironment(catalogue);
  const focus = picked ?? free ?? environmentsByRank(catalogue)[0]?.[0] ?? "";
  const preview = previewOrder(catalogue, selection);
  const market = catalogue.market;
  const all = environmentsByRank(catalogue);

  const toggle = (env: string) => {
    const on = selection.environments.includes(env);
    const environments = on
      ? selection.environments.filter((e) => e !== env)
      : sortByRank(catalogue, [...selection.environments, env]);
    setSelection({ environments });
    setFocus(env);
  };

  const setTier = (devTier: DevTier) => {
    // Free development cannot hold top-ups; drop any when moving to free.
    const topUps = { ...selection.topUps };
    if (devTier === "free" && free && catalogue.topUp.requiresPaidEnvironment) delete topUps[free];
    setSelection({ devTier, topUps });
  };

  const setSteps = (env: string, meter: string, steps: number) => {
    const mine = { ...(selection.topUps[env] ?? {}) };
    if (steps <= 0) delete mine[meter];
    else mine[meter] = steps;
    setSelection({ topUps: { ...selection.topUps, [env]: mine } });
  };

  const cart = (
    <div className="rounded-lg border border-border bg-card px-3.5 py-3">
      <div className="mb-2 text-[12.5px] font-semibold text-high-emphasis">Your project</div>
      <ul className="flex flex-col gap-1">
        {preview.lines
          .filter((l) => l.billing === "rent")
          .map((l, i) => (
            <li
              key={`${l.environment}-${l.label}-${i}`}
              className="flex justify-between gap-2 font-mono text-[11.5px]"
            >
              <span className="truncate text-medium-emphasis">{l.label}</span>
              <span className="text-high-emphasis">
                {l.amount === 0 ? "Free" : formatMoney(market, l.amount)}
              </span>
            </li>
          ))}
      </ul>
      <div className="my-2 h-px bg-border" />
      <div className="flex justify-between text-[12.5px] font-semibold">
        <span>Per month</span>
        <span className="font-mono">{formatMoney(market, preview.recurring)}</span>
      </div>
    </div>
  );

  return (
    <WizardShell
      intro="Tick every environment you need. You only pay for the ones you tick."
      note={HARD_STOP_NOTE}
      railExtra={cart}
    >
      <div className="flex flex-1 flex-col gap-4 px-4 pb-6 pt-6 md:px-8 md:pt-9">
        <div>
          <div className="flex items-baseline gap-3">
            <h1 className="text-[26px] font-bold tracking-tight text-high-emphasis">
              Choose environments
            </h1>
            <span className="font-mono text-[12px] text-medium-emphasis">
              {selection.environments.length} of {all.length}
            </span>
          </div>
          <p className="text-[13px] text-medium-emphasis">
            Pick as many as you need. Each one is its own database with its own limits.
          </p>
        </div>

        <div className="flex flex-col gap-5 lg:flex-row lg:items-start">
          <ul className="flex flex-1 flex-col gap-2.5" aria-label="Environments">
            {all.map(([env, view]) => {
              const on = selection.environments.includes(env);
              const locked = env === free;
              const price = environmentPrice(catalogue, env, selection.devTier);
              const isFocus = focus === env;
              return (
                <li key={env}>
                  <div
                    className={cn(
                      "rounded-lg border bg-card",
                      on ? "border-primary" : "border-border",
                      isFocus && "ring-2 ring-blocks-primary-100",
                    )}
                  >
                    <div className="flex items-center gap-3 px-4 py-3">
                      <label
                        htmlFor={`env-${env}`}
                        className="flex min-w-0 flex-1 cursor-pointer items-start gap-3"
                      >
                        {locked ? (
                          <span
                            className="mt-0.5 text-low-emphasis"
                            title="Every project includes one"
                          >
                            <Lock size={16} aria-hidden="true" />
                          </span>
                        ) : (
                          <input
                            type="checkbox"
                            id={`env-${env}`}
                            checked={on}
                            onChange={() => toggle(env)}
                            className="mt-0.5 h-[18px] w-[18px] accent-primary"
                          />
                        )}
                        <span className="flex min-w-0 flex-col gap-0.5">
                          <span className="flex flex-wrap items-center gap-2">
                            <span className="text-[14px] font-semibold text-high-emphasis">
                              {view.label}
                            </span>
                            <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10.5px] text-medium-emphasis">
                              {env}
                            </span>
                            {locked && (
                              <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-800">
                                Included
                              </span>
                            )}
                          </span>
                          <span className="text-[12px] text-medium-emphasis">
                            {locked
                              ? "Every project gets one. Start free and move up whenever you outgrow it."
                              : blurbFor(env)}
                          </span>
                        </span>
                        <span className="ml-auto shrink-0 font-mono text-[13px] text-high-emphasis">
                          {price === null
                            ? "—"
                            : price === 0
                              ? "Free"
                              : `${formatMoney(market, price)} / mo`}
                        </span>
                      </label>
                      <button
                        type="button"
                        onClick={() => setFocus(isFocus ? "" : env)}
                        aria-expanded={isFocus}
                        aria-label={`Show what ${view.label} includes`}
                        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-medium-emphasis hover:bg-accent md:h-8 md:w-8"
                      >
                        <ChevronRight
                          size={16}
                          aria-hidden="true"
                          className={cn("transition-transform", isFocus && "rotate-90 lg:rotate-0")}
                        />
                      </button>
                    </div>

                    {locked && view.freeTierAvailable && (
                      <div
                        role="radiogroup"
                        aria-label={`${view.label} tier`}
                        className="grid grid-cols-1 gap-2 px-4 pb-3 sm:grid-cols-2"
                      >
                        {(["free", "paid"] as DevTier[]).map((tier) => {
                          const tierPrice = tier === "free" ? (view.freePrice ?? 0) : view.price;
                          const checked = selection.devTier === tier;
                          return (
                            <label
                              key={tier}
                              htmlFor={`tier-${tier}`}
                              className={cn(
                                "flex min-h-11 cursor-pointer items-center gap-2.5 rounded-md border px-3 py-2",
                                checked ? "border-primary bg-blocks-primary-25" : "border-border",
                              )}
                            >
                              <input
                                type="radio"
                                id={`tier-${tier}`}
                                name="dev-tier"
                                checked={checked}
                                onChange={() => setTier(tier)}
                                className="accent-primary"
                              />
                              <span className="flex flex-1 flex-col">
                                <span className="text-[13px] font-semibold">
                                  {tier === "free" ? "Free" : "Paid"}
                                </span>
                                <span className="text-[11.5px] text-medium-emphasis">
                                  {tier === "free"
                                    ? "Build anything, small fuel"
                                    : "More room, and tops up"}
                                </span>
                              </span>
                              <span className="font-mono text-[12.5px]">
                                {tierPrice == null ? "—" : formatMoney(market, tierPrice)}
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    )}

                    {/* Phone and tablet: the detail opens in place under its card. */}
                    {isFocus && (
                      <div className="border-t border-border px-4 py-4 lg:hidden">
                        <EnvironmentDetail
                          catalogue={catalogue}
                          env={env}
                          selection={selection}
                          onSteps={(meter, steps) => setSteps(env, meter, steps)}
                        />
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>

          {focus && (
            <aside className="sticky top-6 hidden w-[400px] shrink-0 rounded-lg border border-border bg-card p-5 lg:block">
              <EnvironmentDetail
                catalogue={catalogue}
                env={focus}
                selection={selection}
                onSteps={(meter, steps) => setSteps(focus, meter, steps)}
              />
            </aside>
          )}
        </div>

        <WizardFooter
          note={
            <>
              {selection.environments.length}{" "}
              {selection.environments.length === 1 ? "environment" : "environments"} ·{" "}
              <span className="font-mono">{formatMoney(market, preview.recurring)}</span> per month
              {preview.oneOff > 0 && (
                <>
                  {" "}
                  · <span className="font-mono">{formatMoney(market, preview.oneOff)}</span> one-off
                  today
                </>
              )}
            </>
          }
          back={{ onClick: previousStep }}
          primary={
            <Button type="button" onClick={nextStep} disabled={selection.environments.length === 0}>
              Continue
            </Button>
          }
        />
      </div>
    </WizardShell>
  );
};

interface EnvironmentDetailProps {
  catalogue: ICatalogueResponse;
  env: string;
  selection: WizardSelection;
  onSteps: (meter: string, steps: number) => void;
}

/** One environment's limits and top-ups. Top-ups only for a ticked, paid environment. */
export const EnvironmentDetail = ({
  catalogue,
  env,
  selection,
  onSteps,
}: EnvironmentDetailProps) => {
  const view = catalogue.environments[env];
  if (!view) return null;
  const on = selection.environments.includes(env);
  const freeTier = isFreeTier(catalogue, env, selection.devTier);
  const limits = limitsFor(catalogue, env, selection.devTier);
  const price = environmentPrice(catalogue, env, selection.devTier);
  const rows = meterRows(catalogue);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-[17px] font-semibold text-high-emphasis">{view.label}</h2>
            <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10.5px]">{env}</span>
            <span
              className={cn(
                "rounded px-1.5 py-0.5 text-[10px] font-semibold",
                on ? "bg-emerald-50 text-emerald-800" : "bg-muted text-medium-emphasis",
              )}
            >
              {on ? (freeTier ? "Free tier" : "Selected") : "Not selected"}
            </span>
          </div>
          <p className="mt-1 text-[12px] text-medium-emphasis">
            {view.topUpUncapped ? "Live traffic. Tops up without a ceiling." : blurbFor(env)}
          </p>
        </div>
        <div className="text-right">
          <div className="font-mono text-[16px] font-medium">
            {price === null ? "—" : price === 0 ? "Free" : formatMoney(catalogue.market, price)}
          </div>
          <div className="text-[11px] text-low-emphasis">{price ? "per month" : ""}</div>
        </div>
      </div>

      <div>
        <div className="mb-2 flex items-center gap-2 text-[10.5px] font-semibold uppercase tracking-wide text-low-emphasis">
          What it includes <span className="h-px flex-1 bg-border" /> {rows.length} meters
        </div>
        <dl className="grid grid-cols-1 gap-x-6 gap-y-1 sm:grid-cols-2">
          {rows.map((row) => (
            <div key={row.id} className="flex justify-between gap-3 text-[12px]">
              <dt className="truncate text-medium-emphasis">{row.label}</dt>
              <dd className="font-mono text-high-emphasis">
                {row.kind === "policy" && (limits[row.id] ?? 0) < 0
                  ? "Never stops"
                  : formatLimit(limits[row.id], row.unit)}
              </dd>
            </div>
          ))}
        </dl>
      </div>

      <div>
        <div className="mb-2 flex items-center gap-2 text-[10.5px] font-semibold uppercase tracking-wide text-low-emphasis">
          Top up <span className="h-px flex-1 bg-border" />
          {view.topUpUncapped
            ? "no ceiling"
            : `up to ${catalogue.topUp.maxMultipleOfIncluded}× included`}
        </div>
        {!on ? (
          <p className="text-[12.5px] text-medium-emphasis">
            Tick this environment to buy more of anything.
          </p>
        ) : freeTier && catalogue.topUp.requiresPaidEnvironment ? (
          <p className="rounded-md bg-warning-100 px-3 py-2 text-[12.5px] text-warning-800">
            Free development can&apos;t be topped up. Switch it to Paid to buy more.
          </p>
        ) : (
          <TopUpGroups
            catalogue={catalogue}
            environment={env}
            devTier={selection.devTier}
            steps={selection.topUps[env] ?? {}}
            onChange={onSteps}
          />
        )}
      </div>
    </div>
  );
};
