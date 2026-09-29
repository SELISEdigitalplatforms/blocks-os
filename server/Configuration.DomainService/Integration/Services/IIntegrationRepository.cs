using Configuration.DomainService.Integration.Entities;

namespace Configuration.DomainService.Integration.Services
{
    public interface IIntegrationRepository
    {
        /// <summary>Active templates from the shared <c>BlocksConfiguration</c> database.</summary>
        Task<List<IntegrationTemplate>> GetActiveTemplatesAsync();

        Task<IntegrationTemplate?> GetActiveTemplateByKeyAsync(string key);

        /// <summary>The current tenant's setup record, or null when setup has not been run.</summary>
        Task<IntegrationSetup?> GetSetupAsync();

        /// <summary>
        /// Inserts the tenant's setup record. Returns false when one already exists for the same
        /// template, so two
        /// concurrent setups cannot both be recorded.
        /// </summary>
        Task<bool> TryInsertSetupAsync(IntegrationSetup setup);
    }
}
