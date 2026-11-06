import {
  KeyRound,
  LogIn,
  LogOut,
  RefreshCw,
  ShieldCheck,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { tStatic } from "@seliseblocks/genesis-os";

const KEY_LABEL_SIGN_IN = "EVENT_META.LABEL_SIGN_IN";
const KEY_LABEL_SIGN_OUT = "EVENT_META.LABEL_SIGN_OUT";
const KEY_LABEL_TOKEN_REFRESHED = "EVENT_META.LABEL_TOKEN_REFRESHED";

export type EventTone = "success" | "info" | "error" | "warning";

export type EventMeta = {
  label: string;
  description: string;
  icon: LucideIcon;
  tone: EventTone;
};

// Holds translation keys, not text: the text is looked up in getEventMeta, when it is shown.
type EventMetaDefinition = {
  labelKey: string;
  descriptionKey: string;
  icon: LucideIcon;
  tone: EventTone;
};

export const EVENT_META: Record<string, EventMetaDefinition> = {
  login_via_password: {
    labelKey: KEY_LABEL_SIGN_IN,
    descriptionKey: "EVENT_META.DESCRIPTION_INTERACTIVE_SIGN_IN",
    icon: LogIn,
    tone: "success",
  },
  login_via_social: {
    labelKey: KEY_LABEL_SIGN_IN,
    descriptionKey: "EVENT_META.DESCRIPTION_SIGNED_IN_SOCIAL",
    icon: LogIn,
    tone: "success",
  },
  login_via_sso_consent: {
    labelKey: KEY_LABEL_SIGN_IN,
    descriptionKey: "EVENT_META.DESCRIPTION_SIGNED_IN_SSO",
    icon: LogIn,
    tone: "success",
  },
  login_via_authorization_code: {
    labelKey: KEY_LABEL_SIGN_IN,
    descriptionKey: "EVENT_META.DESCRIPTION_SIGNED_IN_AUTHORIZATION_CODE",
    icon: LogIn,
    tone: "success",
  },
  login_via_mfa_code: {
    labelKey: "EVENT_META.LABEL_MFA_CHALLENGE",
    descriptionKey: "EVENT_META.DESCRIPTION_MFA_VERIFIED",
    icon: ShieldCheck,
    tone: "success",
  },
  token_renewed: {
    labelKey: KEY_LABEL_TOKEN_REFRESHED,
    descriptionKey: "EVENT_META.DESCRIPTION_SESSION_TOKEN_REFRESHED",
    icon: RefreshCw,
    tone: "info",
  },
  renew_refresh_token: {
    labelKey: KEY_LABEL_TOKEN_REFRESHED,
    descriptionKey: "EVENT_META.DESCRIPTION_REFRESH_TOKEN_RENEWED",
    icon: RefreshCw,
    tone: "info",
  },
  issued_refresh_token: {
    labelKey: "EVENT_META.LABEL_TOKEN_ISSUED",
    descriptionKey: "EVENT_META.DESCRIPTION_REFRESH_TOKEN_ISSUED",
    icon: KeyRound,
    tone: "info",
  },
  session_revoked: {
    labelKey: KEY_LABEL_SIGN_OUT,
    descriptionKey: "EVENT_META.DESCRIPTION_SIGNED_OUT_FROM_SESSION",
    icon: LogOut,
    tone: "error",
  },
  revoke_access_by_logout: {
    labelKey: KEY_LABEL_SIGN_OUT,
    descriptionKey: "EVENT_META.DESCRIPTION_SIGNED_OUT",
    icon: LogOut,
    tone: "error",
  },
  revoke_access_by_logout_all: {
    labelKey: KEY_LABEL_SIGN_OUT,
    descriptionKey: "EVENT_META.DESCRIPTION_SIGNED_OUT_ALL_DEVICES",
    icon: LogOut,
    tone: "error",
  },
  revoke_refresh_token: {
    labelKey: "EVENT_META.LABEL_TOKEN_REVOKED",
    descriptionKey: "EVENT_META.DESCRIPTION_REFRESH_TOKEN_REVOKED",
    icon: XCircle,
    tone: "error",
  },
  LOGIN_SUCCESS: {
    labelKey: KEY_LABEL_SIGN_IN,
    descriptionKey: "EVENT_META.DESCRIPTION_INTERACTIVE_SIGN_IN",
    icon: LogIn,
    tone: "success",
  },
  LOGIN_FAILURE: {
    labelKey: "EVENT_META.LABEL_SIGN_IN_FAILED",
    descriptionKey: "EVENT_META.DESCRIPTION_SIGN_IN_ATTEMPT_FAILED",
    icon: XCircle,
    tone: "error",
  },
  TOKEN_REFRESHED: {
    labelKey: KEY_LABEL_TOKEN_REFRESHED,
    descriptionKey: "EVENT_META.DESCRIPTION_SESSION_TOKEN_REFRESHED",
    icon: RefreshCw,
    tone: "info",
  },
  SESSION_REVOKED: {
    labelKey: KEY_LABEL_SIGN_OUT,
    descriptionKey: "EVENT_META.DESCRIPTION_SIGNED_OUT_FROM_SESSION",
    icon: LogOut,
    tone: "error",
  },
  MFA_CHALLENGE_SUCCESS: {
    labelKey: "EVENT_META.LABEL_MFA_CHALLENGE",
    descriptionKey: "EVENT_META.DESCRIPTION_MFA_VERIFIED",
    icon: ShieldCheck,
    tone: "success",
  },
  PASSWORD_CHANGED: {
    labelKey: "EVENT_META.LABEL_PASSWORD_CHANGED",
    descriptionKey: "EVENT_META.DESCRIPTION_PASSWORD_UPDATED",
    icon: KeyRound,
    tone: "info",
  },
};

export const getEventMeta = (event: string): EventMeta => {
  const known = EVENT_META[event];
  if (known) {
    return {
      label: tStatic("os.idp.users", known.labelKey),
      description: tStatic("os.idp.users", known.descriptionKey),
      icon: known.icon,
      tone: known.tone,
    };
  }
  // Unknown backend event: show its own name, nothing to translate.
  return {
    label: event
      .split("_")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" "),
    description: event,
    icon: RefreshCw,
    tone: "info",
  };
};

export const EVENT_TONE_CLASS: Record<EventTone, string> = {
  success: "text-emerald-600 dark:text-emerald-400",
  info: "text-blue-600 dark:text-blue-400",
  error: "text-red-600 dark:text-red-400",
  warning: "text-amber-600 dark:text-amber-400",
};
