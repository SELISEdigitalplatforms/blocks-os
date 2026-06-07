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

        public async Task<GetSecretsResponse> GetSecretAsync(string secretKey,int page,int pageSize)
        {
            var (secrets, totalCount) = await _secretRepository.GetSecretsAsync(secretKey,page,pageSize);
            return new GetSecretsResponse
            {
                Data = secrets,
                TotalCount = totalCount
            };
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

        public async Task<BaseResponse> DeleteSecretAsync(DeleteSecretRequest deleteSecretRequest)
        {
            await _secretRepository.DeleteSecretAsync(deleteSecretRequest.ItemId);

            return new BaseResponse
            {
                IsSuccess = true
            };
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
