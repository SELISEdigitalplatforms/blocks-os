/**
 * Guided custom-domain setup, as served by `Domain/SetupGuide` and streamed by
 * `Domain/ConfigureStream`. Every record value and URL is built on the server, so nothing
 * here knows the platform's CNAME label, target or default API host.
 */

export interface IDnsRecordInstruction {
  /** "app" for the site host, "api" for the Blocks API host under it. */
  purpose: "app" | "api";
  /** "CNAME", or "A" on an apex host ("ALIAS" when the target's IP could not be resolved). */
  type: string;
  /** Relative to the DNS zone, as most providers want it ("@" for the root). */
  name: string;
  /** The fully qualified host the record creates. */
  host: string;
  value: string;
}

export interface IDomainSetupGuideItem {
  /** Exactly as stored on the project, so it matches `IDomain.domain`. */
  domain: string;
  cookieDomain: string;
  isDomainVerified: boolean;
  isPlatformDomain: boolean;
  isApex: boolean;
  apiBaseUrl: string;
  records: IDnsRecordInstruction[];
}

export interface IDomainSetupGuideResponse {
  isSuccess: boolean;
  errors: Record<string, string> | null;
  applications: IDomainSetupGuideItem[];
}

export type DomainSetupStepId = "app_dns" | "api_dns" | "ssl";

export type DomainSetupStepStatus = "running" | "done" | "failed";

/** One `step` event of the setup stream. */
export interface IDomainSetupProgress {
  step: DomainSetupStepId;
  status: DomainSetupStepStatus;
  host?: string | null;
  message?: string | null;
}

/** The closing `result` event of the setup stream. */
export interface IDomainSetupResult {
  isSuccess: boolean;
  errors?: Record<string, string> | null;
}
