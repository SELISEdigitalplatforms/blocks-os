using Azure.Identity;
using Azure.Messaging.ServiceBus.Administration;
using Azure.ResourceManager;
using Azure.ResourceManager.ServiceBus;
using Blocks.Genesis;
using DomainService.Shared;
using DomainService.Shared.Entities;
using FluentValidation;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using MongoDB.Driver.Linq;
using SeliseBlocks.LMT.Client;
using StackExchange.Redis;
using System.Diagnostics.CodeAnalysis;
using System.Text.Json;

namespace DomainService.ManagedService.Services
{
    public class ServiceManagement : IServiceManagement
    {
        private const string FallbackEncryptionKey = "LMT";

        private readonly ILogger<ServiceManagement> _logger;
        private readonly IValidator<RegisterServiceRequest> _registerServiceRequestValidator;
        private readonly IServiceManagementRepository _serviceManagementRepository;
        private readonly IBlocksSecret _blocksSecret;
        private readonly ICacheClient _cacheClient;
        private readonly ServiceBusAdministrationClient _adminClient;
        private readonly ITenants _tenants;
        private readonly ArmClient _armClient;
        private readonly string? _azureSubscriptionId;
        private readonly string? _azureResourceGroupName;
        private readonly IConfiguration configuration;

        [ExcludeFromCodeCoverage]
        public ServiceManagement(ILogger<ServiceManagement> logger,
                                 IServiceManagementRepository serviceManagementRepository,
                                 IValidator<RegisterServiceRequest> registerServiceRequestValidator,
                                 IBlocksSecret blocksSecret,
                                 ICacheClient cacheClient,
                                 ITenants tenants,
                                 IConfiguration configuration)
        {
            _logger = logger;
            _serviceManagementRepository = serviceManagementRepository;
            _registerServiceRequestValidator = registerServiceRequestValidator;
            _blocksSecret = blocksSecret;
            _cacheClient = cacheClient;
            this.configuration = configuration;
            _tenants = tenants;
            var isRabbitMq = IdentifierHelper.IsRabbitMq(_blocksSecret.LmtMessageConnectionString);
            if (!isRabbitMq)
            {
                _adminClient = new ServiceBusAdministrationClient(blocksSecret.LmtMessageConnectionString);
                //var configuration = new ConfigurationBuilder().AddEnvironmentVariables().Build();
                var azureTenantId = configuration["AZURE_TENANT_ID_LMT"];
                var azureClientId = configuration["AZURE_CLIENT_ID_LMT"];
                var azureClientSecret = configuration["AZURE_CLIENT_SECRET_LMT"];
                _azureSubscriptionId = configuration["AZURE_LMT_SUBSCRIPTION_ID"];
                _azureResourceGroupName = configuration["AZURE_LMT_RESOURCE_GROUP_NAME"];
                var credential = new ClientSecretCredential(azureTenantId, azureClientId, azureClientSecret);
                _armClient = new ArmClient(credential);
            }
        }

        public async Task<RegisterServiceResponse> RegisterServiceAsync(RegisterServiceRequest request)
        {
            var validationResult = await _registerServiceRequestValidator.ValidateAsync(request);

            if (!validationResult.IsValid)
            {
                return new RegisterServiceResponse
                {
                    IsSuccess = false,
                    Errors = validationResult.Errors.ToDictionary(
                        e => string.IsNullOrWhiteSpace(e.PropertyName) ? "validation_error" : e.PropertyName,
                        e => e.ErrorMessage)
                };
            }

            var service = Map(request);
            string connectionString;

            var isRabbitMq = IdentifierHelper.IsRabbitMq(_blocksSecret.LmtMessageConnectionString);

            if (isRabbitMq)
            {
                connectionString = await ProcessRabbitMqAsync(service);
            }
            else
            {
                connectionString = await ProcessLmtAsync(service);
            }

            var tenantId = ResolveEncryptionTenantId();
            var tenant = _tenants.GetTenantByID(tenantId);

            if (tenant is null)
            {
                // Encrypting under the fallback key writes a value that only decrypts while
                // the tenant stays unresolvable, so this is worth knowing about at write time.
                _logger.LogWarning(
                    "Tenant {TenantId} did not resolve; encrypting service {ServiceId} with the fallback key",
                    tenantId, service.ServiceId);
            }

            service.ServiceBusConnectionString = EncryptionHelper.Encrypt(connectionString, tenant?.TenantSalt ?? FallbackEncryptionKey);

            await _serviceManagementRepository.SaveAsync(service);

            var jsonString = JsonSerializer.Serialize(new ServiceUpdateMessage
            {
                Action = "add",
                ServiceId = service.ServiceId
            });

            await _cacheClient.PublishAsync("service::activity", jsonString);

            return new RegisterServiceResponse
            {
                IsSuccess = true,
                ItemId = service.ItemId,
                LogsServiceBusConnectionString = connectionString,
                ServiceId = service.ServiceId
            };
        }

        [ExcludeFromCodeCoverage]
        private async Task<string> ProcessLmtAsync(BlocksManagedService blocksManagedService)
        {
            LmtConfiguration.CreateCollectionForLogs(_blocksSecret.LogConnectionString, blocksManagedService.ServiceId);

            var topicName = LmtConstants.GetTopicName(blocksManagedService.ServiceId);

            var isTopicExists = await _adminClient.TopicExistsAsync(topicName);
            if (!isTopicExists)
            {
                var createTopicOptions = new CreateTopicOptions(topicName)
                {
                    MaxSizeInMegabytes = 1024 * 5,
                    DefaultMessageTimeToLive = TimeSpan.FromDays(14)
                };

                await _adminClient.CreateTopicAsync(createTopicOptions);
            }

            await Task.WhenAll(CreateSubscriptionWithFilterAsync(topicName, LmtConstants.LogSubscription),
                               CreateSubscriptionWithFilterAsync(topicName, LmtConstants.TraceSubscription));

            var connectionString = await AddSharedAccessPolicyAsync(topicName, blocksManagedService.ServiceId);

            return connectionString;
        }
        private Task<string> ProcessRabbitMqAsync(BlocksManagedService service)
        {
            LmtConfiguration.CreateCollectionForLogs(
                _blocksSecret.LogConnectionString,
                service.ServiceId
            );
            return Task.FromResult(_blocksSecret.LmtMessageConnectionString);
        }


        [ExcludeFromCodeCoverage]
        private async Task CreateSubscriptionWithFilterAsync(string topicName, string subscriptionName)
        {
            var subscriptionExists = await _adminClient.SubscriptionExistsAsync(topicName, subscriptionName);

            if (!subscriptionExists)
            {
                var subscriptionOptions = new CreateSubscriptionOptions(topicName, subscriptionName)
                {
                    DefaultMessageTimeToLive = TimeSpan.FromDays(7),
                    LockDuration = TimeSpan.FromMinutes(5),
                    MaxDeliveryCount = 3
                };

                var correlationRule = new CreateRuleOptions("CorrelationFilter", new CorrelationRuleFilter
                {
                    CorrelationId = subscriptionName
                });

                await _adminClient.CreateSubscriptionAsync(subscriptionOptions, correlationRule);
            }
        }

        [ExcludeFromCodeCoverage]
        private async Task<string> AddSharedAccessPolicyAsync(string topicName, string serviceId)
        {
            var topicPropertiesResponse = await _adminClient.GetTopicAsync(topicName);
            var topicProperties = topicPropertiesResponse.Value;

            var policyName = serviceId;
            var accessRights = new[] { AccessRights.Send };
            var sharedAccessPolicy = new SharedAccessAuthorizationRule(policyName, accessRights);

            bool ruleAlreadyExists = topicProperties.AuthorizationRules.Any(rule => rule.KeyName == policyName);

            if (!ruleAlreadyExists)
            {
                topicProperties.AuthorizationRules.Add(sharedAccessPolicy);
                await _adminClient.UpdateTopicAsync(topicProperties);
            }

            var connectionStringParts = _blocksSecret.LmtMessageConnectionString.Split(';')
                .Where(s => !string.IsNullOrWhiteSpace(s))
                .Select(s => s.Split(new[] { '=' }, 2))
                .Where(parts => parts.Length == 2)
                .ToDictionary(parts => parts[0].Trim(), parts => parts[1].Trim(), StringComparer.OrdinalIgnoreCase);

            var endpoint = connectionStringParts["Endpoint"];
            var namespaceName = endpoint
                .Replace("sb://", "")
                .Replace(".servicebus.windows.net/", "")
                .Replace(".servicebus.windows.net", "");

            var resourceId = ServiceBusTopicAuthorizationRuleResource.CreateResourceIdentifier(
                _azureSubscriptionId,
                _azureResourceGroupName,
                namespaceName,
                topicName,
                policyName
            );

            var authRuleResource = _armClient.GetServiceBusTopicAuthorizationRuleResource(resourceId);
            var keys = await authRuleResource.GetKeysAsync();

            return keys.Value.PrimaryConnectionString;
        }

        public BlocksManagedService Map(RegisterServiceRequest request)
        {
            var context = BlocksContext.GetContext();
            var userId = context?.UserId ?? "";

            return new BlocksManagedService
            {
                ItemId = Guid.NewGuid().ToString(),
                ServiceId = ("sb-" + Guid.NewGuid().ToString("n")).ToUpper(),
                Name = request.ServiceName,
                Metadata = request.Metadata,
                Description = request.Description ?? string.Empty,
                Tags = request.Tags,
                CreatedBy = userId,
                LastUpdatedBy = userId,
                CreatedDate = DateTime.UtcNow,
                LastUpdatedDate = DateTime.UtcNow,
                TenantId = context?.TenantId ?? "",
                ServiceType = request.ServiceType
            };
        }

        public async Task<GetAllServiceResponse> GetAllServicesAsync(GetAllServiceRequest request)
        {
            var (data, count) = await _serviceManagementRepository.GetAllServicesAsync(request);

            var tenantId = ResolveEncryptionTenantId();
            var tenant = _tenants.GetTenantByID(tenantId);

            var serviceList = data.ToList();

            if (tenant is null && serviceList.Count > 0)
            {
                _logger.LogWarning(
                    "Tenant {TenantId} did not resolve; decrypting {Count} service(s) with the fallback key",
                    tenantId, serviceList.Count);
            }

            foreach (var item in serviceList)
            {
                var plainText = DecryptConnectionString(
                    item.ServiceBusConnectionString,
                    tenant?.TenantSalt ?? FallbackEncryptionKey
                );

                if (plainText.Length == 0 && !string.IsNullOrEmpty(item.ServiceBusConnectionString))
                {
                    _logger.LogError(
                        "Connection string for service {ServiceId} (tenant {TenantId}) could not be decrypted with " +
                        "the {KeySource} key; returning it empty",
                        item.ServiceId, tenantId, tenant is null ? "fallback" : "tenant salt");
                }

                item.ServiceBusConnectionString = plainText;
                item.ServiceType = item.ServiceType ?? "backend";
            }

            return new GetAllServiceResponse
            {
                Data = serviceList.AsQueryable(),
                TotalCount = count
            };
        }

        // Connection strings are keyed on the salt of the tenant the caller authenticated
        // as, never the tenant being browsed. Under impersonation those differ: the token
        // carries the project in TenantId and the console's own tenant in OriginalTenantId,
        // and it is the latter that encrypted the value. Services registered before the
        // console moved to impersonation were written the same way, so honouring the
        // original tenant keeps those rows readable.
        private static string ResolveEncryptionTenantId()
        {
            var context = BlocksContext.GetContext();

            if (context is null)
            {
                return string.Empty;
            }

            return context.Impersonated && !string.IsNullOrEmpty(context.OriginalTenantId)
                ? context.OriginalTenantId
                : context.TenantId;
        }

        // A service registered while the tenant lookup was unresolved was encrypted with
        // the fallback key, so a salt that does not open the value is retried against it.
        // Anything neither key opens (a rotated salt) is blanked rather than failing the
        // whole listing on one unreadable row.
        private static string DecryptConnectionString(string cipherText, string salt)
        {
            if (EncryptionHelper.TryDecrypt(cipherText, salt, out var plainText))
            {
                return plainText;
            }

            if (salt != FallbackEncryptionKey &&
                EncryptionHelper.TryDecrypt(cipherText, FallbackEncryptionKey, out plainText))
            {
                return plainText;
            }

            return string.Empty;
        }
    }

    public class ServiceUpdateMessage
    {
        public string Action { get; set; }
        public string ServiceId { get; set; }
    }
}