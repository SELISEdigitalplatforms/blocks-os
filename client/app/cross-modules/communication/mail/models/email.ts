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
 * Mail integration the tenant is configured to use. Mirrors the backend
 * `MailServiceProvider` enum, including its numeric values, which are
 * persisted and shared with blocks-logic and blocks-cli.
 */
export enum MailServiceProvider {
  /** Amazon Simple Email Service. */
  AmazonSes = 0,
  /** Zoho Mail transactional API. */
  Zoho = 1,
  /** Exchange Online SMTP with OAuth client credentials. Outbound only. */
  Office365Smtp = 2,
}

/** Mirrors the backend `MailAuthenticationType`. `Password` is the zero default. */
export enum MailAuthenticationType {
  Password = 0,
  OAuthClientCredentials = 1,
}

/** Mirrors the backend `MailSecurityMode`. `Legacy` means "defer to enableSSL". */
export enum MailSecurityMode {
  Legacy = 0,
  None = 1,
  StartTls = 2,
  SslOnConnect = 3,
}

/**
 * What the form and the details view need to know about a provider.
 *
 * An explicit entry per provider rather than anything derived from the enum.
 * `MailServiceProvider[value]` returns the TypeScript member name — it would
 * render "Office365Smtp" — so a reverse lookup is not a display contract. The
 * server stays authoritative; this drives presentation and early validation.
 */
export interface IMailProviderCapability {
  value: MailServiceProvider;
  /** Exactly what the user sees, everywhere the provider is named. */
  label: string;
  supportsOutbound: boolean;
  supportsInbound: boolean;
  authentication: MailAuthenticationType;
  /**
   * Fixed transport for providers where it is a property of the integration
   * rather than a tenant choice. Present means the host and port fields are
   * read-only and prefilled from here.
   */
  transport?: {
    host: string;
    port: number;
    securityMode: MailSecurityMode;
    enableSSL: boolean;
  };
}

export const MAIL_PROVIDERS: readonly IMailProviderCapability[] = [
  {
    value: MailServiceProvider.AmazonSes,
    label: "Amazon SES",
    supportsOutbound: true,
    supportsInbound: false,
    authentication: MailAuthenticationType.Password,
  },
  {
    value: MailServiceProvider.Zoho,
    label: "Zoho",
    supportsOutbound: true,
    supportsInbound: true,
    authentication: MailAuthenticationType.Password,
  },
  {
    value: MailServiceProvider.Office365Smtp,
    label: "SMTP Office 365",
    supportsOutbound: true,
    supportsInbound: false,
    authentication: MailAuthenticationType.OAuthClientCredentials,
    transport: {
      host: "smtp.office365.com",
      port: 587,
      securityMode: MailSecurityMode.StartTls,
      enableSSL: false,
    },
  },
] as const;

export const getMailProvider = (
  provider: MailServiceProvider,
): IMailProviderCapability | undefined => MAIL_PROVIDERS.find((p) => p.value === provider);

/**
 * The provider's display name, or the raw numeric value for one this client
 * does not know about — a server that has shipped a provider ahead of the UI
 * should not render a blank.
 */
export const getMailProviderLabel = (provider: MailServiceProvider): string =>
  getMailProvider(provider)?.label ?? `Provider ${provider}`;

export const getMailProvidersFor = (isInbound: boolean): IMailProviderCapability[] =>
  MAIL_PROVIDERS.filter((p) => (isInbound ? p.supportsInbound : p.supportsOutbound));

export const usesPasswordAuthentication = (provider: MailServiceProvider): boolean =>
  getMailProvider(provider)?.authentication !== MailAuthenticationType.OAuthClientCredentials;

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

  authenticationType?: MailAuthenticationType;
  securityMode?: MailSecurityMode;
  /** The Microsoft Entra tenant id, not the Blocks tenant id. */
  tenantId?: string;
  clientId?: string;
  mailboxAddress?: string;
  /**
   * Write-only. Sent on save, never returned by the API; blank on edit means
   * "keep the secret on file".
   */
  clientSecret?: string;
  /** Whether a secret is on file. The read-side stand-in for the value. */
  isClientSecretConfigured?: boolean;
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
  errors: Record<string, unknown> | null;
  isSuccess: boolean;
}

export interface IGetMailBoxMailResponse {
  mail: IEmailUsage;
  errors: Record<string, unknown> | null;
  isSuccess: boolean;
}
