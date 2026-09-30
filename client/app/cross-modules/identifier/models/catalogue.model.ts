/**
 * The catalogue as blocks-os serves it.
 *
 * Nothing in here names a meter, a service or an environment. The screens render whatever comes
 * back, so a meter added to the published catalogue appears in the create flow, the limits panel
 * and the top-up grid without a change on this side.
 */

/** counter · resource · policy today. A kind this build has not seen is rendered, not dropped. */
export type MeterKind = string;

export interface IMeterDefinition {
  label: string;
  unit: string;
  scope: string;
  kind: MeterKind;
  reset: string;
  /** Decimals the meter carries. 0 for whole units, 2 on the credit meters. */
  scale?: number;
  purchasable?: boolean;
}

export interface IServiceDefinition {
  label: string;
  meters: Record<string, IMeterDefinition>;
}

export interface IEnvironmentView {
  label: string;
  rank: number;
  freeTierAvailable: boolean;
  /** Production alone: nothing above it to move up to. */
  topUpUncapped: boolean;
  price?: number | null;
  freePrice?: number | null;
  /** Keyed by `service.meter`. -1 means uncapped. */
  limits: Record<string, number>;
  freeLimits?: Record<string, number> | null;
}

export interface ITopUpStepView {
  /** Units one step buys. */
  step: number;
  /** `oneOffCarries` — bought once, carries past the boundary. `recurringWhileHeld` — every period. */
  billing: string;
  price?: number | null;
}

export interface ITopUpDefaults {
  requiresPaidEnvironment: boolean;
  maxMultipleOfIncluded: number;
  roundDownToWholeStep: boolean;
  counterUnitsCarry: boolean;
  drainOrder: string[];
  resourceUnitsRecurring: boolean;
  resourceDecreaseAt: string;
}

export interface ICatalogueResponse {
  catalogueVersion: string;
  priceBookVersion: string;
  market: string;
  markets: string[];
  usagePeriodDays: number;
  topUp: ITopUpDefaults;
  services: Record<string, IServiceDefinition>;
  environments: Record<string, IEnvironmentView>;
  topUpSteps: Record<string, ITopUpStepView>;
  /** Anything wrong with the published catalogue. Empty is the healthy case. */
  problems: string[];
}

// ─── Usage ────────────────────────────────────────────────────────────────────

export interface IMeterUsage {
  meter: string;
  label: string;
  unit: string;
  kind: MeterKind;
  /** False for a setting rather than a quota — render it as a value, not a bar. */
  counts: boolean;
  included: number;
  /** Bought outright. Carries past the boundary while the allowance resets. */
  purchased: number;
  used: number;
  remaining: number;
  percentUsed: number;
  enforcement: string;
  /** False when a row exists for something the current catalogue no longer defines. */
  inCatalogue: boolean;
}

export interface IServiceUsage {
  service: string;
  label: string;
  meters: IMeterUsage[];
}

export interface IEnvironmentUsage {
  tenantId: string;
  environment: string;
  periodKey: string;
  catalogueVersion: string;
  services: IServiceUsage[];
  /** Meters the catalogue has that this environment has no row for — run a sync. */
  notYetSeeded: string[];
}

/** A project's usage: one block per environment in its group. Nothing is pooled across them. */
export interface IProjectUsage {
  tenantGroupId: string;
  catalogueVersion: string;
  environments: IEnvironmentUsage[];
}

export interface IProjectUsageResponse {
  usage: IProjectUsage;
}

export interface ISyncUsagePayload {
  /** The project. Also what authorises the call. */
  tenantGroupId: string;
  /** Which environment of that project, checked against the group's own tenants. */
  tenantId: string;
  environment: string;
  periodKey: string;
  freeTier?: boolean;
}

export interface ISyncUsageResponse {
  added: number;
  updated: number;
  unchanged: number;
}
