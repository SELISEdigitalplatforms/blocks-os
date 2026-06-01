// ─── MFA configuration endpoints (mfa.service — cloud config) ──────────────

import { API_BASES } from "@/constants/endpoint.constant";

export const MFA_CONFIG_ENDPOINTS = {
  GET: `/api/Secrets/Gets`,
} as const;

// ─── MFA endpoints (mfa.service — IDP & MFA bases) ─────────────────────────

const MFA_SUBPATH = "/Mfa";
const MANAGEMENT_SUBPATH = "/Management";

export const MFA_ENDPOINTS = {
  GENERATE_OTP: `${API_BASES.LOGIC}${MFA_SUBPATH}/GenerateOTP`,
  CONFIGURE_USER_MFA: `${API_BASES.LOGIC}${MANAGEMENT_SUBPATH}/ConfigureUserMfa`,
  SETUP_TOTP: `${API_BASES.LOGIC}${MFA_SUBPATH}/SetUpTotp`,
  VERIFY_OTP: `${API_BASES.LOGIC}${MFA_SUBPATH}/VerifyOTP`,
  RESEND_OTP: `${API_BASES.LOGIC}${MFA_SUBPATH}/ResendOtp`,
  DISABLE_MFA: `${API_BASES.LOGIC}${MFA_SUBPATH}/DisableUserMfa`,
} as const;
