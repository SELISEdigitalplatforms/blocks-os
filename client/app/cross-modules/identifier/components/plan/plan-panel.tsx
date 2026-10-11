import { useMemo, useState } from "react";
import { Link } from "react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui-kits/button/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui-kits/dialog/dialog";
import { AddCardDialog } from "@/pages/billing/add-card-dialog";
import { useCatalogue, useUsage } from "@blocks-identifier/hooks/use-catalogue";
import { useSubscription } from "@blocks-identifier/hooks/use-billing";
import { useProjectPurchase } from "@blocks-identifier/hooks/use-project-purchase";
import { billingService } from "@blocks-identifier/services/billing.service";
import { billingReasonMessage, billingRefusal } from "@blocks-identifier/models/billing.model";
import type {
  ICatalogueResponse,
  IEnvironmentUsage,
} from "@blocks-identifier/models/catalogue.model";
import { TopUpGroups } from "@blocks-identifier/components/top-up/top-up-groups";
import {
  environmentsByRank,
  formatMoney,
  freeTierEnvironment,
  topUpSelections,
} from "@/components/create-project/wizard-model";

const day = 24 * 3600 * 1000;
const shortDate = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : "";

/** The three meters closest to their limit, for the mini bars on an environment row. */
const hottest = (usage: IEnvironmentUsage | undefined) =>
  (usage?.services ?? [])
    .flatMap((s) => s.meters)
    .filter((m) => m.counts && m.included > 0)
    .sort((a, b) => b.percentUsed - a.percentUsed)
    .slice(0, 3);

interface PlanPanelProps {
  tenantGroupId: string;
  isOwner: boolean;
  /** Environments the project has a tenant for, disabled included (they cannot be bought again). */
  existingEnvironments: string[];
  /** Opened from the page's "New Environment" button. */
  adding: boolean;
  onAddingChange: (adding: boolean) => void;
}

/**
 * The console's plan: every environment the project pays for, how close each is to its limits,
 * and the two things an owner does with them — buy more (top-ups, a new environment, the free
 * tier's upgrade) or end one at the period boundary. Every purchase goes through checkout and
 * lands on the order page; nothing here charges without the server's quote on screen.
 */
export function PlanPanel({
  tenantGroupId,
  isOwner,
  existingEnvironments,
  adding,
  onAddingChange,
}: PlanPanelProps) {
  const queryClient = useQueryClient();
  const { data: catalogue } = useCatalogue();
  const { data: usage } = useUsage(tenantGroupId);
  const { data: subscription, isLoading } = useSubscription(tenantGroupId);
  const [selected, setSelected] = useState<string | null>(null);
  const [steps, setSteps] = useState<Record<string, Record<string, number>>>({});
  const [toAdd, setToAdd] = useState<string[]>([]);
  const [upgrade, setUpgrade] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ tone: "good" | "bad"; text: string } | null>(null);

  const free = catalogue ? freeTierEnvironment(catalogue) : null;
  const lines = useMemo(() => subscription?.lines ?? [], [subscription]);
  // One clock reading per mount: "resets in N days" doesn't need to tick.
  const [now] = useState(() => Date.now());
  const envLine = (env: string) =>
    lines.find((l) => l.environment === env && (l.kind ?? "environment") !== "topup" && !l.meter);
  const isFreeHeld = (env: string) => env === free && (envLine(env)?.amount ?? 0) === 0;

  const held = useMemo(() => {
    if (!catalogue) return [];
    const keys = new Set([
      ...existingEnvironments,
      ...lines.map((l) => l.environment),
      ...(usage?.environments ?? []).map((e) => e.environment),
    ]);
    return environmentsByRank(catalogue)
      .map(([key]) => key)
      .filter((key) => keys.has(key));
  }, [catalogue, existingEnvironments, lines, usage]);

  const focus = selected ?? held[0] ?? null;

  const selection = adding
    ? { environments: toAdd, topUps: [] }
    : {
        environments: [],
        topUps: focus
          ? topUpSelections({
              environments: [focus],
              devTier: "paid",
              topUps: { [focus]: steps[focus] ?? {} },
            })
          : [],
        upgradeFreeTier: !!focus && upgrade && isFreeHeld(focus),
      };
  const purchase = useProjectPurchase(tenantGroupId, selection);

  if (!catalogue || isLoading) {
    return (
      <section
        className="rounded-lg border border-border bg-card p-5 text-sm text-medium-emphasis"
        role="status"
      >
        Loading the plan…
      </section>
    );
  }

  const market = subscription?.market ?? catalogue.market;
  const nextCharge = subscription?.nextChargeAtUtc;
  const daysLeft = nextCharge
    ? Math.max(0, Math.ceil((new Date(nextCharge).getTime() - now) / day))
    : null;
  const pending = lines.filter((l) => l.pendingRemoval && !l.meter);
  const available = environmentsByRank(catalogue)
    .map(([key, view]) => ({ key, view }))
    .filter(({ key }) => !existingEnvironments.includes(key) && !held.includes(key));

  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: ["billing", "subscription", tenantGroupId] });

  const remove = async (env: string) => {
    setConfirmRemove(null);
    const response = await billingService.removeEnvironment(tenantGroupId, env).catch(() => null);
    const refusal = response ? billingRefusal(response) : "unknown";
    if (refusal) {
      setNotice({ tone: "bad", text: billingReasonMessage(refusal) });
      return;
    }
    setNotice({
      tone: "good",
      text: `${catalogue.environments[env]?.label ?? env} is scheduled to end on ${shortDate(response?.effectiveUtc)}. It keeps running until then; there is no refund for the remainder, and you can keep it until that day.`,
    });
    refresh();
  };

  const keep = async (env: string) => {
    const response = await billingService.keepEnvironment(tenantGroupId, env).catch(() => null);
    const refusal = response ? billingRefusal(response) : "unknown";
    setNotice(
      refusal
        ? { tone: "bad", text: billingReasonMessage(refusal) }
        : {
            tone: "good",
            text: `${catalogue.environments[env]?.label ?? env} stays. Nothing changes on the next bill.`,
          },
    );
    if (!refusal) refresh();
  };

  const focusView = focus ? catalogue.environments[focus] : undefined;
  const focusLine = focus ? envLine(focus) : undefined;
  const quote = purchase.quote;
  const dueNow = quote?.total ?? 0;
  const perPeriod = quote
    ? quote.lines.filter((l) => l.billing === "rent").reduce((s, l) => s + l.amount, 0)
    : 0;

  return (
    <section className="flex flex-col gap-4" aria-labelledby="plan-title">
      <div className="flex flex-wrap items-stretch gap-3">
        <h2
          id="plan-title"
          className="mr-auto self-center text-lg font-semibold text-high-emphasis"
        >
          Plan and top-ups
        </h2>
        {daysLeft !== null && (
          <div className="rounded-lg border border-border bg-card px-4 py-2">
            <div className="text-[10.5px] font-semibold uppercase tracking-wide text-low-emphasis">
              Period resets in
            </div>
            <div className="font-mono text-[16px]">{daysLeft} days</div>
          </div>
        )}
        {subscription && (
          <div className="rounded-lg border border-border bg-card px-4 py-2">
            <div className="text-[10.5px] font-semibold uppercase tracking-wide text-low-emphasis">
              Next charge{nextCharge ? `, ${shortDate(nextCharge)}` : ""}
            </div>
            <div className="font-mono text-[16px]">
              {formatMoney(market, subscription.monthlyTotal + subscription.carriedBalance)}
            </div>
            {subscription.carriedBalance > 0 && (
              <Link
                to={`/app/project/${tenantGroupId}/billing`}
                className="text-[11px] text-warning-800 underline"
              >
                includes {formatMoney(market, subscription.carriedBalance)} carried over
              </Link>
            )}
          </div>
        )}
      </div>

      {pending.map((line) => (
        <div
          key={`pending-${line.environment}`}
          className="flex flex-wrap items-center gap-3 rounded-lg border border-base-warning bg-warning-100 px-4 py-3 text-[13px] text-warning-800"
        >
          <span className="flex-1">
            <strong>{catalogue.environments[line.environment]?.label ?? line.environment}</strong>{" "}
            is removed on {shortDate(line.endsAtUtc)}. It keeps running until then and there is no
            refund for the remainder.
          </span>
          {isOwner && (
            <Button size="sm" variant="outline" onClick={() => keep(line.environment)}>
              Keep it
            </Button>
          )}
        </div>
      ))}

      {notice && (
        <div
          role="status"
          className={cn(
            "rounded-lg border px-4 py-3 text-[13px]",
            notice.tone === "good"
              ? "border-emerald-200 bg-emerald-50 text-emerald-900"
              : "border-red-200 bg-red-50 text-red-900",
          )}
        >
          {notice.text}
        </div>
      )}

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
        <div className="flex w-full flex-col gap-3 lg:w-[380px]">
          <div className="rounded-lg border border-border bg-card">
            <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
              <span className="text-[12.5px] font-semibold">This project</span>
              <span className="font-mono text-[11.5px] text-medium-emphasis">
                {held.length} environments
              </span>
            </div>
            <ul>
              {held.map((env) => {
                const view = catalogue.environments[env];
                const line = envLine(env);
                const envUsage = usage?.environments.find((e) => e.environment === env);
                const on = !adding && focus === env;
                return (
                  <li key={env} className="border-b border-border/60 last:border-0">
                    <button
                      type="button"
                      aria-pressed={on}
                      onClick={() => {
                        onAddingChange(false);
                        setSelected(env);
                        setUpgrade(false);
                      }}
                      className={cn(
                        "flex w-full flex-col gap-2 px-4 py-3 text-left",
                        on ? "bg-blocks-primary-25" : "hover:bg-accent",
                      )}
                    >
                      <span className="flex w-full items-center gap-2">
                        <span className="text-[13.5px] font-semibold">{view?.label ?? env}</span>
                        <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10.5px]">
                          {env}
                        </span>
                        {isFreeHeld(env) && (
                          <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-800">
                            Free tier
                          </span>
                        )}
                        {line?.pendingRemoval && (
                          <span className="rounded bg-warning-100 px-1.5 py-0.5 text-[10px] font-semibold text-warning-800">
                            ends {shortDate(line.endsAtUtc)}
                          </span>
                        )}
                        <span className="ml-auto font-mono text-[12.5px]">
                          {line
                            ? line.amount === 0
                              ? "Free"
                              : formatMoney(market, line.amount)
                            : "—"}
                        </span>
                      </span>
                      {hottest(envUsage).map((meter) => (
                        <span key={meter.meter} className="flex w-full items-center gap-2">
                          <span className="w-28 truncate text-[11px] text-medium-emphasis">
                            {meter.label}
                          </span>
                          <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                            <span
                              className={cn(
                                "block h-full rounded-full",
                                meter.percentUsed >= 90
                                  ? "bg-red-700"
                                  : meter.percentUsed >= 70
                                    ? "bg-amber-600"
                                    : "bg-primary",
                              )}
                              style={{ width: `${Math.min(100, meter.percentUsed)}%` }}
                            />
                          </span>
                          <span className="w-10 text-right font-mono text-[11px]">
                            {Math.round(meter.percentUsed)}%
                          </span>
                        </span>
                      ))}
                    </button>
                  </li>
                );
              })}
            </ul>
            {isOwner && (
              <button
                type="button"
                onClick={() => {
                  onAddingChange(true);
                  setToAdd([]);
                }}
                className="flex min-h-11 w-full items-center gap-2 border-t border-border px-4 text-[13px] font-medium text-primary hover:bg-accent"
              >
                <Plus size={15} aria-hidden="true" /> Add an environment
              </button>
            )}
          </div>

          {lines.length > 0 && (
            <div className="rounded-lg border border-border bg-card px-4 py-3">
              <div className="mb-2 text-[12.5px] font-semibold">
                Recurring, every {catalogue.usagePeriodDays} days
              </div>
              <ul className="flex flex-col gap-1">
                {lines.map((line, i) => (
                  <li
                    key={`${line.environment}-${line.meter}-${i}`}
                    className="flex justify-between gap-2 font-mono text-[11.5px]"
                  >
                    <span
                      className={cn(
                        "truncate",
                        line.pendingRemoval
                          ? "text-low-emphasis line-through"
                          : "text-medium-emphasis",
                      )}
                    >
                      {line.label}
                    </span>
                    <span>{line.amount === 0 ? "Free" : formatMoney(market, line.amount)}</span>
                  </li>
                ))}
              </ul>
              <div className="my-2 h-px bg-border" />
              <div className="flex justify-between text-[12.5px] font-semibold">
                <span>Total before VAT</span>
                <span className="font-mono">
                  {formatMoney(market, subscription?.monthlyBeforeTax ?? 0)}
                </span>
              </div>
            </div>
          )}
        </div>

        <div className="flex-1 rounded-lg border border-border bg-card p-5">
          {adding ? (
            <AddPane
              catalogue={catalogue}
              available={available.map((a) => a.key)}
              toAdd={toAdd}
              onToggle={(env) =>
                setToAdd((list) =>
                  list.includes(env) ? list.filter((e) => e !== env) : [...list, env],
                )
              }
              quoteLines={quote?.lines ?? []}
              renewal={nextCharge}
            />
          ) : focus && focusView ? (
            <div className="flex flex-col gap-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="text-[17px] font-semibold">
                    Top up {focusView.label}{" "}
                    <span className="ml-1 rounded bg-muted px-1.5 py-0.5 font-mono text-[10.5px]">
                      {focus}
                    </span>
                  </h3>
                  <p className="text-[12.5px] text-medium-emphasis">
                    One-off units are charged once and carry past the boundary. Recurring units are
                    added to each bill while you hold them.
                  </p>
                </div>
                {isOwner && isFreeHeld(focus) && (
                  <Button
                    size="sm"
                    variant={upgrade ? "default" : "outline"}
                    onClick={() => setUpgrade((u) => !u)}
                    aria-pressed={upgrade}
                  >
                    {upgrade ? "Upgrading to paid" : "Upgrade to paid"}
                  </Button>
                )}
                {isOwner && focusLine && focusLine.amount > 0 && !focusLine.pendingRemoval && (
                  <Button size="sm" variant="outline" onClick={() => setConfirmRemove(focus)}>
                    Remove at period end
                  </Button>
                )}
              </div>

              {isFreeHeld(focus) && !upgrade && catalogue.topUp.requiresPaidEnvironment ? (
                <p className="rounded-md bg-warning-100 px-3 py-2 text-[12.5px] text-warning-800">
                  Free development can&apos;t be topped up. Upgrade it to paid: limits go up at
                  once, with your current usage kept, and the rest of this period is charged now.
                </p>
              ) : (
                <TopUpGroups
                  catalogue={catalogue}
                  environment={focus}
                  devTier={isFreeHeld(focus) && !upgrade ? "free" : "paid"}
                  steps={steps[focus] ?? {}}
                  disabled={!isOwner}
                  onChange={(meter, count) =>
                    setSteps((all) => {
                      const mine = { ...(all[focus] ?? {}) };
                      if (count <= 0) delete mine[meter];
                      else mine[meter] = count;
                      return { ...all, [focus]: mine };
                    })
                  }
                />
              )}
            </div>
          ) : (
            <p className="text-[13px] text-medium-emphasis">
              This project has no environments yet.
            </p>
          )}

          {isOwner && (adding || focus) && (
            <div className="mt-5 flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-end sm:justify-between">
              <div className="flex gap-6">
                <div>
                  <div className="text-[10.5px] font-semibold uppercase tracking-wide text-low-emphasis">
                    {adding ? "Prorated, charged now" : "Due now"}
                  </div>
                  <div className="font-mono text-[18px] font-semibold">
                    {formatMoney(market, dueNow)}
                  </div>
                  <div className="text-[11px] text-low-emphasis">incl. VAT</div>
                </div>
                <div>
                  <div className="text-[10.5px] font-semibold uppercase tracking-wide text-low-emphasis">
                    Added to each bill
                  </div>
                  <div className="font-mono text-[18px] font-semibold">
                    {formatMoney(market, quote?.recurringMonthly ?? perPeriod)}
                  </div>
                  <div className="text-[11px] text-low-emphasis">before VAT</div>
                </div>
              </div>
              <div className="flex gap-2.5">
                {adding && (
                  <Button variant="outline" onClick={() => onAddingChange(false)}>
                    Cancel
                  </Button>
                )}
                <Button
                  onClick={purchase.buy}
                  disabled={purchase.busy || !quote || !!purchase.quoteError}
                >
                  {purchase.busy
                    ? purchase.phase === "paying"
                      ? "Taking payment…"
                      : "One moment…"
                    : adding
                      ? `Add ${toAdd.length || ""} ${toAdd.length === 1 ? "environment" : "environments"}`.replace(
                          "  ",
                          " ",
                        )
                      : quote && quote.total > 0
                        ? `Buy for ${formatMoney(market, quote.total)}`
                        : "Buy"}
                </Button>
              </div>
            </div>
          )}
          {purchase.quoteError && (
            <p className="mt-2 text-[12px] text-error">{purchase.quoteError}</p>
          )}
          {purchase.message && (
            <p role="alert" className="mt-2 text-[12.5px] text-red-900">
              {purchase.message}
              {purchase.phase === "declined" && (
                <Button
                  variant="link"
                  className="ml-2 h-auto p-0"
                  onClick={purchase.chooseAnotherCard}
                >
                  Try another card
                </Button>
              )}
            </p>
          )}
        </div>
      </div>

      <AddCardDialog
        tenantGroupId={tenantGroupId}
        market={market}
        open={purchase.phase === "needCard"}
        onOpenChange={(open) => {
          if (!open && purchase.phase === "needCard") purchase.cancelCard();
        }}
        onCompleted={purchase.cardAdded}
      />

      <Dialog open={!!confirmRemove} onOpenChange={(open) => !open && setConfirmRemove(null)}>
        <DialogContent className="w-[calc(100%-2rem)] sm:w-[460px]">
          <DialogHeader>
            <DialogTitle>
              Remove {confirmRemove ? catalogue.environments[confirmRemove]?.label : ""}?
            </DialogTitle>
            <DialogDescription>
              It keeps running until {shortDate(nextCharge)}, the end of this period, and is not
              charged after that. There is no refund for the days left. You can keep it until then.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmRemove(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={() => confirmRemove && remove(confirmRemove)}>
              Remove at period end
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}

interface AddPaneProps {
  catalogue: ICatalogueResponse;
  available: string[];
  toAdd: string[];
  onToggle: (env: string) => void;
  quoteLines: { environment: string; amount: number; kind: string }[];
  renewal?: string | null;
}

const AddPane = ({ catalogue, available, toAdd, onToggle, quoteLines, renewal }: AddPaneProps) => (
  <div className="flex flex-col gap-3">
    <div>
      <h3 className="text-[17px] font-semibold">Add an environment</h3>
      <p className="text-[12.5px] text-medium-emphasis">
        Charged for the rest of this period only
        {renewal ? `, then in full from ${shortDate(renewal)}` : ""}. It is live as soon as it is
        built.
      </p>
    </div>
    {available.length === 0 ? (
      <div className="rounded-md border border-border px-4 py-3">
        <div className="text-[13px] font-semibold">This project has every environment</div>
        <p className="text-[12px] text-medium-emphasis">
          To grow further, top up the meters on the ones you have.
        </p>
      </div>
    ) : (
      <ul className="flex flex-col gap-2">
        {available.map((env) => {
          const view = catalogue.environments[env];
          const prorated = quoteLines.find((l) => l.environment === env && l.kind !== "topup");
          return (
            <li key={env}>
              <label
                htmlFor={`add-${env}`}
                className={cn(
                  "flex min-h-11 cursor-pointer items-center gap-3 rounded-md border px-3 py-2.5",
                  toAdd.includes(env) ? "border-primary bg-blocks-primary-25" : "border-border",
                )}
              >
                <input
                  type="checkbox"
                  id={`add-${env}`}
                  checked={toAdd.includes(env)}
                  onChange={() => onToggle(env)}
                  className="h-[18px] w-[18px] accent-primary"
                />
                <span className="flex flex-1 items-center gap-2">
                  <span className="text-[13.5px] font-semibold">{view?.label ?? env}</span>
                  <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10.5px]">
                    {env}
                  </span>
                </span>
                <span className="text-right font-mono text-[12px]">
                  <span className="block">
                    {view?.price != null
                      ? `${formatMoney(catalogue.market, view.price)} / mo`
                      : "—"}
                  </span>
                  {prorated && (
                    <span className="block text-[11px] text-low-emphasis">
                      {formatMoney(catalogue.market, prorated.amount)} now
                    </span>
                  )}
                </span>
              </label>
            </li>
          );
        })}
      </ul>
    )}
  </div>
);
