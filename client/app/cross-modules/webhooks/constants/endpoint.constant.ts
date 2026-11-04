const WEBHOOKS_SUBPATH = "/Webhooks";

export const WEBHOOKS_ENDPOINTS = {
  GETS: `/api${WEBHOOKS_SUBPATH}/Gets`,
  GET: `/api${WEBHOOKS_SUBPATH}/Get`,
  SAVE: `/api${WEBHOOKS_SUBPATH}/Save`,
  DELETE: `/api${WEBHOOKS_SUBPATH}/Delete`,
  TEST: `/api${WEBHOOKS_SUBPATH}/Test`,
  DELIVERIES: `/api${WEBHOOKS_SUBPATH}/Deliveries`,
  RESEND: `/api${WEBHOOKS_SUBPATH}/Resend`,
} as const;
