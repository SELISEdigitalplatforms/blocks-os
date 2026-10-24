using Blocks.Genesis;
using Configuration.DomainService.Storage.RequestModel;

namespace Configuration.DomainService.Storage.Services
{
    /// <summary>The storage configurations of the caller's tenant (blocks-os <c>/Storage/*</c> API).</summary>
    public interface IStorageConfigurationService
    {
        /// <summary>
        /// Create (<c>UpdateRequest=false</c>): sets everything; the secrets go to SecretStore, SFTP gets a generated
        /// SftpSecretKey. Update: changes only the expiry, size and upload-completion settings.
        /// </summary>
        Task<BaseMutationResponse> SaveAsync(SaveStorageConfigurationRequest request);

        Task<List<StorageConfigurationResponse>> GetAllAsync();

        /// <summary>Null when there is no configuration with that name.</summary>
        Task<StorageConfigurationResponse?> GetAsync(string configurationName);

        Task<BaseResponse> DeleteAsync(string configurationName);
    }
}
