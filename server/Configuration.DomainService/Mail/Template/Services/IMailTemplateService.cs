using Blocks.Genesis;
using Configuration.DomainService.Mail.Entities;
using Configuration.DomainService.Mail.Template.Models;

namespace Configuration.DomainService.Mail.Template.Services
{
    public interface IMailTemplateService
    {
        Task<BaseMutationResponse> SaveTemplateAsync(SaveMailTemplateRequest template);
        Task<GetAllMailTemplatesResponse> GetAllTemplatesAsync(GetAllMailTemplatesRequest request);
        Task<EmailTemplate?> GetAsync(GetMailTemplateRequest request);
        Task<BaseMutationResponse> CloneTemplateAsync(CloneMailTemplateRequest request);
        Task<BaseMutationResponse> DeleteAsync(DeleteMailTemplateRequest request);
        Task<BeeLoginResponse?> GetTemplatePluginTokenAsync(string provider, string uId);
    }
}




