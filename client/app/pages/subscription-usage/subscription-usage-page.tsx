import { useState } from "react";
import { Link, useParams, useSearchParams } from "react-router";
import { Plus, RefreshCw, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui-kits/button/button";
import { useCatalogue, useUsage } from "@blocks-identifier/hooks/use-catalogue";
import { useSubscription } from "@blocks-identifier/hooks/use-billing";
import type { IEnvironmentUsage, IMeterUsage } from "@blocks-identifier/models/catalogue.model";
import { formatLimit, freeTierEnvironment } from "@/components/create-project/wizard-model";

/**
 * What a project is using: a card per service, one column per environment, every meter.
 *
 * Read-only — buying more happens on the console's Environments tab. Nothing is pooled between
 * environments, so there is no total column. The pale part of a bar is bought units still unspent;
 * they carry past the boundary while the darker allowance resets.
 *
 * Everything comes from `/Usage`, which joins the project's rows with the published catalogue:
 * there is no list of services, meters or environments in this file.
 */

const day = 24 * 3600 * 1000;
const fmt = (n: number) => Math.round(n).toLocaleString("en-US");
const short = (n: number) =>
  n >= 1_000_000
    ? `${Math.round(n / 100_000) / 10}M`
    : n >= 1000
      ? `${Math.round(n / 100) / 10}k`
      : String(n);

type Cell = {
  text: string;
  note: string;
  tone: "ok" | "warm" | "hot" | "none";
  usedPct: number;
  boughtPct: number;
};

/** One meter in one environment, as the matrix shows it. Pure, so it is tested on its own. */
export const usageCell = (m: IMeterUsage | undefined, compact: boolean): Cell => {
  if (!m) return { text: "—", note: "", tone: "none", usedPct: 0, boughtPct: 0 };
  if (!m.counts) {
    return {
      text: m.included < 0 ? "Never stops" : formatLimit(m.included, m.unit),
      note: "setting",
      tone: "none",
      usedPct: 0,
      boughtPct: 0,
    };
  }
  if (m.included < 0) {
    return {
      text: `${fmt(m.used)} · no cap`,
      note: "uncapped",
      tone: "none",
      usedPct: 100,
      boughtPct: 0,
    };
  }
  const total = m.included + m.purchased;
  const pct =
    m.included > 0
      ? Math.min(999, Math.round((m.used * 1000) / m.included) / 10)
      : m.used > 0
        ? 100
        : 0;
  const tone = pct >= 90 ? "hot" : pct >= 70 ? "warm" : "ok";
  const usedPct = total > 0 ? Math.min(100, Math.round((m.used * 100) / total)) : 0;
  const boughtPct =
    total > 0 ? Math.max(0, Math.min(100 - usedPct, Math.round((m.purchased * 100) / total))) : 0;
  return {
    text: compact ? `${pct}%` : `${fmt(m.used)} / ${fmt(m.included)}`,
    note:
      m.purchased > 0
        ? `+${short(m.purchased)} bought`
        : compact
          ? `${short(m.used)} / ${short(m.included)}`
          : pct >= 90
            ? "hard stop in reach"
            : "",
    tone,
    usedPct,
    boughtPct,
  };
};

const TONE_BAR: Record<Cell["tone"], string> = {
  ok: "bg-primary",
  warm: "bg-amber-600",
  hot: "bg-red-700",
  none: "bg-muted-foreground/30",
};

const meterOf = (env: IEnvironmentUsage, service: string, meter: string) =>
  env.services.find((s) => s.service === service)?.meters.find((m) => m.meter === meter);

export function SubscriptionUsagePage() {
  const params = useParams();
  const [searchParams] = useSearchParams();
  const tenantGroupId = params.tenantGroupId ?? searchParams.get("tenantGroupId") ?? undefined;
  const { data: usage, loading, error, reload, sync } = useUsage(tenantGroupId);
  const { data: catalogue } = useCatalogue();
  const { data: subscription } = useSubscription(tenantGroupId);
  const [phoneEnv, setPhoneEnv] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  // One clock reading per mount: "resets in N days" doesn't need to tick.
  const [now] = useState(() => Date.now());

  if (!tenantGroupId) {
    return (
      <Shell>
        <p className="text-sm font-medium">No project selected</p>
      </Shell>
    );
  }
  if (loading && !usage) {
    return (
      <Shell>
        <p className="text-sm text-medium-emphasis" role="status">
          Loading usage…
        </p>
      </Shell>
    );
  }
  if (error || !usage) {
    return (
      <Shell>
        <div className="flex flex-col items-start gap-3 rounded-lg border border-border bg-card p-6">
          <p className="text-sm font-medium">Usage could not be loaded</p>
          {error?.message && <p className="text-[12.5px] text-medium-emphasis">{error.message}</p>}
          <Button variant="outline" onClick={reload}>
            Try again
          </Button>
        </div>
      </Shell>
    );
  }

  const rank = (env: string) => catalogue?.environments[env]?.rank ?? 99;
  const envs = [...usage.environments].sort((a, b) => rank(a.environment) - rank(b.environment));
  if (envs.length === 0) {
    return (
      <Shell>
        <div className="rounded-lg border border-border bg-card p-6 text-sm">
          This project has no environments yet.{" "}
          <Link
            className="text-primary underline"
            to={`/app/project/${tenantGroupId}/environments`}
          >
            Add one
          </Link>
        </div>
      </Shell>
    );
  }

  const free = catalogue ? freeTierEnvironment(catalogue) : null;
  const runsFree = (env: string) => {
    if (env !== free) return false;
    const line = subscription?.lines.find((l) => l.environment === env && !l.meter);
    return !line || line.amount === 0;
  };
  const label = (env: string) => catalogue?.environments[env]?.label ?? env;
  const compact = envs.length > 4;
  const unseeded = envs.filter((e) => e.notYetSeeded.length > 0);
  const nextCharge = subscription?.nextChargeAtUtc;
  const daysLeft = nextCharge
    ? Math.max(0, Math.ceil((new Date(nextCharge).getTime() - now) / day))
    : null;
  const shown = phoneEnv ?? envs[0].environment;

  // Every service and meter any environment reports, in the order the server sends them.
  const services: {
    service: string;
    label: string;
    meters: { meter: string; label: string; kind: string }[];
  }[] = [];
  for (const env of envs) {
    for (const svc of env.services) {
      let entry = services.find((s) => s.service === svc.service);
      if (!entry) services.push((entry = { service: svc.service, label: svc.label, meters: [] }));
      for (const m of svc.meters) {
        if (!entry.meters.some((x) => x.meter === m.meter))
          entry.meters.push({ meter: m.meter, label: m.label, kind: m.kind });
      }
    }
  }

  // The one counter closest to its hard stop, worth saying out loud.
  const hottest = envs
    .flatMap((env) =>
      env.services.flatMap((s) =>
        s.meters
          .filter((m) => m.counts && m.included > 0 && m.kind === "counter")
          .map((m) => ({ env: env.environment, m })),
      ),
    )
    .sort((a, b) => b.m.percentUsed - a.m.percentUsed)[0];

  const runSync = async () => {
    setSyncing(true);
    setSyncError(null);
    try {
      for (const env of unseeded)
        await sync(env.tenantId, env.environment, env.periodKey, runsFree(env.environment));
    } catch (caught) {
      setSyncError((caught as Error)?.message || "The sync did not finish.");
    } finally {
      setSyncing(false);
    }
  };

  return (
    <Shell>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-high-emphasis">Usage</h1>
          <p className="text-[13px] text-medium-emphasis">
            Every meter, in every environment. Nothing is pooled between them.
          </p>
        </div>
        <div className="flex items-stretch gap-2.5">
          {daysLeft !== null && (
            <div className="rounded-lg border border-border bg-card px-4 py-2">
              <div className="text-[10.5px] font-semibold uppercase tracking-wide text-low-emphasis">
                Allowance resets in
              </div>
              <div className="font-mono text-[17px]">{daysLeft} days</div>
            </div>
          )}
          <Button asChild className="h-auto">
            <Link to={`/app/project/${tenantGroupId}/environments`}>
              <Plus className="mr-1.5 h-4 w-4" aria-hidden="true" /> Top up
            </Link>
          </Button>
        </div>
      </div>

      {hottest && hottest.m.percentUsed >= 80 && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-amber-300 bg-card px-4 py-3">
          <TriangleAlert className="h-5 w-5 text-amber-700" aria-hidden="true" />
          <div className="flex-1 text-[13px]">
            <div className="font-semibold">
              {label(hottest.env)} has {fmt(Math.max(0, hottest.m.included - hottest.m.used))}{" "}
              {hottest.m.label.toLowerCase()} of its allowance left
              {daysLeft !== null ? `, with ${daysLeft} days to go` : ""}
            </div>
            <div className="text-[12.5px] text-medium-emphasis">
              {hottest.m.purchased > 0
                ? `${fmt(hottest.m.purchased)} bought units take over once the allowance runs out, and what is left of them carries past the boundary.`
                : "Every limit is a hard stop: when it runs out, calls are refused until you buy more or the period resets."}
            </div>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link to={`/app/project/${tenantGroupId}/environments`}>Buy more</Link>
          </Button>
        </div>
      )}

      {unseeded.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-base-warning bg-warning-100 px-4 py-3 text-[13px] text-warning-800">
          <span className="flex-1">
            {unseeded.map((e) => label(e.environment)).join(", ")}{" "}
            {unseeded.length === 1 ? "has" : "have"} meters with no limit row yet. Sync to apply the
            published catalogue.
          </span>
          <Button size="sm" variant="outline" onClick={runSync} disabled={syncing}>
            <RefreshCw
              className={cn("mr-1.5 h-3.5 w-3.5", syncing && "animate-spin")}
              aria-hidden="true"
            />
            {syncing ? "Syncing…" : "Sync with catalogue"}
          </Button>
          {syncError && <span className="w-full text-red-900">{syncError}</span>}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-4 rounded-lg border border-border bg-card px-4 py-2.5 text-[11.5px] text-medium-emphasis">
        <span className="text-[10.5px] font-semibold uppercase tracking-wide text-low-emphasis">
          Reading the bars
        </span>
        <Legend className="bg-primary" text="used this period" />
        <Legend
          className="bg-blocks-primary-300"
          text="bought, unspent — carries past the boundary"
        />
        <Legend className="bg-red-700" text="at or near the hard stop" />
      </div>

      {/* Phone: one environment at a time behind a chip row. */}
      <div className="flex gap-2 overflow-x-auto md:hidden" role="tablist" aria-label="Environment">
        {envs.map((env) => (
          <button
            key={env.environment}
            type="button"
            role="tab"
            aria-selected={shown === env.environment}
            onClick={() => setPhoneEnv(env.environment)}
            className={cn(
              "min-h-11 shrink-0 rounded-full border px-4 font-mono text-[12px]",
              shown === env.environment
                ? "border-primary bg-blocks-primary-25 text-blocks-primary-700"
                : "border-border",
            )}
          >
            {env.environment}
          </button>
        ))}
      </div>

      <div className="hidden items-center px-4 md:flex">
        <div className="w-[200px] shrink-0 text-[10.5px] font-semibold uppercase tracking-wide text-low-emphasis">
          Meter
        </div>
        {envs.map((env) => (
          <div key={env.environment} className="flex flex-1 basis-0 items-center gap-1.5">
            <span className="font-mono text-[11.5px] font-medium">{env.environment}</span>
            {runsFree(env.environment) && (
              <span className="rounded bg-emerald-50 px-1.5 text-[9.5px] font-semibold text-emerald-800">
                Free
              </span>
            )}
          </div>
        ))}
      </div>

      {services.map((svc) => {
        const peak = envs
          .flatMap((env) =>
            svc.meters.map((m) => ({
              env: env.environment,
              m: meterOf(env, svc.service, m.meter),
            })),
          )
          .filter((x) => x.m?.counts && (x.m?.included ?? 0) > 0)
          .sort((a, b) => (b.m?.percentUsed ?? 0) - (a.m?.percentUsed ?? 0))[0];
        return (
          <section
            key={svc.service}
            className="overflow-hidden rounded-lg border border-border bg-card"
            aria-label={svc.label}
          >
            <div className="flex items-center gap-2.5 border-b border-border bg-muted/30 px-4 py-2.5">
              <span className="text-[13.5px] font-semibold">{svc.label}</span>
              <span className="text-[12px] text-low-emphasis">
                {svc.meters.length} {svc.meters.length === 1 ? "meter" : "meters"}
              </span>
              <span
                className={cn(
                  "ml-auto rounded-full px-2.5 py-0.5 font-mono text-[11px]",
                  peak && (peak.m?.percentUsed ?? 0) >= 70
                    ? "bg-amber-50 text-amber-800"
                    : "bg-muted text-medium-emphasis",
                )}
              >
                {peak
                  ? `peak ${Math.round(peak.m?.percentUsed ?? 0)}% in ${peak.env}`
                  : "settings only"}
              </span>
            </div>
            {svc.meters.map((meter) => (
              <div
                key={meter.meter}
                className="flex flex-col gap-2 border-b border-border/50 px-4 py-3 last:border-0 md:flex-row md:items-start"
              >
                <div className="w-full shrink-0 md:w-[200px] md:pr-3">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[12.5px] font-medium">{meter.label}</span>
                    <span className="rounded bg-muted px-1.5 text-[9.5px] text-medium-emphasis">
                      {meter.kind}
                    </span>
                  </div>
                  <div className="font-mono text-[10px] text-low-emphasis">{meter.meter}</div>
                </div>
                {envs.map((env) => {
                  const cell = usageCell(meterOf(env, svc.service, meter.meter), compact);
                  return (
                    <div
                      key={env.environment}
                      className={cn(
                        "flex-1 basis-0 md:pr-2.5",
                        env.environment !== shown && "hidden md:block",
                      )}
                    >
                      <div
                        className={cn(
                          "mb-1 font-mono text-[11.5px]",
                          cell.tone === "hot"
                            ? "font-medium text-red-700"
                            : cell.tone === "warm"
                              ? "font-medium text-amber-800"
                              : "",
                        )}
                      >
                        {cell.text}
                      </div>
                      {cell.text !== "—" && cell.note !== "setting" && (
                        <div
                          className="flex h-1.5 overflow-hidden rounded-full bg-muted"
                          aria-hidden="true"
                        >
                          <span
                            className={TONE_BAR[cell.tone]}
                            style={{ width: `${cell.usedPct}%` }}
                          />
                          {cell.boughtPct > 0 && (
                            <span
                              className="bg-blocks-primary-300"
                              style={{ width: `${cell.boughtPct}%` }}
                            />
                          )}
                        </div>
                      )}
                      <div
                        className={cn(
                          "mt-0.5 font-mono text-[10px]",
                          cell.tone === "hot" ? "text-red-700" : "text-low-emphasis",
                        )}
                      >
                        {cell.note}
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </section>
        );
      })}

      <p className="text-[12px] text-medium-emphasis">
        All meters across all {envs.length} environments. Nothing is pooled and nothing moves
        between environments.
      </p>
    </Shell>
  );
}

const Shell = ({ children }: { children: React.ReactNode }) => (
  <div className="flex flex-col gap-3.5 p-4 md:p-6">{children}</div>
);

const Legend = ({ className, text }: { className: string; text: string }) => (
  <span className="flex items-center gap-1.5">
    <span className={cn("block h-1.5 w-5 rounded-full", className)} />
    {text}
  </span>
);
