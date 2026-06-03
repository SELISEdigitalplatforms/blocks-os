using Blocks.Genesis;
using Secrets.DomainService.Entities;
using Secrets.DomainService.ResponseModel;

namespace Secrets.DomainService.Services
{
    public interface ISecretManagementService
    {
        Task<GetSecretsResponse> GetSecretAsync(string secretKey,int page,int pageSize);
        Task<BaseResponse> SaveSecretAsync(SaveSecretRequest saveSecretRequest);
        Task<Secret> SecretAsync(string itemId);
        Task<BaseResponse> DeleteSecretAsync(DeleteSecretRequest deleteSecretRequest);
    }
}
