import { useEffect, useMemo, useState } from "react";
import { CreditCard, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui-kits/button/button";
import { useStepper } from "@/components/stepper/stepper-provider";
import { useCatalogue } from "@blocks-identifier/hooks/use-catalogue";
import { billingService } from "@blocks-identifier/services/billing.service";
import {
  IStartCheckoutResult,
  checkoutReasonMessage,
  checkoutRefusal,
} from "@blocks-identifier/models/billing.model";
import { AddCardDialog } from "@/pages/billing/add-card-dialog";
import { useCreateProjectFormState } from "../../utils";
import { WizardFooter, WizardShell } from "../../wizard-shell";
import {
  deploymentCount,
  environmentPrice,
  formatMoney,
  freeTierEnvironment,
  isFreeTier,
  isRecurringTopUp,
  meterLabel,
  previewOrder,
  topUpSelections,
} from "../../wizard-model";
import { useCreateAndPay } from "../../use-create-and-pay";

const dateFmt = (d: Date) => d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });

export const CreateProjectReviewForm = () => {
  const { previousStep } = useStepper();
  const { selection, repositories } = useCreateProjectFormState();
  const { data: catalogue, loading } = useCatalogue();
  const flow = useCreateAndPay(catalogue);
  const [quote, setQuote] = useState<IStartCheckoutResult | null>(null);
  const [quoteError, setQuoteError] = useState<string | null>(null);

  const free = catalogue ? freeTierEnvironment(catalogue) : null;
  const freeTier = selection.devTier === "free" && !!free && selection.environments.includes(free);

  // The server's price for a project that doesn't exist yet. Nothing is saved.
  useEffect(() => {
    if (!catalogue) return;
    let cancelled = false;
    billingService
      .quote({
        tenantGroupId: "",
        environments: selection.environments,
        topUps: topUpSelections(selection),
        freeTier,
      })
      .then((response) => {
        if (cancelled) return;
        const refusal = checkoutRefusal(response);
        if (refusal || !response.checkout) setQuoteError(checkoutReasonMessage(refusal));
        else setQuote(response.checkout);
      })
      .catch(() => !cancelled && setQuoteError(null));
    return () => {
      cancelled = true;
    };
  }, [catalogue, selection, freeTier]);

  const preview = useMemo(
    () => (catalogue ? previewOrder(catalogue, selection) : null),
    [catalogue, selection],
  );

  if (!catalogue || !preview) {
    return (
      <WizardShell intro="Last look before anything is created or charged." note={CREATE_NOTE}>
        <div className="p-10 text-sm text-medium-emphasis" role="status">
          {loading ? "Loading prices…" : "Prices could not be loaded. Go back and try again."}
        </div>
      </WizardShell>
    );
  }

  const market = quote?.market ?? catalogue.market;
  // The authoritative figures once the server has priced it; the preview until then.
  const shown = flow.checkout ?? quote;
  const dueToday = shown?.total ?? preview.dueToday;
  const vat = shown?.vat ?? preview.vat;
  const subtotal = shown?.subtotal ?? preview.subtotal;
  const recurringNet = shown?.recurringMonthly ?? preview.recurring;
  const recurringGross =
    Math.round(recurringNet * (1 + vat / Math.max(subtotal, 0.0001)) * 100) / 100;
  const envCount = selection.environments.length;
  const envTotal = selection.environments.reduce(
    (s, env) => s + (environmentPrice(catalogue, env, selection.devTier) ?? 0),
    0,
  );
  const recurringTopUps = Math.round((preview.recurring - envTotal) * 100) / 100;

  const today = new Date();
  const renewal = new Date(today.getTime() + catalogue.usagePeriodDays * 24 * 3600 * 1000);
  const defaultCard = flow.cards.find((c) => c.isDefault && !c.isExpired);
  const payLabel =
    dueToday > 0 ? `Pay ${formatMoney(market, dueToday)} and create` : "Create project";

  return (
    <WizardShell intro="Last look before anything is created or charged." note={CREATE_NOTE}>
      <div className="flex flex-1 flex-col gap-5 px-4 pb-6 pt-6 md:px-8 md:pt-9">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-start">
          <section className="flex flex-1 flex-col gap-3" aria-labelledby="review-title">
            <div>
              <h1
                id="review-title"
                className="text-[26px] font-bold tracking-tight text-high-emphasis"
              >
                Review and create
              </h1>
              <p className="text-[13px] text-medium-emphasis">
                Nothing is provisioned and nothing is charged until you press{" "}
                {dueToday > 0 ? "Pay" : "Create"}.
              </p>
            </div>

            {selection.environments.map((env) => {
              const view = catalogue.environments[env];
              const price = environmentPrice(catalogue, env, selection.devTier);
              const addons = topUpSelections(selection).filter((t) => t.environment === env);
              const repos = deploymentCount(repositories.deployments, env);
              return (
                <div key={env} className="rounded-lg border border-border bg-card px-4 py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[14px] font-semibold">{view?.label ?? env}</span>
                    <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10.5px]">
                      {env}
                    </span>
                    {isFreeTier(catalogue, env, selection.devTier) && (
                      <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-800">
                        Free tier
                      </span>
                    )}
                    <span className="ml-auto font-mono text-[13px]">
                      {price === null
                        ? "—"
                        : price === 0
                          ? "Free"
                          : `${formatMoney(market, price)} / month`}
                    </span>
                  </div>
                  <div className="mt-1.5 flex flex-col gap-1">
                    <span className="text-[12px] text-medium-emphasis">
                      {repos} {repos === 1 ? "repository" : "repositories"} connected
                    </span>
                    {addons.length === 0 ? (
                      <span className="text-[12px] text-low-emphasis">
                        No top-ups. You can add them any time from the console.
                      </span>
                    ) : (
                      addons.map((a) => {
                        const step = catalogue.topUpSteps[a.meter];
                        const recurring = isRecurringTopUp(step?.billing);
                        return (
                          <div key={a.meter} className="flex items-center gap-2 text-[12px]">
                            <span
                              className={cn(
                                "rounded px-1.5 py-0.5 text-[9.5px] font-semibold uppercase",
                                recurring
                                  ? "bg-warning-100 text-warning-800"
                                  : "bg-blocks-primary-50 text-blocks-primary-700",
                              )}
                            >
                              {recurring ? "Recurring" : "One-off"}
                            </span>
                            <span>{meterLabel(catalogue, a.meter)}</span>
                            <span className="font-mono text-low-emphasis">
                              {a.steps} {a.steps === 1 ? "step" : "steps"} · +
                              {((step?.step ?? 0) * a.steps).toLocaleString("en-US")}
                            </span>
                            <span className="ml-auto font-mono">
                              {formatMoney(market, (step?.price ?? 0) * a.steps)}
                              {recurring ? " / period" : ""}
                            </span>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })}

            <div className="rounded-lg border border-border bg-card px-4 py-3">
              <div className="mb-1.5 text-[12.5px] font-semibold">
                Worth knowing before you create
              </div>
              <ul className="list-disc space-y-1 pl-5 text-[12px] text-medium-emphasis">
                <li>
                  Every limit is a hard stop. Nothing runs past it and nothing is billed as excess —
                  when you need more, you buy it.
                </li>
                <li>
                  The allowance resets every {catalogue.usagePeriodDays} days. Units you buy
                  outright carry past the boundary until you spend them.
                </li>
                <li>
                  Adding an environment later is prorated and starts at once. Removing one takes
                  effect at the boundary, with no refund for the remainder.
                </li>
              </ul>
            </div>
          </section>

          <aside className="flex w-full flex-col gap-4 xl:w-[360px]">
            {dueToday > 0 && (
              <div className="rounded-lg border border-border bg-card p-4">
                <div className="mb-2 text-[12.5px] font-semibold">Pay with</div>
                {defaultCard ? (
                  <div className="flex items-center gap-2.5 rounded-md border border-primary bg-blocks-primary-25 px-3 py-2.5">
                    <CreditCard size={16} aria-hidden="true" />
                    <span className="font-mono text-[12.5px]">
                      {defaultCard.brand} •••• {defaultCard.lastFour}
                    </span>
                    <span className="ml-auto font-mono text-[11px] text-low-emphasis">
                      {String(defaultCard.expiryMonth).padStart(2, "0")} / {defaultCard.expiryYear}
                    </span>
                  </div>
                ) : (
                  <p className="text-[12px] text-medium-emphasis">
                    You&apos;ll add a card in a secure form after pressing the button. The card
                    number goes straight to our payment provider, never to Blocks.
                  </p>
                )}
                <p className="mt-2 flex gap-2 text-[11.5px] text-low-emphasis">
                  <ShieldCheck size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
                  Nothing is charged until you confirm. The card is stored against this project and
                  every renewal of it bills to that card.
                </p>
              </div>
            )}

            <div className="rounded-lg border border-border bg-card p-4">
              <div className="mb-2 text-[12.5px] font-semibold">Order</div>
              <dl className="flex flex-col gap-1 text-[12.5px]">
                <Row
                  label={`${envCount} ${envCount === 1 ? "environment" : "environments"}`}
                  value={formatMoney(market, envTotal)}
                  strong
                />
                {recurringTopUps > 0 && (
                  <Row label="Recurring top-ups" value={formatMoney(market, recurringTopUps)} />
                )}
                {preview.oneOff > 0 && (
                  <Row label="One-off units" value={formatMoney(market, preview.oneOff)} />
                )}
                <Row label="Subtotal" value={formatMoney(market, subtotal)} />
                <Row label="VAT" value={formatMoney(market, vat)} />
              </dl>
              <div className="my-2 h-px bg-border" />
              <div className="flex items-baseline justify-between">
                <span className="text-[14px] font-bold">Due today</span>
                <span className="font-mono text-[20px] font-bold">
                  {formatMoney(market, dueToday)}
                </span>
              </div>
              <div className="mt-1 flex items-baseline justify-between text-[12px] text-medium-emphasis">
                <span>Then every {catalogue.usagePeriodDays} days</span>
                <span className="font-mono">{formatMoney(market, recurringGross)}</span>
              </div>
              <div className="font-mono text-[11px] text-low-emphasis">
                first renewal{" "}
                {renewal.toLocaleDateString("en-GB", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
              </div>
              {!shown && !quoteError && (
                <p className="mt-2 text-[11px] text-low-emphasis">Confirming the price…</p>
              )}
              {quoteError && <p className="mt-2 text-[11.5px] text-error">{quoteError}</p>}
              {preview.unpriced && (
                <p className="mt-2 text-[11.5px] text-warning-800">
                  Something you picked has no price in {market} yet.
                </p>
              )}
            </div>

            <div className="rounded-lg border border-border bg-card p-4">
              <div className="mb-1.5 text-[12.5px] font-semibold">First period</div>
              <div className="flex items-center gap-2 font-mono text-[12px]">
                <span>{dateFmt(today)}</span>
                <span className="h-0.5 flex-1 rounded bg-primary" />
                <span>{dateFmt(renewal)}</span>
              </div>
              <p className="mt-1.5 text-[11.5px] text-medium-emphasis">
                Your allowance resets every {catalogue.usagePeriodDays} days from today. Adding or
                removing an environment, or buying units, never moves that date.
              </p>
            </div>
          </aside>
        </div>

        {flow.message && (
          <div
            role="alert"
            className={cn(
              "rounded-lg border px-4 py-3 text-[13px]",
              flow.phase === "declined" || flow.phase === "failed"
                ? "border-error/40 bg-red-50 text-red-900"
                : "border-base-warning bg-warning-100 text-warning-800",
            )}
          >
            {flow.message}
            {flow.phase === "declined" && (
              <Button variant="link" className="ml-2 h-auto p-0" onClick={flow.chooseAnotherCard}>
                Try another card
              </Button>
            )}
          </div>
        )}

        <WizardFooter
          note={phaseNote(flow.phase)}
          back={
            flow.tenantGroupId
              ? undefined
              : { label: "Back to repositories", onClick: previousStep }
          }
          primary={
            <Button
              type="button"
              onClick={flow.run}
              disabled={flow.busy || envCount === 0 || preview.unpriced || !!quoteError}
            >
              {flow.busy ? busyLabel(flow.phase) : payLabel}
            </Button>
          }
        />
      </div>

      {flow.tenantGroupId && (
        <AddCardDialog
          tenantGroupId={flow.tenantGroupId}
          market={market}
          open={flow.phase === "needCard"}
          onOpenChange={(open) => {
            if (!open && flow.phase === "needCard") flow.cancelCard();
          }}
          onCompleted={flow.cardAdded}
        />
      )}
    </WizardShell>
  );
};

const CREATE_NOTE = {
  title: "What happens on create",
  body: "Your environments are provisioned, your repositories are connected, and the first period starts today.",
};

const Row = ({ label, value, strong }: { label: string; value: string; strong?: boolean }) => (
  <div className="flex justify-between">
    <dt className={strong ? "font-medium text-high-emphasis" : "text-medium-emphasis"}>{label}</dt>
    <dd className={cn("font-mono", strong && "font-medium")}>{value}</dd>
  </div>
);

const phaseNote = (phase: string) => {
  switch (phase) {
    case "creating":
      return "Creating the project…";
    case "pricing":
      return "Opening the order…";
    case "needCard":
      return "Add a card to continue. Nothing has been charged.";
    case "waitingForCard":
      return "Waiting for the card to be confirmed…";
    case "paying":
      return "Taking payment…";
    case "declined":
      return "Nothing was charged.";
    default:
      return "Nothing is charged until you press the button.";
  }
};

const busyLabel = (phase: string) =>
  phase === "creating" ? "Creating…" : phase === "paying" ? "Taking payment…" : "One moment…";
