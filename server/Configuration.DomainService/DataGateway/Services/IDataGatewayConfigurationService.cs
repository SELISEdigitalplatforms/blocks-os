using Blocks.Genesis;
using Configuration.DomainService.DataGateway.Entities;
using Configuration.DomainService.DataGateway.RequestModel;

namespace Configuration.DomainService.DataGateway.Services
{
    /// <summary>
    /// The data-gateway page (GET/save of the DataServiceConfigurations doc). Split out of the singleton
    /// <c>IConfigurationService</c> and registered <b>scoped</b>: with the os switch on it reads and writes
    /// the connection string through Blocks Secrets (<c>ISecretService</c> is scoped) (os SPEC2 §6.4–6.6).
    /// </summary>
    public interface IDataGatewayConfigurationService
    {
        Task<BaseMutationResponse> SaveDataGatewayConfigurationAsync(SaveDataGatewayConfigurationRequest request);

        /// <summary>Today's JSON shape; <c>null</c> (→ 204) when there is no configuration.</summary>
        Task<DataGatewayConfiguration?> GetDataGatewayConfigurationAsync();
    }
}
