using Configuration.DomainService.Shared.Enums;
using MongoDB.Bson.Serialization.Attributes;

namespace Configuration.DomainService.Mail.RequestModel
{
    [BsonIgnoreExtraElements]
    public class MailConfiguration
    {
        public string ConfigurationName { get; set; }
        public string ConfigurationId { get; set; }
        public string Host { get; set; }
        public int Port { get; set; }
        public bool EnableSSL { get; set; }
        public string? SenderName { get; set; }
        public string? SenderAddress { get; set; }
        /// <summary>
        /// Nullable because an OAuth provider sends neither. With nullable reference types on, a
        /// non-nullable property here is an implicit <c>[Required]</c> to model binding, and
        /// <c>[ApiController]</c> answers 400 before normalization or the validator runs — which
        /// made an Office 365 configuration impossible to save at all. Whether a value is required
        /// is decided by authentication type in <c>MailConfigurationValidator</c>, not here.
        /// </summary>
        public string? SenderUserName { get; set; }

        /// <inheritdoc cref="SenderUserName" />
        public string? AccountPassword { get; set; }

        public DateTime LastUpdatedDate { get; set; }
        public bool IsInbound { get; set; }
        public MailServiceProvider Provider { get; set; }
        public bool IsEnableSnsConfiguration { get; set; } = false;

        /// <summary>
        /// Omitted by pre-change callers, which lands on <see cref="MailAuthenticationType.Password"/>
        /// and keeps their existing behaviour. Provider-normalized before validation, so a
        /// submitted value that contradicts the provider is overwritten rather than rejected.
        /// </summary>
        public MailAuthenticationType AuthenticationType { get; set; }

        /// <summary>Provider-normalized. <see cref="MailSecurityMode.Legacy"/> defers to <see cref="EnableSSL"/>.</summary>
        public MailSecurityMode SecurityMode { get; set; }

        /// <summary>
        /// The <b>Microsoft Entra</b> tenant id used for token acquisition. This is not the
        /// ambient Blocks tenant id — that one determines MongoDB and Blocks Secrets isolation
        /// and is never taken from a request field.
        /// </summary>
        public string? TenantId { get; set; }

        /// <summary>The Entra application (client) id.</summary>
        public string? ClientId { get; set; }

        /// <summary>
        /// Plaintext on the way in only. Written to Blocks Secrets and never persisted to Mongo,
        /// returned by an API, or logged. Null or empty on edit means "keep the current secret";
        /// whitespace-only is a validation error rather than a preserve.
        /// </summary>
        public string? ClientSecret { get; set; }

        /// <summary>The mailbox the application sends as.</summary>
        public string? MailboxAddress { get; set; }
    }

}
