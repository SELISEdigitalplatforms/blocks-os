export interface IEmailServiceData {
  id: string;
  name: string;
  configuration: string;
  subject: string;
  lastModified: Date;
  createdOn: Date;
  createdBy: string;
}

export interface IEmailLogs {
  itemId: string;
  timestamp: string;
  source: string;
  message: string;
  type: "divider" | "message" | "empty";
}

export interface IEmailTemplate {
  itemId: string;
  createdDate?: string;
  lastUpdatedDate?: string;
  createdBy?: string;
  lastUpdatedBy?: string;
  organizationIds?: string[];
  tags?: string[];
  mailConfigurationId?: string;
  templateBody?: string;
  jsonContent?: string;
  imageId?: string;
  imageUrl?: string;
  language?: string;
  name?: string;
  templateSubject?: string;
  generatedBy?: string;
}
export interface OpenStates {
  [key: string]: boolean;
}

export interface LogsEntryProps {
  logs: IEmailLogs[];
}

/**
 * Outbound mail provider the tenant is configured to use. Mirrors the
 * backend `MailServiceProvider` enum.
 */
export enum MailServiceProvider {
  /** Amazon Simple Email Service. */
  AmazonSes = 0,
  /** Zoho Mail transactional API. */
  Zoho = 1,
}

export interface IEmailConfig {
  configurationId: string;
  configurationName: string;
  host: string;
  port: number;
  enableSSL: boolean;
  senderName: string;
  senderAddress: string;
  senderUserName: string;
  accountPassword: string;
  itemId: string;
  name: string;
  isDefault: boolean;
  isInbound: boolean;
  provider: MailServiceProvider;
}

/**
 * Lifecycle status of a single email message as reported by the underlying
 * provider or recorded by the platform's mail pipeline.
 */
export enum MailStatus {
  /** Message was accepted by the sending provider. */
  Sent = "Sent",
  /** Recipient's mail server accepted the message. */
  Delivered = "Delivered",
  /** Recipient's mail server permanently rejected the message. */
  Bounced = "Bounced",
  /** Recipient marked the message as spam / abuse. */
  Complained = "Complained",
  /** Sending provider rejected the message before delivery (policy or content). */
  Rejected = "Rejected",
  /** Message was received from an external mailbox (inbound mail). */
  Received = "Received",
}

export interface IEmailUsage {
  messageId: string;
  subject: string;
  from: string;
  to: string;
  body: string;
  status: string;
  error: string;
  date: string;
  rawMime: string | null;
  isInbound?: boolean;
}

export interface IEmailUsageResponse {
  totalCount: number;
  mails: IEmailUsage[];
  errors: any;
  isSuccess: boolean;
}

export interface IGetMailBoxMailResponse {
  mail: IEmailUsage;
  errors: any;
  isSuccess: boolean;
}
