using Blocks.Genesis.Entities.Os;

namespace Configuration.DomainService.Mail.Template.Services
{
    public interface IMailTemplateRepository
    {
        Task SaveAsync(EmailTemplate template);
        Task<EmailTemplate?> GetByIdAsync(string itemId);
        /// <summary>The template as the caller may see it: properties a column rule hides are left out. Never save it back.</summary>
        Task<EmailTemplate?> GetForViewAsync(string itemId);
        /// <summary>The template with this name and language in one organization (Default: also stored without one).</summary>
        Task<EmailTemplate?> GetByNameAndLanguageAsync(string name, string language, string organizationId);
        Task<GetAllMailTemplatesResponse> GetsAsync(GetAllMailTemplatesRequest request);
        Task DeleteAsync(string itemId);

        /// <summary>How many templates, in every organization and language, name the configuration.</summary>
        Task<long> CountByMailConfigurationIdAsync(string mailConfigurationId);

        /// <summary>How many of the templates with these ids exist in an organization other than <paramref name="organizationId"/>.</summary>
        Task<long> CountOutsideOrganizationAsync(IReadOnlyCollection<string> templateIds, string organizationId);

        /// <summary>
        /// Points the organization's templates at the configuration in one update: those with the given ids, or,
        /// when <paramref name="templateIds"/> is null, every one matching <paramref name="searchKey"/> and
        /// <paramref name="language"/>. Templates already on it are left alone. Returns how many changed.
        /// </summary>
        Task<int> AssignConfigurationAsync(string configurationId, string organizationId, IReadOnlyCollection<string>? templateIds, string? searchKey, string? language);

        /// <summary>
        /// The templates with this Name + Language in the given organizations (organization copies), one read.
        /// </summary>
        Task<List<EmailTemplate>> GetOrganizationCopiesAsync(string name, string language, IReadOnlyCollection<string> organizationIds);

        /// <summary>
        /// One batch of a copy job: one read of the organizations' existing copies, then one unordered bulk write.
        /// An organization without a copy gets one (an upsert keyed by OrganizationId + Name + Language, whose id is
        /// derived from <paramref name="tenantId"/> and that key); one with a copy keeps it, or with
        /// <paramref name="replace"/> gets the source's subject, body, editor JSON and image.
        /// </summary>
        Task<OrganizationCopyBatchResult> WriteOrganizationCopiesAsync(EmailTemplate source, IReadOnlyCollection<string> organizationIds, bool replace, string tenantId, string userId);
    }
}




