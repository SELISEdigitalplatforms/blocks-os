export const EMAIL_TAB_KEYS = ["Emailstemplates", "Inbox", "Outgoingmails"] as const;

export type EmailTabKey = (typeof EMAIL_TAB_KEYS)[number];
