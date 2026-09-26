using Configuration.DomainService.Connect.Entities;

namespace Configuration.DomainService.Connect.Services
{
    public interface IConnectRepository
    {
        /// <summary>Active templates from the shared <c>BlocksConfiguration</c> database.</summary>
        Task<List<ConnectTemplate>> GetActiveTemplatesAsync();

        Task<ConnectTemplate?> GetActiveTemplateByKeyAsync(string key);

        /// <summary>The current tenant's setup record, or null when setup has not been run.</summary>
        Task<ConnectSetup?> GetSetupAsync();

        /// <summary>
        /// Inserts the tenant's setup record. Returns false when one already exists, so two
        /// concurrent setups cannot both be recorded.
        /// </summary>
        Task<bool> TryInsertSetupAsync(ConnectSetup setup);
    }
}
