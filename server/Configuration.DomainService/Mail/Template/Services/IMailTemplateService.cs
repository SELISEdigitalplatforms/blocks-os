using Blocks.Genesis;
using Configuration.DomainService.Mail.Entities;

namespace Configuration.DomainService.Mail.Template.Services
{
    public interface IMailTemplateService
    {
        Task<BaseMutationResponse> SaveTemplateAsync(SaveMailTemplateRequest template);
        Task<GetAllMailTemplatesResponse> GetAllTemplatesAsync(GetAllMailTemplatesRequest request);
        Task<EmailTemplate?> GetAsync(GetMailTemplateRequest request);
        Task<BaseMutationResponse> CloneTemplateAsync(CloneMailTemplateRequest request);
        Task<BaseMutationResponse> DeleteAsync(DeleteMailTemplateRequest request);
    }
}




