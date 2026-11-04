export interface ISignupLinkSummaryPayload {
  configurationId: string;
  fromUtc?: string;
  toUtc?: string;
}

export interface ISignupLinkNeverUsedBreakdown {
  active: number;
  expired: number;
  revoked: number;
}

export interface ISignupLinkSummary {
  configurationId: string;
  configurationName: string | null;
  fromUtc: string;
  toUtc: string;
  totalGenerated: number;
  used: number;
  neverUsed: number;
  neverUsedBreakdown: ISignupLinkNeverUsedBreakdown;
  rejectedAttempts: number;
}
