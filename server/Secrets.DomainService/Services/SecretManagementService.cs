using Blocks.Genesis;
using Secrets.DomainService.Entities;
using Secrets.DomainService.ResponseModel; 

namespace Secrets.DomainService.Services
{
    public class SecretManagementService : ISecretManagementService
    {
        private readonly ISecretRepository _secretRepository;

        public SecretManagementService(ISecretRepository secretRepository)
        {
            _secretRepository = secretRepository;
        }

        public async Task<List<Secret>> GetSecretAsync(string secretKey)
        {
            return await _secretRepository.GetSecretsAsync(secretKey);
        }

        public async Task<BaseResponse> SaveSecretAsync(SaveSecretRequest saveSecretRequest)
        {
            var secret = await MapAsync(saveSecretRequest);
            await _secretRepository.SaveSecretAsync(secret);

            return new BaseResponse
            {
                IsSuccess = true
            };
        }

        public async Task<Secret> SecretAsync(string itemId)
        {
            return await _secretRepository.GetSecretByIdAsync(itemId);
        }

        private async Task<Secret?> MapAsync(SaveSecretRequest saveSecretRequest)
        {
            var secret = await _secretRepository.GetSecretByIdAsync(saveSecretRequest.ItemId) ?? new Secret
            {
                ItemId = Guid.NewGuid().ToString(),
                CreatedBy = BlocksContext.GetContext().UserId,
                CreatedDate = DateTime.UtcNow,
            };

            secret.LastUpdatedBy = BlocksContext.GetContext().UserId;
            secret.LastUpdatedDate = DateTime.UtcNow;
            secret.SecretKey = saveSecretRequest.SecretKey.ToLower();
            secret.KeyValuePairs = saveSecretRequest.KeyValuePairs;

            return secret;
        }
    }
}
