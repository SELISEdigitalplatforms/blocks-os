using Blocks.Genesis;
using Configuration.DomainService.Integration.Entities;
using Configuration.DomainService.Integration.RequestModel;

namespace Configuration.DomainService.Integration.Services
{
    /// <summary>
    /// Integration setup: serves the templates and records a project's completed setup.
    /// </summary>
    /// <remarks>
    /// The role, its permissions and the client credential are created through IAM's own
    /// endpoints by the caller, so IAM's validation, slug derivation and mutation events all
    /// apply. This service only owns what IAM does not know about: the templates and the fact
    /// that setup is done.
    /// </remarks>
    public interface IIntegrationService
    {
        Task<List<IntegrationTemplate>> GetTemplatesAsync();

        Task<IntegrationSetup?> GetSetupAsync();

        Task<BaseMutationResponse> SaveSetupAsync(SaveIntegrationSetupRequest request);
    }
}
