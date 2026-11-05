using Blocks.Genesis;
using Blocks.Genesis.Entities.Os;

namespace Configuration.DomainService.Mail.Template.Services
{
    public interface IMailTemplateService
    {
        Task<BaseMutationResponse> SaveTemplateAsync(SaveMailTemplateRequest template);
        Task<GetAllMailTemplatesResponse> GetAllTemplatesAsync(GetAllMailTemplatesRequest request);
        Task<EmailTemplate?> GetAsync(GetMailTemplateRequest request);
        Task<BaseMutationResponse> CloneTemplateAsync(CloneMailTemplateRequest request);
        Task<BaseMutationResponse> DeleteAsync(DeleteMailTemplateRequest request);
        Task<AssignTemplatesResponse> AssignTemplatesAsync(AssignTemplatesRequest request);

        /// <summary>
        /// SPEC34 §6.1: deletes a Default organization template now and queues the deletion of the organizations' own
        /// copies (same Name + Language) in all or the selected organizations. Returns the job id.
        /// </summary>
        Task<BaseMutationResponse> DeleteAcrossOrganizationsAsync(DeleteTemplateAcrossOrganizationsRequest request);
    }
}




