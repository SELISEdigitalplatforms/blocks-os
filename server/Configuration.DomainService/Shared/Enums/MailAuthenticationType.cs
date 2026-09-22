
namespace Configuration.DomainService.Shared.Enums
{
    /// <summary>
    /// How a mail configuration authenticates against its transport.
    /// </summary>
    /// <remarks>
    /// <see cref="Password"/> is zero deliberately: records and requests created before OAuth
    /// support was added carry no value for this field, so they deserialize onto the existing
    /// username/password path without a migration.
    /// </remarks>
    public enum MailAuthenticationType
    {
        /// <summary>Username plus password, held in the configuration document.</summary>
        Password = 0,

        /// <summary>
        /// OAuth 2.0 client credentials. The client secret lives in Blocks Secrets; the
        /// configuration holds only its reference.
        /// </summary>
        OAuthClientCredentials = 1,
    }
}
