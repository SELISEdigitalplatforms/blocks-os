
namespace Configuration.DomainService.Shared.Enums
{
    /// <summary>
    /// The mail integration a tenant is configured to use.
    /// </summary>
    /// <remarks>
    /// An id identifies a concrete integration/transport contract, not merely a vendor brand: a
    /// future Microsoft Graph sender or an Office 365 inbound source gets its own appended id if
    /// its configuration or authentication semantics differ from <see cref="Office365Smtp"/>.
    /// Existing numeric values are never reordered or repurposed — they are persisted in Mongo
    /// documents and mirrored by blocks-logic and blocks-cli.
    /// </remarks>
    public enum MailServiceProvider
    {
        /// <summary>Amazon Simple Email Service.</summary>
        AmazonSes = 0,

        /// <summary>Zoho Mail transactional API.</summary>
        Zoho = 1,

        /// <summary>
        /// Exchange Online SMTP with OAuth client credentials (STARTTLS + SASL XOAUTH2).
        /// Outbound only.
        /// </summary>
        Office365Smtp = 2,
    }
}
