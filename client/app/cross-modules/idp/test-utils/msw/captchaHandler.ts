import { http, HttpResponse, type JsonBodyType } from "msw";
import { mockCaptchaConfig, mockCaptchaConfigList } from "../__mocks__/captcha.data.mock";
import { CAPTCHA_ENDPOINTS } from "../../captcha/constants/endpoint.constant";

// ─── Endpoint Patterns ────────────────────────────────────────────────────────

const CAPTCHA_BASE = CAPTCHA_ENDPOINTS.SAVE.replace(/\/save$/, "");

const GET_CAPTCHA_CONFIG_PATTERN = new RegExp(`${CAPTCHA_BASE}/get/[^/]+$`);
const LIST_CAPTCHA_CONFIG_PATTERN = new RegExp(`${CAPTCHA_ENDPOINTS.LIST}$`);
const SAVE_CAPTCHA_PATTERN = new RegExp(CAPTCHA_ENDPOINTS.SAVE);
const DELETE_CAPTCHA_PATTERN = new RegExp(`${CAPTCHA_BASE}/delete/[^/]+$`);

// ─── Default Handlers (happy-path) ───────────────────────────────────────────

export const captchaHandlers = [
  http.get(GET_CAPTCHA_CONFIG_PATTERN, () => HttpResponse.json(mockCaptchaConfig)),
  http.get(LIST_CAPTCHA_CONFIG_PATTERN, () => HttpResponse.json(mockCaptchaConfigList)),
  http.post(SAVE_CAPTCHA_PATTERN, () => HttpResponse.json(mockCaptchaConfig)),
  http.delete(DELETE_CAPTCHA_PATTERN, () => HttpResponse.json({ isSuccess: true })),
];

// ─── Per-Test Override Factories ──────────────────────────────────────────────

export const getCaptchaConfigHandler = (response: JsonBodyType = mockCaptchaConfig) =>
  http.get(GET_CAPTCHA_CONFIG_PATTERN, () => HttpResponse.json(response));

export const getCaptchaConfigListHandler = (response: JsonBodyType = mockCaptchaConfigList) =>
  http.get(LIST_CAPTCHA_CONFIG_PATTERN, () => HttpResponse.json(response));

export const getCaptchaConfigNotFoundHandler = () =>
  http.get(GET_CAPTCHA_CONFIG_PATTERN, () =>
    HttpResponse.json({ isSuccess: false, errors: { not_found: "No captcha configuration." } }, { status: 404 }),
  );

export const getCaptchaConfigErrorHandler = (status = 500) =>
  http.get(GET_CAPTCHA_CONFIG_PATTERN, () =>
    HttpResponse.json({ message: "Internal server error" }, { status }),
  );

export const saveCaptchaHandler = (response: JsonBodyType = mockCaptchaConfig) =>
  http.post(SAVE_CAPTCHA_PATTERN, () => HttpResponse.json(response));

export const saveCaptchaErrorHandler = (status = 500) =>
  http.post(SAVE_CAPTCHA_PATTERN, () =>
    HttpResponse.json({ message: "Internal server error" }, { status }),
  );
