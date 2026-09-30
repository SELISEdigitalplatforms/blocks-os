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
        Task<List<IntegrationTemplate>> GetTemplatesAsync(string? family = null);

        Task<IntegrationTemplate?> GetTemplateByKeyAsync(string key, bool includeInactive = false);

        Task<RunIntegrationSetupResponse> RunSetupAsync(RunIntegrationSetupRequest request);
        Task<BaseQueryResponse<List<IntegrationSetup>>> GetConnectionsAsync();
        Task<BaseMutationResponse> RevokeConnectionAsync(string connectionId);
        Task RevokeUndeliveredConnectionAsync(string environmentTenantId, string connectionId);
        Task<BaseMutationResponse> DisconnectAsync(string connectionId);
        Task<RegenerateIntegrationSecretResponse> RegenerateSecretAsync(string connectionId);

        /// <summary>
        /// Reports whether the environment's permission store already contains every permission the
        /// template grants. Used by the connect flow to detect environments whose provisioning
        /// (role and permission copy from BlocksConfiguration) has not finished yet.
        /// </summary>
        Task<CheckIntegrationReadinessResponse> CheckReadinessAsync(string templateKey);
    }

    public sealed class CheckIntegrationReadinessResponse
    {
        public bool Ready { get; set; }
        public List<string> MissingPermissions { get; set; } = new();
        public string? Error { get; set; }
    }
}
