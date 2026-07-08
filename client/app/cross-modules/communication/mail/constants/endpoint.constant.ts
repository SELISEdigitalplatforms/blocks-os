import { getRuntimeEnv } from "@/lib/runtime-env";

const trimTrailingSlash = (value: string) => value.replace(/\/$/, "");

const MAIL_BASE = `${trimTrailingSlash(getRuntimeEnv("BLOCKS_OS_BASE_URL"))}/api`;

const MAIL_SUBPATH = "Mail";
const TEMPLATE_SUBPATH = "Template";

// Mail endpoints
export const MAIL_ENDPOINTS = {
  GET_MAILBOX_MAILS: `${MAIL_BASE}/${MAIL_SUBPATH}/GetMailBoxMails`,
  GET_MAILBOX_MAIL: `${MAIL_BASE}/${MAIL_SUBPATH}/GetMailBoxMail`,
  SEND_TO_ANY: `${MAIL_BASE}/${MAIL_SUBPATH}/SendToAny`,
} as const;

// Email Template endpoints
export const EMAIL_TEMPLATE_ENDPOINTS = {
  GET_TEMPLATES: `${MAIL_BASE}/template/gets`,
  GET_TEMPLATE: `${MAIL_BASE}/${TEMPLATE_SUBPATH}/Get`,
  SAVE_TEMPLATE: `${MAIL_BASE}/${TEMPLATE_SUBPATH}/Save`,
  CLONE_TEMPLATE: `${MAIL_BASE}/${TEMPLATE_SUBPATH}/Clone`,
  DELETE_TEMPLATE: `${MAIL_BASE}/${TEMPLATE_SUBPATH}/Delete`,
} as const;

// Mail Configuration endpoints
export const MAIL_CONFIG_ENDPOINTS = {
  GET_CONFIGS: `${MAIL_BASE}/${MAIL_SUBPATH}/Gets`,
  SAVE_CONFIG: `${MAIL_BASE}/${MAIL_SUBPATH}/Save`,
  DELETE_CONFIG: `${MAIL_BASE}/${MAIL_SUBPATH}/Delete`,
} as const;
