using Blocks.Genesis;
using Secrets.DomainService.Entities;
using Secrets.DomainService.ResponseModel;

namespace Secrets.DomainService.Services
{
    public interface ISecretManagementService
    {
        Task<List<Secret>> GetSecretAsync(string secretKey);
        Task<BaseResponse> SaveSecretAsync(SaveSecretRequest saveSecretRequest);
        Task<Secret> SecretAsync(string itemId);
    }
}
