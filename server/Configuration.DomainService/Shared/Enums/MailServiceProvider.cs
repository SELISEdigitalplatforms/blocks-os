
namespace Configuration.DomainService.Shared.Enums
{
    /// <summary>
    /// Outbound mail provider a tenant is configured to use.
    /// </summary>
    public enum MailServiceProvider
    {
        /// <summary>Amazon Simple Email Service.</summary>
        AmazonSes = 0,

        /// <summary>Zoho Mail transactional API.</summary>
        Zoho = 1,
    }
}

