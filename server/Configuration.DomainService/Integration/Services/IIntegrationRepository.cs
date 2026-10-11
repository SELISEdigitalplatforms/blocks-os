using Configuration.DomainService.Integration.Entities;

namespace Configuration.DomainService.Integration.Services
{
    public interface IIntegrationRepository
    {
        /// <summary>Active templates from the shared <c>BlocksConfiguration</c> database.</summary>
        Task<List<IntegrationTemplate>> GetActiveTemplatesAsync(string? family = null);

        /// <summary>
        /// Finds a template from the shared store. Inactive templates are only included for
        /// legacy setup records that still need their connection metadata rendered.
        /// </summary>
        Task<IntegrationTemplate?> GetTemplateByKeyAsync(string key, bool includeInactive = false);

        /// <summary>
        /// Inserts the tenant's setup record. Returns false when one already exists for the same
        /// template, so two
        /// concurrent setups cannot both be recorded.
        /// </summary>
        Task<bool> TryInsertSetupAsync(IntegrationSetup setup);

        Task<bool> HasActiveConnectionNamedAsync(string connectionName);
        Task<List<IntegrationSetup>> GetConnectionsAsync();
        Task<bool> RevokeConnectionAsync(string connectionId, string? revokedBy);
        /// <summary>Marks a connection in its owning environment after its one-time secret was not delivered.</summary>
        Task MarkConnectionNeverDeliveredAsync(string environmentTenantId, string connectionId);
        Task<IntegrationSetup?> GetConnectionAsync(string connectionId);
    }
}
