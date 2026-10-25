using Blocks.Genesis;
using FluentValidation;
using Configuration.DomainService.Shared.Utilities;
using Configuration.DomainService.Notification.RequestModel;
using Configuration.DomainService.Notification.ResponseModel;
using Blocks.Genesis.Entities.Data;
using Blocks.Genesis.Entities.Os;
using Configuration.DomainService.Notification.Propagation;
using Microsoft.Extensions.Logging;

namespace Configuration.DomainService.Shared.Services
{
    public class ConfigurationService : IConfigurationService
    {
        private readonly IConfigurationRepository _configurationRepository;
        private readonly IValidator<SaveNotificationConfigurationRequest> _notificatonConfigurationValidator;
        private readonly IMessageClient _messageClient;
        private readonly ITenants _tenants;
        private readonly ILogger<ConfigurationService> _logger;


        public ConfigurationService(IConfigurationRepository configurationRepository,
                                    IValidator<SaveNotificationConfigurationRequest> notificatonConfigurationValidator,
                                    IMessageClient messageClient,
                                    ITenants tenants,
                                    ILogger<ConfigurationService> logger)
        {
            _tenants = tenants;
            _logger = logger;
            _configurationRepository = configurationRepository;
            _notificatonConfigurationValidator = notificatonConfigurationValidator;
            _messageClient = messageClient;
        }

        #region Notification

        public async Task<BaseResponse> SaveNotificationConfigurationAsync(SaveNotificationConfigurationRequest configuration)
        {
            var validationResult = await _notificatonConfigurationValidator.ValidateAsync(configuration);

            if (!validationResult.IsValid)
            {
                return new BaseResponse
                {
                    IsSuccess = false,
                    Errors = validationResult.Errors.ToDictionary(e => e.PropertyName, e => e.ErrorMessage)
                };
            }

            var stored = await _configurationRepository.GetNotificationConfigurationByNameAsync(configuration.Name);
            var storedIsBuiltIn = stored?.IsBuiltIn == true;
            var requestsBuiltIn = configuration.IsBuiltIn == true;

            // The tenant lookup runs only when a built-in config is involved, so custom saves cost what they did.
            var isRoot = (storedIsBuiltIn || requestsBuiltIn) && IsRootCaller();

            if (!storedIsBuiltIn && requestsBuiltIn && !isRoot)
            {
                return Refused(nameof(configuration.IsBuiltIn), Constants.OnlyRootTenantCanManageBuiltInNotificationConfiguration);
            }

            if (storedIsBuiltIn && !isRoot && ChangesReadOnlyField(stored!, configuration))
            {
                return Refused(nameof(configuration.IsBuiltIn), Constants.BuiltInNotificationConfigurationIsReadOnly);
            }

            var repoConfig = Map(stored, configuration, isRoot);

            if (configuration.IsDisabled == true && !repoConfig.CanBeDisabled())
            {
                return Refused(nameof(configuration.IsDisabled), Constants.NotificationConfigurationCannotBeDisabled);
            }

            await _configurationRepository.SaveNotificationConfigurationAsync(repoConfig);

            // Only a root change to a built-in config reaches the other tenants. Custom configs never travel.
            if (isRoot && (repoConfig.IsBuiltIn || storedIsBuiltIn))
            {
                return await PublishBuiltInChangeAsync(NotificationConfigurationChangeAction.Upsert, repoConfig);
            }

            return new BaseResponse { IsSuccess = true };
        }

        public async Task<GetNotificationConfigurationsResponse> GetNotificationConfigurationsAsync(GetNotificationConfigurationsRequest request)
        {
            return await _configurationRepository.GetNotificationConfigurationsAsync(request);
        }

        public async Task<NotificationConfiguration> GetNotificationConfigurationAsync(GetNotificationConfigurationRequest request)
        {
            return await _configurationRepository.GetNotificationConfigurationByIdAsync(request.ItemId);
        }

        public async Task<BaseResponse> DeleteNotificationConfigurationAsync(DeleteNotificationConfigurationRequest request)
        {
            var stored = string.IsNullOrWhiteSpace(request?.ItemId)
                ? null
                : await _configurationRepository.GetNotificationConfigurationByIdAsync(request.ItemId);

            if (stored?.IsBuiltIn != true)
            {
                return await _configurationRepository.DeleteNotificationConfigurationAsync(request!);
            }

            if (!IsRootCaller())
            {
                return Refused(nameof(request.ItemId), Constants.OnlyRootTenantCanManageBuiltInNotificationConfiguration);
            }

            var response = await _configurationRepository.DeleteNotificationConfigurationAsync(request!);
            if (!response.IsSuccess)
            {
                return response;
            }

            return await PublishBuiltInChangeAsync(NotificationConfigurationChangeAction.Delete, stored);
        }

        private static BaseResponse Refused(string field, string errorKey) => new()
        {
            IsSuccess = false,
            Errors = new Dictionary<string, string> { { field, errorKey } }
        };

        /// <summary>
        /// A built-in config is read-only for a non-root tenant except for <c>IsDisabled</c>. The portal re-sends
        /// every field, so a field sent with the stored value is not a change. Fields left out (null) are not a change.
        /// </summary>
        private static bool ChangesReadOnlyField(NotificationConfiguration stored, SaveNotificationConfigurationRequest request)
        {
            static bool SameText(string? a, string? b) => string.Equals(a ?? string.Empty, b ?? string.Empty, StringComparison.Ordinal);

            return stored.ChannelToNotify != request.ChannelToNotify
                || stored.NotificationType != request.NotificationType
                || stored.EnablePersistence != request.EnablePersistence
                || !SameText(stored.NotifyMethod, request.NotifyMethod)
                || (request.IsBuiltIn.HasValue && request.IsBuiltIn.Value != stored.IsBuiltIn)
                || (request.Description is not null && !SameText(stored.Description, request.Description))
                || (request.Importance.HasValue && request.Importance.Value != stored.Importance)
                || (request.Kind.HasValue && request.Kind.Value != stored.Kind)
                || (request.SourceService is not null && !SameText(stored.SourceService, request.SourceService))
                || (request.ConsumerAppRecommendation is not null && !SameText(stored.ConsumerAppRecommendation, request.ConsumerAppRecommendation))
                || (request.ConsumerAppNote is not null && !SameText(stored.ConsumerAppNote, request.ConsumerAppNote));
        }

        private static NotificationConfiguration Map(NotificationConfiguration? stored, SaveNotificationConfigurationRequest configuration, bool isRoot)
        {
            var repoConfig = stored ?? new NotificationConfiguration { ItemId = Guid.NewGuid().ToString(), CreatedDate = DateTime.UtcNow, CreatedBy = BlocksContext.GetContext()?.UserId };

            repoConfig.LastUpdatedDate = DateTime.UtcNow;
            repoConfig.LastUpdatedBy = BlocksContext.GetContext()?.UserId;
            repoConfig.Name = configuration.Name;
            repoConfig.ChannelToNotify = configuration.ChannelToNotify;
            repoConfig.NotificationType = configuration.NotificationType;
            repoConfig.EnablePersistence = configuration.EnablePersistence;
            repoConfig.NotifyMethod = configuration.NotifyMethod;

            // Null = not sent = keep the stored value. Only the root tenant ever sets IsBuiltIn; the read-only check
            // above has already refused any other field change a non-root caller sent for a built-in config.
            if (isRoot && configuration.IsBuiltIn.HasValue) repoConfig.IsBuiltIn = configuration.IsBuiltIn.Value;
            if (configuration.IsDisabled.HasValue) repoConfig.IsDisabled = configuration.IsDisabled.Value;
            if (configuration.Description is not null) repoConfig.Description = NullIfEmpty(configuration.Description);
            if (configuration.Importance.HasValue) repoConfig.Importance = configuration.Importance.Value;
            if (configuration.Kind.HasValue) repoConfig.Kind = configuration.Kind.Value;
            if (configuration.SourceService is not null) repoConfig.SourceService = NullIfEmpty(configuration.SourceService);
            if (configuration.ConsumerAppRecommendation is not null) repoConfig.ConsumerAppRecommendation = NullIfEmpty(configuration.ConsumerAppRecommendation);
            if (configuration.ConsumerAppNote is not null) repoConfig.ConsumerAppNote = NullIfEmpty(configuration.ConsumerAppNote);

            return repoConfig;
        }

        // An empty string is stored as "not set", so it stays out of the stored document like any other default.
        private static string? NullIfEmpty(string value) => string.IsNullOrEmpty(value) ? null : value;

        /// <summary>
        /// Root = the caller's tenant is flagged <c>IsRootTenant</c>. Same signal as blocks-iam
        /// <c>IsRoot()</c> and <c>SecretAuthorizationService.IsRootTenant</c>. A lookup failure is never read as root.
        /// </summary>
        private bool IsRootCaller()
        {
            var tenantId = BlocksContext.GetContext()?.TenantId;
            if (string.IsNullOrWhiteSpace(tenantId))
            {
                return false;
            }

            try
            {
                return _tenants.GetTenantByID(tenantId)?.IsRootTenant == true;
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Tenant lookup failed while checking the root tenant. ErrorType={ErrorType}", ex.GetType().Name);
                return false;
            }
        }

        /// <summary>
        /// The change is already saved for the root tenant. If queuing fails, the save stands and the response says
        /// that the copy to other tenants was not queued; saving the config again queues it again (the copy is idempotent).
        /// </summary>
        private async Task<BaseResponse> PublishBuiltInChangeAsync(NotificationConfigurationChangeAction action, NotificationConfiguration configuration)
        {
            try
            {
                await _messageClient.SendToConsumerAsync(new ConsumerMessage<BuiltInNotificationConfigurationChangedEvent>
                {
                    ConsumerName = Constants.NotificationConfigurationQueue,
                    Payload = new BuiltInNotificationConfigurationChangedEvent
                    {
                        Action = action,
                        Name = configuration.Name,
                        SourceTenantId = BlocksContext.GetContext()?.TenantId ?? string.Empty,
                        Snapshot = configuration
                    }
                });

                return new BaseResponse { IsSuccess = true };
            }
            catch (Exception ex)
            {
                _logger.LogError(
                    ex,
                    "Built-in notification config saved but its copy to other tenants was not queued. Name={Name} Action={Action} ErrorType={ErrorType}",
                    configuration.Name, action, ex.GetType().Name);

                return new BaseResponse
                {
                    IsSuccess = true,
                    Errors = new Dictionary<string, string> { { "Propagation", Constants.NotificationConfigurationPropagationNotQueued } }
                };
            }
        }

        #endregion

    }
}

