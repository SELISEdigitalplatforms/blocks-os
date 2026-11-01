using Blocks.Genesis;

namespace Configuration.DomainService.Mail.Template.Services
{
    /// <summary>
    /// Applies <see cref="MailTemplateHtmlPolicy"/> with the calling project's own application domains
    /// as the hosts a link may point to.
    /// </summary>
    public class MailTemplateHtmlChecker : IMailTemplateHtmlChecker
    {
        private readonly ITenants _tenants;

        public MailTemplateHtmlChecker(ITenants tenants)
        {
            _tenants = tenants;
        }

        public string? FindProblem(string? html)
        {
            if (string.IsNullOrWhiteSpace(html))
            {
                return null;
            }

            var tenantId = BlocksContext.GetContext()?.TenantId;
            var tenant = string.IsNullOrWhiteSpace(tenantId) ? null : _tenants.GetTenantByID(tenantId);
            var hosts = MailTemplateHtmlPolicy.HostsOf(tenant?.Applications?.Select(a => a.Domain));

            return MailTemplateHtmlPolicy.FindProblems(html, hosts).FirstOrDefault();
        }
    }
}
