using Blocks.Genesis;
using FluentValidation;
using Configuration.DomainService.Shared.Utilities;
using Configuration.DomainService.Notification.RequestModel;
using Configuration.DomainService.Notification.ResponseModel;
using Blocks.Genesis.Entities.Data;
using Blocks.Genesis.Entities.Os;
using Configuration.DomainService.Notification.Propagation;
using Configuration.DomainService.Notification.Services;
using Microsoft.Extensions.Logging;

namespace Configuration.DomainService.Shared.Services
{
    public class ConfigurationService : IConfigurationService
    {
        private readonly IConfigurationRepository _configurationRepository;
        private readonly IValidator<SaveNotificationConfigurationRequest> _notificatonConfigurationValidator;
        private readonly IMessageClient _messageClient;
        private readonly ITenants _tenants;
        private readonly INotificationAudienceGrantGuard _grantGuard;
        private readonly ILogger<ConfigurationService> _logger;


        public ConfigurationService(IConfigurationRepository configurationRepository,
                                    IValidator<SaveNotificationConfigurationRequest> notificatonConfigurationValidator,
                                    IMessageClient messageClient,
                                    ITenants tenants,
                                    INotificationAudienceGrantGuard grantGuard,
                                    ILogger<ConfigurationService> logger)
        {
            _grantGuard = grantGuard;
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
                    // One message per field: two rules failing on the same field must not break the response.
                    Errors = validationResult.Errors
                        .GroupBy(e => e.PropertyName)
                        .ToDictionary(g => g.Key, g => g.First().ErrorMessage)
                };
            }

            var stored = await _configurationRepository.GetNotificationConfigurationByNameAsync(configuration.Name);
            var storedIsBuiltIn = stored?.IsBuiltIn == true;
            var isRoot = NotificationSaveRules.NeedsRootCheck(stored, configuration) && IsRootCaller();

            var refusal = NotificationSaveRules.FindRefusal(stored, configuration, isRoot) ?? await FindGrantRefusalAsync(stored, configuration, isRoot);
            if (refusal is not null)
            {
                return Refused(refusal.Value.Field, refusal.Value.Key);
            }

            var repoConfig = NotificationSaveRules.Apply(stored, configuration, isRoot);

            refusal = NotificationSaveRules.FindMergedRefusal(repoConfig, configuration);
            if (refusal is not null)
            {
                return Refused(refusal.Value.Field, refusal.Value.Key);
            }

            await _configurationRepository.SaveNotificationConfigurationAsync(repoConfig);

            // Only a root change to a built-in config reaches the other tenants. Custom configs never travel.
            if (isRoot && (repoConfig.IsBuiltIn || storedIsBuiltIn))
            {
                return await PublishBuiltInChangeAsync(NotificationConfigurationChangeAction.Upsert, repoConfig);
            }

            return new BaseResponse { IsSuccess = true };
        }

        /// <summary>A non-root editor may add only roles and permissions they hold or manage (IAM grant scope).</summary>
        private async Task<SaveRefusal?> FindGrantRefusalAsync(NotificationConfiguration? stored, SaveNotificationConfigurationRequest request, bool isRoot)
        {
            if (isRoot || !NotificationSaveRules.PicksRolesOrPermissions(request.Audience) || NotificationSaveRules.IsLocked(stored, request, isRoot))
            {
                return null;
            }

            var key = await _grantGuard.FindRefusalAsync(request.Audience!, stored?.Audience);
            return key is null ? null : new SaveRefusal(nameof(request.Audience), key);
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

