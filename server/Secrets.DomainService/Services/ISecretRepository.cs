
using Secrets.DomainService.Entities;

namespace Secrets.DomainService.Services
{
    public interface ISecretRepository
    {
        Task SaveSecretAsync(Secret secret);
        Task<Secret?> GetSecretByIdAsync(string id);
        Task<(List<Secret> secrets, long totalCount)> GetSecretsAsync(string secretKey,int page, int pageSize);
        Task DeleteSecretAsync(string itemId);
    }
}
