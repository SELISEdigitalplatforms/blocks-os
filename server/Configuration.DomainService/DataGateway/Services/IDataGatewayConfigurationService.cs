using Blocks.Genesis;
using Configuration.DomainService.DataGateway.RequestModel;
using Configuration.DomainService.DataGateway.ResponseModel;

namespace Configuration.DomainService.DataGateway.Services
{
    /// <summary>
    /// The data-source page: GET/save of the tenant's root doc and its secret. Scoped: the connection string goes through
    /// Blocks Secrets (<c>ISecretService</c> is scoped).
    /// </summary>
    public interface IDataGatewayConfigurationService
    {
        /// <summary>The tenant's configuration (created with defaults when missing). Null = the root doc is soft-deleted.</summary>
        Task<DataGatewayConfigurationResponse?> GetDataGatewayConfigurationAsync();

        Task<BaseMutationResponse> SaveDataGatewayConfigurationAsync(SaveDataGatewayConfigurationRequest request);
    }
}
