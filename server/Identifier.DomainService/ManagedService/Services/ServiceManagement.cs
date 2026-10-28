using Azure.Identity;
using Azure.Messaging.ServiceBus.Administration;
using Azure.ResourceManager;
using Azure.ResourceManager.ServiceBus;
using Blocks.Genesis;
using Blocks.Secrets;
using DomainService.Shared;
using DomainService.Shared.Entities;
using FluentValidation;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
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

        /// <summary>
        /// Every connection string secret carries this name; the row's reference is what links it
        /// to a value. Read by blocks-logic's service listing through the same reference.
        /// </summary>
        public const string ConnectionStringSecretName = "service-bus-connection";

        public const string SecretStoreUnavailableError = "secret_store_unavailable";

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
        private readonly IServiceScopeFactory _scopeFactory;

        /// <param name="scopeFactory">
        /// This service is a singleton and <c>ISecretService</c> is scoped (it reads the
        /// request-scoped <see cref="BlocksContext"/>), so every secret call opens its own scope
        /// rather than capturing one service for the process lifetime.
        /// </param>
        [ExcludeFromCodeCoverage]
        public ServiceManagement(ILogger<ServiceManagement> logger,
                                 IServiceManagementRepository serviceManagementRepository,
                                 IValidator<RegisterServiceRequest> registerServiceRequestValidator,
                                 IBlocksSecret blocksSecret,
                                 ICacheClient cacheClient,
                                 ITenants tenants,
                                 IConfiguration configuration,
                                 IServiceScopeFactory scopeFactory)
        {
            _logger = logger;
            _scopeFactory = scopeFactory;
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

            // The connection string goes to Blocks Secrets in the caller's own context, whose
            // tenant is the row's TenantId (see Map), and the row keeps only the reference.
            string reference;
            try
            {
                reference = await WithSecretServiceAsync(secrets => secrets.SetAsync(new SetSecretRequest
                {
                    Name = ConnectionStringSecretName,
                    Type = SecretTypes.Service,
                    Value = connectionString,
                    Description = $"Managed service {service.ServiceId}"
                }));
            }
            catch (SecretVaultException exception)
            {
                // Only an unreachable vault is an availability answer; any other secret failure
                // propagates to the global SecretExceptionFilter. The exception itself is not
                // logged: the vault's inner error can name the secret.
                _logger.LogWarning(
                    "Secret store unavailable ({FailureType}); service {ServiceId} was not saved and its provisioned bus resources were left in place",
                    exception.GetType().Name, service.ServiceId);

                return new RegisterServiceResponse
                {
                    IsSuccess = false,
                    Errors = new Dictionary<string, string>
                    {
                        [SecretStoreUnavailableError] = "The secret store is unavailable. Try again later."
                    }
                };
            }

            service.ServiceBusConnectionStringReference = reference;
            service.ServiceBusConnectionString = string.Empty;

            try
            {
                await _serviceManagementRepository.SaveAsync(service);
            }
            catch
            {
                await RetireUnsavedSecretAsync(service.ServiceId, reference);
                throw;
            }

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

            var legacyCount = serviceList.Count(item => string.IsNullOrEmpty(item.ServiceBusConnectionStringReference));

            if (tenant is null && legacyCount > 0)
            {
                _logger.LogWarning(
                    "Tenant {TenantId} did not resolve; decrypting {Count} service(s) with the fallback key",
                    tenantId, legacyCount);
            }

            // After the move to the root DB, rows of one TenantId can carry two salts: the project salt
            // (registered without impersonation) and the console salt (registered impersonated). If the caller's
            // salt gives nothing, the root tenant's salt is tried. A wrong salt is safe (TryDecrypt returns false).
            // Step 2 = the other salts: the context tenant's own salt (matters when impersonating, where step 1
            // used the console's salt) and the root tenant's salt. Salts equal to step 1's are skipped.
            var firstSalt = tenant?.TenantSalt ?? FallbackEncryptionKey;
            // Built at most once, and only when a row needs it.
            var extraSalts = new Lazy<List<string>>(() => BuildExtraSalts(firstSalt));
            var keySource = tenant is null ? "fallback" : "tenant salt";

            var contextTenantId = BlocksContext.GetContext()?.TenantId;

            // One row at a time: a batch value read fails as a whole on one bad secret, and one
            // unreadable row must only blank that row.
            foreach (var item in serviceList)
            {
                // A non-empty reference is authoritative and the ciphertext field is not used.
                if (string.IsNullOrEmpty(item.ServiceBusConnectionStringReference))
                {
                    DecryptServiceItem(item, firstSalt, extraSalts, tenantId, keySource);
                }
                else
                {
                    item.ServiceBusConnectionString = await ReadReferencedConnectionStringAsync(item, contextTenantId);
                    item.ServiceType ??= "backend";
                }

                // The reference never leaves this service.
                item.ServiceBusConnectionStringReference = null;
            }

            return new GetAllServiceResponse
            {
                Data = serviceList.AsQueryable(),
                TotalCount = count
            };
        }

        /// <summary>
        /// One value read for one referenced row, in the caller's context. Any failure blanks only
        /// this row; the log carries the service id and the failure type, never the reference
        /// (an exception message can carry it).
        /// </summary>
        /// <remarks>
        /// The caller's tenant is the store the read reaches. The repository already lists only
        /// that tenant's rows; a row of another tenant is still refused here rather than looked up
        /// in the wrong store.
        /// </remarks>
        private async Task<string> ReadReferencedConnectionStringAsync(BlocksManagedService item, string? contextTenantId)
        {
            if (string.IsNullOrEmpty(contextTenantId)
                || (!string.IsNullOrEmpty(item.TenantId) && !string.Equals(item.TenantId, contextTenantId, StringComparison.Ordinal)))
            {
                _logger.LogError(
                    "Connection string for service {ServiceId} (tenant {RowTenantId}) was not read in tenant {ContextTenantId}; returning it empty",
                    item.ServiceId, item.TenantId, contextTenantId);
                return string.Empty;
            }

            try
            {
                return await WithSecretServiceAsync(secrets => secrets.GetValueAsync(item.ServiceBusConnectionStringReference!));
            }
            catch (Exception exception) when (exception is not OperationCanceledException)
            {
                _logger.LogError(
                    "Connection string for service {ServiceId} could not be read from Blocks Secrets ({FailureType}); returning it empty",
                    item.ServiceId, exception.GetType().Name);
                return string.Empty;
            }
        }

        /// <summary>
        /// Retires the secret a registration created when the row that would reference it was not
        /// saved. Every failure here is logged and swallowed so the save failure is what propagates.
        /// </summary>
        /// <remarks>
        /// An insert can fail after the server applied it (a lost acknowledgement), and retiring the
        /// secret then would blank a live service. So the row is read back first, and the secret is
        /// kept when the row turns out to reference it or the read-back itself fails: an orphaned
        /// secret is recoverable, a broken service is not.
        /// </remarks>
        private async Task RetireUnsavedSecretAsync(string serviceId, string reference)
        {
            try
            {
                var (rows, _) = await _serviceManagementRepository.GetAllServicesAsync(new GetAllServiceRequest
                {
                    Page = 0,
                    PageSize = 1,
                    Filter = new GetAllServiceFilter { ServiceId = serviceId }
                });

                if (rows.Any(row => string.Equals(row.ServiceBusConnectionStringReference, reference, StringComparison.Ordinal)))
                {
                    _logger.LogWarning(
                        "Saving service {ServiceId} reported a failure but the row was written; its connection string secret is kept",
                        serviceId);
                    return;
                }
            }
            catch (Exception exception)
            {
                _logger.LogWarning(
                    "Service {ServiceId} could not be read back after a failed save ({FailureType}); its connection string secret is kept",
                    serviceId, exception.GetType().Name);
                return;
            }

            try
            {
                await WithSecretServiceAsync(async secrets =>
                {
                    await secrets.DeleteAsync(reference);
                    return true;
                });
            }
            catch (Exception exception)
            {
                _logger.LogError(
                    "Service {ServiceId} was not saved and its new connection string secret could not be retired ({FailureType}). Reconcile it.",
                    serviceId, exception.GetType().Name);
            }
        }

        /// <summary>One secret call in its own DI scope, under the caller's context.</summary>
        private async Task<T> WithSecretServiceAsync<T>(Func<ISecretService, Task<T>> operation)
        {
            using var scope = _scopeFactory.CreateScope();
            return await operation(scope.ServiceProvider.GetRequiredService<ISecretService>());
        }

        private List<string> BuildExtraSalts(string firstSalt)
        {
            var list = new List<string>();
            var contextTenantId = BlocksContext.GetContext()?.TenantId;
            if (!string.IsNullOrEmpty(contextTenantId))
            {
                list.Add(_tenants.GetTenantByID(contextTenantId)?.TenantSalt ?? string.Empty);
            }
            var rootTenantId = configuration["RootTenantId"];
            if (!string.IsNullOrEmpty(rootTenantId))
            {
                list.Add(_tenants.GetTenantByID(rootTenantId)?.TenantSalt ?? string.Empty);
            }
            return list.Where(x => !string.IsNullOrEmpty(x) && x != firstSalt).Distinct().ToList();
        }

        private void DecryptServiceItem(
            BlocksManagedService item, string firstSalt, Lazy<List<string>> extraSalts, string tenantId, string keySource)
        {
            var plainText = DecryptConnectionString(item.ServiceBusConnectionString, firstSalt);

            if (plainText.Length == 0 && !string.IsNullOrEmpty(item.ServiceBusConnectionString))
            {
                plainText = DecryptWithExtraSalts(item.ServiceBusConnectionString, extraSalts.Value);

                if (plainText.Length == 0)
                {
                    _logger.LogError(
                        "Connection string for service {ServiceId} (tenant {TenantId}) could not be decrypted with " +
                        "the {KeySource} key; returning it empty",
                        item.ServiceId, tenantId, keySource);
                }
            }

            item.ServiceBusConnectionString = plainText;
            item.ServiceType = item.ServiceType ?? "backend";
        }

        private static string DecryptWithExtraSalts(string cipherText, List<string> extraSalts)
        {
            foreach (var extraSalt in extraSalts)
            {
                var plainText = DecryptConnectionString(cipherText, extraSalt);
                if (plainText.Length > 0) return plainText;
            }

            return string.Empty;
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