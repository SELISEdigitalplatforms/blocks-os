using Configuration.DomainService.Mail.Entities;

namespace Configuration.DomainService.Mail.Template.Services
{
    public interface IMailTemplateRepository
    {
        Task SaveAsync(EmailTemplate template);
        Task<EmailTemplate?> GetByIdAsync(string itemId);
        Task<EmailTemplate?> GetByNameAndLanguageAsync(string name, string language);
        Task<GetAllMailTemplatesResponse> GetsAsync(GetAllMailTemplatesRequest request);
        Task DeleteAsync(string itemId);
        Task<TemplatePluginConfig?> GetPluginConfigAsync(string pluginProvider);
    }
}




