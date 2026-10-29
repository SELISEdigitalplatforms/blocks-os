using Blocks.Genesis.Entities.Os;

namespace Configuration.DomainService.Mail.Template.Services
{
    public interface IMailTemplateRepository
    {
        Task SaveAsync(EmailTemplate template);
        Task<EmailTemplate?> GetByIdAsync(string itemId);
        /// <summary>The template as the caller may see it: properties a column rule hides are left out. Never save it back.</summary>
        Task<EmailTemplate?> GetForViewAsync(string itemId);
        Task<EmailTemplate?> GetByNameAndLanguageAsync(string name, string language);
        Task<GetAllMailTemplatesResponse> GetsAsync(GetAllMailTemplatesRequest request);
        Task DeleteAsync(string itemId);
    }
}




