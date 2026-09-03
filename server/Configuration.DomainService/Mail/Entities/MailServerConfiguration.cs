using Blocks.Genesis;
using Configuration.DomainService.Shared.Enums;
using MongoDB.Bson.Serialization.Attributes;

namespace Configuration.DomainService.Mail.Entities
{
    [BsonIgnoreExtraElements]
    public class MailServerConfiguration : BaseEntity
    {
        public string Name { get; set; }
        public string Host { get; set; }
        public int Port { get; set; }
        public bool EnableSSL { get; set; }
        public string SenderName { get; set; }
        public string SenderAddress { get; set; }
        public string SenderUserName { get; set; }
        public string AccountPassword { get; set; }
        public bool UseDefaultCredentials { get; set; }
        public SmtpClient SmtpClient { get; set; } = SmtpClient.Default;
        public bool IsDefault { get; set; }
        public bool IsInbound { get; set; }
        public MailServiceProvider Provider { get; set; }
        public bool IsEnableSnsConfiguration { get; set; } = false;
    }

    /// <summary>
    /// The SMTP/mail transport implementation used to deliver outgoing mail.
    /// </summary>
    public enum SmtpClient
    {
        /// <summary>Use the platform default SMTP transport.</summary>
        Default = 0,

        /// <summary>Use Microsoft Graph as the mail transport (recommended for Microsoft 365 tenants).</summary>
        MsGraph = 1,

        /// <summary>Use the MailKit SMTP client (recommended for non-Microsoft providers).</summary>
        MsMailKit = 2,
    }
}

