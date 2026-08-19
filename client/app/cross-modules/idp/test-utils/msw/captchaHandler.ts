import { http, HttpResponse, type JsonBodyType } from "msw";
import { mockCaptchaConfig } from "../__mocks__/captcha.data.mock";
import { CAPTCHA_ENDPOINTS } from "../../captcha/constants/endpoint.constant";

// ─── Endpoint Patterns ────────────────────────────────────────────────────────

const GET_CAPTCHA_CONFIG_PATTERN = new RegExp(`${CAPTCHA_ENDPOINTS.GET}$`);
const SAVE_CAPTCHA_PATTERN = new RegExp(CAPTCHA_ENDPOINTS.SAVE);
const DELETE_CAPTCHA_PATTERN = new RegExp(CAPTCHA_ENDPOINTS.DELETE);

// ─── Default Handlers (happy-path) ───────────────────────────────────────────

export const captchaHandlers = [
  http.get(GET_CAPTCHA_CONFIG_PATTERN, () => HttpResponse.json(mockCaptchaConfig)),
  http.post(SAVE_CAPTCHA_PATTERN, () => HttpResponse.json(mockCaptchaConfig)),
  http.delete(DELETE_CAPTCHA_PATTERN, () => HttpResponse.json({ isSuccess: true })),
];

// ─── Per-Test Override Factories ──────────────────────────────────────────────

export const getCaptchaConfigHandler = (response: JsonBodyType = mockCaptchaConfig) =>
  http.get(GET_CAPTCHA_CONFIG_PATTERN, () => HttpResponse.json(response));

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
