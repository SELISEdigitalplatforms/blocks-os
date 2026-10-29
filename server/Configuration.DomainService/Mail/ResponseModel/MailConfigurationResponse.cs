using Blocks.Genesis;
using System.Text.Json.Serialization;
using Blocks.Genesis.Entities.Os;

namespace Configuration.DomainService.Mail.ResponseModel
{
    /// <summary>
    /// What a browser is allowed to see of a mail configuration.
    /// </summary>
    /// <remarks>
    /// A separate type rather than the entity with fields blanked out. The entity now carries
    /// <see cref="MailServerConfiguration.ClientSecretReference"/>, and returning it — even with
    /// the field cleared in place — would mean every future field added to the entity is public
    /// by default, and one missed assignment leaks a live secret reference. Here the default is
    /// the other way round: a field reaches the client only because it is listed below.
    /// <para>
    /// Derives from <see cref="BaseEntity"/> so the audit fields serialize exactly as they did
    /// when the entity itself was returned, keeping the existing client payload shape.
    /// </para>
    /// </remarks>
    public class MailConfigurationResponse : BaseEntity
    {
        public string Name { get; set; }
        public string Host { get; set; }
        public int Port { get; set; }
        public bool EnableSSL { get; set; }
        public string SenderName { get; set; }
        public string SenderAddress { get; set; }
        public string SenderUserName { get; set; }

        /// <summary>
        /// The existing mask for password providers. Null — and therefore absent from the JSON —
        /// for providers that authenticate without one, so the UI cannot render a mask that a
        /// caller could submit back as a real value.
        /// </summary>
        [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
        public string? AccountPassword { get; set; }

        public bool UseDefaultCredentials { get; set; }
        public SmtpClient SmtpClient { get; set; }
        public bool IsDefault { get; set; }
        public bool IsInbound { get; set; }
        public MailServiceProvider Provider { get; set; }
        public bool IsEnableSnsConfiguration { get; set; }
        public MailAuthenticationType AuthenticationType { get; set; }
        public MailSecurityMode SecurityMode { get; set; }

        [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
        public string? TenantId { get; set; }

        [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
        public string? ClientId { get; set; }

        [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
        public string? MailboxAddress { get; set; }

        /// <summary>
        /// Whether a usable secret is on file. This is what the UI renders instead of the value:
        /// it answers the only question the form needs — "must I supply one?" — without the
        /// plaintext or the reference crossing the wire.
        /// </summary>
        /// <remarks>
        /// False when the reference points at a secret that was archived or no longer exists:
        /// such a configuration cannot authenticate, and saving it needs a new value. True while
        /// the status is unavailable, so a secret-store outage does not force users to re-enter
        /// secrets that may be perfectly healthy.
        /// </remarks>
        public bool IsClientSecretConfigured { get; set; }

        /// <summary>
        /// The linked client secret's state — one of the <c>LinkedSecretStatus</c> values —
        /// computed at read time. Only Office 365 OAuth configurations own a linked secret; null,
        /// and therefore absent from the JSON, for every other provider and auth type.
        /// </summary>
        [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
        public string? ClientSecretStatus { get; set; }
    }
}
