// ─── Captcha endpoints (captcha.service) ────────────────────────────────────

const BASE = "/api/captcha";

export const CAPTCHA_ENDPOINTS = {
  SAVE: `${BASE}/save`,
  GET: `${BASE}/get`,
  DELETE: `${BASE}/delete`,
} as const;
