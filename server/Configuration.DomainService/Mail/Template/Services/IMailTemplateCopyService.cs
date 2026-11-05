using Blocks.Genesis;

namespace Configuration.DomainService.Mail.Template.Services
{
    /// <summary>The API side of copying a Default template to organizations: checks the request and queues the job.</summary>
    public interface IMailTemplateCopyService
    {
        Task<BaseMutationResponse> CopyToOrganizationsAsync(CopyTemplateToOrganizationsRequest request);
        Task<GetTemplateOrganizationCopiesResponse> GetOrganizationCopiesAsync(GetTemplateOrganizationCopiesRequest request);
    }
}
