import type {
  ICatalogueResponse,
  IEnvironmentView,
  IMeterDefinition,
} from "@blocks-identifier/models/catalogue.model";
import type { ITopUpSelection } from "@blocks-identifier/models/billing.model";

/**
 * The create-project wizard's arithmetic, kept out of the screens so it can be tested on its own.
 *
 * Everything here reads the published catalogue. No environment, meter or price is named, so a
 * catalogue change reaches the wizard without a release. The figures shown before the project
 * exists are a preview; the server's quote is what is charged.
 */

/** The environment whose first instance may be taken on the free tier. Read from the catalogue. */
export const freeTierEnvironment = (catalogue: ICatalogueResponse): string | null =>
  Object.entries(catalogue.environments).find(([, env]) => env.freeTierAvailable)?.[0] ?? null;

export type DevTier = "free" | "paid";

/** steps per meter, per environment: `{ prod: { "api.calls": 2 } }` */
export type TopUpSteps = Record<string, Record<string, number>>;

export interface WizardSelection {
  /** Environment keys, in catalogue rank order. */
  environments: string[];
  devTier: DevTier;
  topUps: TopUpSteps;
}

export interface MeterRow {
  id: string;
  service: string;
  label: string;
  unit: string;
  kind: string;
  meter: IMeterDefinition;
}

/** Every meter in the catalogue, in service order, as `service.meter` rows. */
export const meterRows = (catalogue: ICatalogueResponse): MeterRow[] =>
  Object.entries(catalogue.services).flatMap(([service, def]) =>
    Object.entries(def.meters).map(([key, meter]) => ({
      id: `${service}.${key}`,
      service,
      label: meter.label,
      unit: meter.unit,
      kind: meter.kind,
      meter,
    })),
  );

export const environmentsByRank = (catalogue: ICatalogueResponse): [string, IEnvironmentView][] =>
  Object.entries(catalogue.environments).sort(([, a], [, b]) => a.rank - b.rank);

export const isFreeTier = (catalogue: ICatalogueResponse, env: string, devTier: DevTier) =>
  devTier === "free" && freeTierEnvironment(catalogue) === env;

/** The limits an environment would get with this tier choice. */
export const limitsFor = (
  catalogue: ICatalogueResponse,
  env: string,
  devTier: DevTier,
): Record<string, number> => {
  const view = catalogue.environments[env];
  if (!view) return {};
  return isFreeTier(catalogue, env, devTier) && view.freeLimits ? view.freeLimits : view.limits;
};

/** Monthly price of an environment with this tier choice. Null when the price book has none. */
export const environmentPrice = (
  catalogue: ICatalogueResponse,
  env: string,
  devTier: DevTier,
): number | null => {
  const view = catalogue.environments[env];
  if (!view) return null;
  if (isFreeTier(catalogue, env, devTier)) return view.freePrice ?? 0;
  return view.price ?? null;
};

export const isRecurringTopUp = (billing: string | undefined) => billing === "recurringWhileHeld";

/**
 * How many steps of a meter an environment may buy.
 *
 * Zero when the meter cannot be bought, when the environment is on the free tier (the catalogue's
 * `requiresPaidEnvironment`), or when it includes nothing of that meter. Production-style
 * environments (`topUpUncapped`) have no ceiling.
 */
export const maxSteps = (
  catalogue: ICatalogueResponse,
  env: string,
  meterId: string,
  devTier: DevTier,
): number => {
  const step = catalogue.topUpSteps[meterId];
  const view = catalogue.environments[env];
  if (!step || !view || step.step <= 0) return 0;
  if (catalogue.topUp.requiresPaidEnvironment && isFreeTier(catalogue, env, devTier)) return 0;
  if (view.topUpUncapped) return Number.POSITIVE_INFINITY;
  const included = limitsFor(catalogue, env, devTier)[meterId] ?? 0;
  if (included <= 0) return 0;
  const room = included * catalogue.topUp.maxMultipleOfIncluded - included;
  return Math.max(0, Math.floor(room / step.step));
};

/** The selection's top-ups as the checkout API takes them. Zero-step and unselected envs dropped. */
export const topUpSelections = (selection: WizardSelection): ITopUpSelection[] =>
  Object.entries(selection.topUps).flatMap(([environment, meters]) =>
    selection.environments.includes(environment)
      ? Object.entries(meters)
          .filter(([, steps]) => steps > 0)
          .map(([meter, steps]) => ({ environment, meter, steps }))
      : [],
  );

export interface PreviewLine {
  environment: string;
  label: string;
  amount: number;
  billing: "rent" | "once";
}

export interface Preview {
  lines: PreviewLine[];
  recurring: number;
  oneOff: number;
  subtotal: number;
  vat: number;
  dueToday: number;
  monthlyGross: number;
  /** True when a selected environment or step has no price in this market. */
  unpriced: boolean;
}

/** Same rate the server applies (`CheckoutService` VAT). Only used for the preview. */
export const PREVIEW_VAT_RATE = 0.081;

const round2 = (n: number) => Math.round(n * 100) / 100;

/** A client-side preview of what checkout will charge, for the wizard's running total. */
export const previewOrder = (
  catalogue: ICatalogueResponse,
  selection: WizardSelection,
): Preview => {
  const lines: PreviewLine[] = [];
  let unpriced = false;

  for (const env of selection.environments) {
    const price = environmentPrice(catalogue, env, selection.devTier);
    if (price === null) unpriced = true;
    lines.push({
      environment: env,
      label: catalogue.environments[env]?.label ?? env,
      amount: price ?? 0,
      billing: "rent",
    });
  }

  for (const topUp of topUpSelections(selection)) {
    const step = catalogue.topUpSteps[topUp.meter];
    if (step?.price == null) unpriced = true;
    lines.push({
      environment: topUp.environment,
      label: meterLabel(catalogue, topUp.meter),
      amount: (step?.price ?? 0) * topUp.steps,
      billing: isRecurringTopUp(step?.billing) ? "rent" : "once",
    });
  }

  const recurring = round2(
    lines.filter((l) => l.billing === "rent").reduce((s, l) => s + l.amount, 0),
  );
  const oneOff = round2(
    lines.filter((l) => l.billing === "once").reduce((s, l) => s + l.amount, 0),
  );
  const subtotal = round2(recurring + oneOff);
  const vat = round2(subtotal * PREVIEW_VAT_RATE);
  return {
    lines,
    recurring,
    oneOff,
    subtotal,
    vat,
    dueToday: round2(subtotal + vat),
    monthlyGross: round2(recurring * (1 + PREVIEW_VAT_RATE)),
    unpriced,
  };
};

export const meterLabel = (catalogue: ICatalogueResponse, meterId: string): string => {
  const [service, key] = meterId.split(".");
  return catalogue.services[service]?.meters[key]?.label ?? meterId;
};

/** The meter that counts repository slots. Only used when the catalogue publishes it. */
export const REPOS_METER = "release.repos";

/** Repository slots an environment has: its included `release.repos` plus bought steps. -1 = no cap. */
export const repoSlots = (
  catalogue: ICatalogueResponse,
  env: string,
  selection: Pick<WizardSelection, "devTier" | "topUps">,
): number => {
  const included = limitsFor(catalogue, env, selection.devTier)[REPOS_METER];
  if (included === undefined || included < 0) return -1;
  const bought =
    (selection.topUps[env]?.[REPOS_METER] ?? 0) * (catalogue.topUpSteps[REPOS_METER]?.step ?? 0);
  return included + bought;
};

/** The branch an environment deploys. Production deploys main; the rest deploy their own name. */
export const branchFor = (env: string) => (env === "prod" ? "main" : env);

/** repository key → environments it deploys to. */
export type Deployments = Record<string, string[]>;

export const deploymentCount = (deployments: Deployments, env: string) =>
  Object.values(deployments).filter((envs) => envs.includes(env)).length;

/** Environments whose repository slots are all used. */
export const fullEnvironments = (
  catalogue: ICatalogueResponse,
  selection: WizardSelection,
  deployments: Deployments,
): string[] =>
  selection.environments.filter((env) => {
    const slots = repoSlots(catalogue, env, selection);
    return slots >= 0 && deploymentCount(deployments, env) >= slots;
  });

/**
 * Drops picks that no longer fit: environments that were unticked, and picks beyond an
 * environment's slots after a tier change (latest-added repositories lose first).
 */
export const reconcileDeployments = (
  catalogue: ICatalogueResponse,
  selection: WizardSelection,
  deployments: Deployments,
  repositoryOrder: string[],
): Deployments => {
  const used: Record<string, number> = {};
  const next: Deployments = {};
  for (const repo of repositoryOrder) {
    next[repo] = (deployments[repo] ?? []).filter((env) => {
      if (!selection.environments.includes(env)) return false;
      const slots = repoSlots(catalogue, env, selection);
      if (slots >= 0 && (used[env] ?? 0) >= slots) return false;
      used[env] = (used[env] ?? 0) + 1;
      return true;
    });
  }
  return next;
};

/** Lowercase, dash-separated identifier preview of a project name. */
export const projectSlug = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "untitled";

export const formatMoney = (market: string | null | undefined, amount: number) =>
  `${market ?? ""} ${amount.toLocaleString("en-US", {
    minimumFractionDigits: Number.isInteger(amount) ? 0 : 2,
    maximumFractionDigits: 2,
  })}`.trim();

/** Units that are measures rather than the thing counted get a suffix; "call", "repo" do not. */
const UNIT_SUFFIX: Record<string, string> = { MB: "MB", minute: "min" };

export const formatLimit = (value: number | undefined, unit?: string) => {
  if (value === undefined) return "—";
  if (value < 0) return "Unlimited";
  if (value === 0) return "Not included";
  const suffix = unit ? UNIT_SUFFIX[unit] : undefined;
  return `${value.toLocaleString("en-US")}${suffix ? ` ${suffix}` : ""}`;
};
