
using Secrets.DomainService.Entities;

namespace Secrets.DomainService.Services
{
    public interface ISecretRepository
    {
        Task SaveSecretAsync(Secret secret);
        Task<Secret?> GetSecretByIdAsync(string id);
        Task<List<Secret>> GetSecretsAsync(string secretKey);
        Task DeleteSecretAsync(string itemId);
    }
}
