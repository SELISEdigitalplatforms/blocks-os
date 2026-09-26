using Blocks.Genesis;
using Configuration.DomainService.Connect.Entities;
using Configuration.DomainService.Connect.RequestModel;

namespace Configuration.DomainService.Connect.Services
{
    /// <summary>
    /// Connect setup: serves the templates and records a project's completed setup.
    /// </summary>
    /// <remarks>
    /// The role, its permissions and the client credential are created through IAM's own
    /// endpoints by the caller, so IAM's validation, slug derivation and mutation events all
    /// apply. This service only owns what IAM does not know about: the templates and the fact
    /// that setup is done.
    /// </remarks>
    public interface IConnectService
    {
        Task<List<ConnectTemplate>> GetTemplatesAsync();

        Task<ConnectSetup?> GetSetupAsync();

        Task<BaseMutationResponse> SaveSetupAsync(SaveConnectSetupRequest request);
    }
}
