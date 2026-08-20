// ─── Captcha endpoints (captcha.service) ────────────────────────────────────

const BASE = "/api/captcha";

export const CAPTCHA_ENDPOINTS = {
  SAVE: `${BASE}/save`,
  LIST: `${BASE}/list`,
  GET: (id: string) => `${BASE}/get/${id}`,
  DELETE: (id: string) => `${BASE}/delete/${id}`,
} as const;
