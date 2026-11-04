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
    }
}




