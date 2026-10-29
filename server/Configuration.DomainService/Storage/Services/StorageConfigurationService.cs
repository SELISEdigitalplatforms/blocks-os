using Blocks.Genesis;
using Configuration.DomainService.Shared.Utilities;
using Configuration.DomainService.Storage.Entities;
using Configuration.DomainService.Storage.Repositories;
using Configuration.DomainService.Storage.RequestModel;
using DomainService.Configuration;
using FluentValidation;

namespace Configuration.DomainService.Storage.Services
{
    public sealed class StorageConfigurationService : IStorageConfigurationService
    {
        private readonly IStorageConfigurationRepository _repository;
        private readonly IValidator<SaveStorageConfigurationRequest> _validator;
        private readonly IMessageClient _messageClient;

        public StorageConfigurationService(
            IStorageConfigurationRepository repository,
            IValidator<SaveStorageConfigurationRequest> validator,
            IMessageClient messageClient)
        {
            _repository = repository;
            _validator = validator;
            _messageClient = messageClient;
        }

        public async Task<BaseMutationResponse> SaveAsync(SaveStorageConfigurationRequest request)
        {
            ArgumentNullException.ThrowIfNull(request);
            var validationResult = await _validator.ValidateAsync(request);
            if (!validationResult.IsValid)
                return new BaseMutationResponse { IsSuccess = false, Errors = validationResult.Errors.ToDictionary(e => e.PropertyName, e => e.ErrorMessage) };

            var saved = request.UpdateRequest ? await UpdateAsync(request) : await CreateAsync(request);
            if (!saved.IsSuccess)
                return saved.Response;

            await _messageClient.SendToConsumerAsync(new ConsumerMessage<CreateDefaultFolderEvent>
            {
                Payload = new CreateDefaultFolderEvent
                {
                    ItemId = saved.Settings!.ItemId ?? string.Empty,
                    ConfigurationName = saved.Settings.Name,
                    StorageStrategy = saved.Settings.StorageStrategy ?? string.Empty
                },
                ConsumerName = Constants.StorageQueue,
            });

            return new BaseMutationResponse { IsSuccess = true, ItemId = saved.Settings.ItemId };
        }

        /// <summary>A new configuration: the request sets everything. A name taken meanwhile is refused, never overwritten.</summary>
        private async Task<SaveResult> CreateAsync(SaveStorageConfigurationRequest request)
        {
            var settings = new StorageSettings
            {
                Name = StorageConfigurationKeys.NormalizeName(request.Name),
                StorageStrategy = request.StorageStrategy ?? string.Empty,
                CloudStorageRegionEndPoint = request.CloudStorageRegionEndPoint,
                Host = request.Host ?? string.Empty,
                Port = request.Port ?? string.Empty,
                UserName = request.UserName ?? string.Empty,
                RemoteBasePath = request.RemoteBasePath ?? string.Empty,
            };
            ApplyMutableSettings(settings, request);

            var secrets = new StorageSecretValues
            {
                ConnectionString = request.ConnectionString,
                SecretKey = request.SecretKey,
                AccessKey = request.AccessKey,
                Password = request.Password,
                SftpSecretKey = StorageTypes.IsLocal(request.StorageStrategy) ? Helper.GenerateAesKey() : null,
            };

            var created = await _repository.CreateAsync(settings, secrets);
            return created is null
                ? SaveResult.Failed(nameof(SaveStorageConfigurationRequest.Name), StorageConfigurationMessages.NameNotUnique)
                : SaveResult.Saved(created);
        }

        /// <summary>
        /// Changes only the expiry, size and upload-completion settings: name, provider and secrets are fixed once a
        /// configuration exists (a direct API call sending them is not trusted). An old document not migrated yet is
        /// written as a row with its own secrets, so nothing is lost.
        /// </summary>
        private async Task<SaveResult> UpdateAsync(SaveStorageConfigurationRequest request)
        {
            var existing = await _repository.GetByItemIdAsync(request.ItemId ?? string.Empty);
            if (existing is null)
                return SaveResult.Failed(nameof(SaveStorageConfigurationRequest.ItemId), StorageConfigurationMessages.NotFound);

            var settings = existing.Settings;
            ApplyMutableSettings(settings, request);
            var saved = await _repository.SaveAsync(settings, existing.LegacySecrets);
            return SaveResult.Saved(saved);
        }

        /// <summary>Omitted values clear the setting (blocks-data then uses its defaults).</summary>
        private static void ApplyMutableSettings(StorageSettings settings, SaveStorageConfigurationRequest request)
        {
            settings.UploadUrlExpirySeconds = request.UploadUrlExpirySeconds;
            settings.DownloadUrlExpirySeconds = request.DownloadUrlExpirySeconds;
            settings.MaxFileSizeInBytes = request.MaxFileSizeInBytes;
            settings.UploadCompletionRequiredFor = request.UploadCompletionRequiredFor?.ToList();
        }

        public async Task<List<StorageConfigurationResponse>> GetAllAsync()
        {
            var configurations = await _repository.GetAllAsync();
            var result = new List<StorageConfigurationResponse>(configurations.Count);
            foreach (var configuration in configurations)
                result.Add(await ToResponseAsync(configuration));
            return result;
        }

        public async Task<StorageConfigurationResponse?> GetAsync(string configurationName)
        {
            var configuration = await _repository.GetByNameAsync(configurationName);
            return configuration is null ? null : await ToResponseAsync(configuration);
        }

        public async Task<BaseResponse> DeleteAsync(string configurationName)
        {
            await _repository.DeleteAsync(configurationName);
            return new BaseResponse { IsSuccess = true };
        }

        private async Task<StorageConfigurationResponse> ToResponseAsync(StoredStorageConfiguration configuration) =>
            StorageConfigurationResponse.From(configuration.Settings, await _repository.GetSecretStatusAsync(configuration));

        private sealed record SaveResult(bool IsSuccess, StorageSettings? Settings, BaseMutationResponse Response)
        {
            public static SaveResult Saved(StorageSettings settings) => new(true, settings, new BaseMutationResponse { IsSuccess = true });

            public static SaveResult Failed(string field, string message) =>
                new(false, null, new BaseMutationResponse { IsSuccess = false, Errors = new Dictionary<string, string> { { field, message } } });
        }
    }
}
