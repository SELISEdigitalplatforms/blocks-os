import { getRuntimeEnv } from "@/lib/runtime-env";

const trimTrailingSlash = (value: string) => value.replace(/\/$/, "");

const MAIL_BASE = `${trimTrailingSlash(getRuntimeEnv("BLOCKS_OS_BASE_URL"))}/api`;
const LOGIC_MAIL_BASE = `${trimTrailingSlash(getRuntimeEnv("BLOCKS_LOGIC_BASE_URL"))}/api`;

const MAIL_SUBPATH = "Mail";

// Mail endpoints
export const MAIL_ENDPOINTS = {
  GET_MAILBOX_MAILS: `${MAIL_BASE}/${MAIL_SUBPATH}/GetMailBoxMails`,
  GET_MAILBOX_MAIL: `${MAIL_BASE}/${MAIL_SUBPATH}/GetMailBoxMail`,
  GET_MAILBOX_MAIL_SOURCE: `${MAIL_BASE}/${MAIL_SUBPATH}/GetMailBoxMailSource`,
  GET_MAILBOX_MAIL_ATTACHMENT_FILE: `${MAIL_BASE}/${MAIL_SUBPATH}/GetMailBoxMailAttachmentFile`,
  SEND_TO_ANY: `${LOGIC_MAIL_BASE}/${MAIL_SUBPATH}/SendToAny`,
} as const;

// Email Template endpoints
export const EMAIL_TEMPLATE_ENDPOINTS = {
  GET_TEMPLATES: `${MAIL_BASE}/${MAIL_SUBPATH}/GetTemplates`,
  GET_TEMPLATE: `${MAIL_BASE}/${MAIL_SUBPATH}/GetTemplate`,
  SAVE_TEMPLATE: `${MAIL_BASE}/${MAIL_SUBPATH}/SaveTemplate`,
  CLONE_TEMPLATE: `${MAIL_BASE}/${MAIL_SUBPATH}/CloneTemplate`,
  DELETE_TEMPLATE: `${MAIL_BASE}/${MAIL_SUBPATH}/DeleteTemplate`,
  ASSIGN_TEMPLATES: `${MAIL_BASE}/${MAIL_SUBPATH}/AssignTemplates`,
  COPY_TEMPLATE_TO_ORGANIZATIONS: `${MAIL_BASE}/${MAIL_SUBPATH}/CopyTemplateToOrganizations`,
  GET_TEMPLATE_ORGANIZATION_COPIES: `${MAIL_BASE}/${MAIL_SUBPATH}/GetTemplateOrganizationCopies`,
} as const;

// Mail Configuration endpoints
export const MAIL_CONFIG_ENDPOINTS = {
  GET_CONFIGS: `${MAIL_BASE}/${MAIL_SUBPATH}/Gets`,
  SAVE_CONFIG: `${MAIL_BASE}/${MAIL_SUBPATH}/Save`,
  DELETE_CONFIG: `${MAIL_BASE}/${MAIL_SUBPATH}/Delete`,
  GET_CONFIG_USAGE: `${MAIL_BASE}/${MAIL_SUBPATH}/GetConfigurationUsage`,
} as const;
