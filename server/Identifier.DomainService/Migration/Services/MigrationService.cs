using Blocks.Genesis;
using DomainService.Dtos;
using DomainService.Migration.Services;
using DomainService.Shared;
using FluentValidation;
using Identifier.DomainService.Shared.Dtos;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using System.Diagnostics.CodeAnalysis;
using System.Security.Cryptography;
using System.Text.Json;
using Blocks.Genesis.Entities.Os;
using Os.DataAccess;

namespace DomainService.Migration
{
    public class MigrationService : IMigrationService
    {
        private const string ErrorMessageKey = "message";
        private const string InvalidTwoFactorIdError = "invalid_two_factor_id";
        private const string RootTenantIdConfigKey = "RootTenantId";

        private readonly ICacheClient _cacheClient;
        private readonly IMessageClient _messageClient;
        private readonly IDbContextProvider _dbContextProvider;
        private readonly IOsDataAccess _dataAccess;
        private readonly IValidator<MigrationRequest> _migrationRequestValidator;
        private readonly IMigrationRepository _migrationRepository;
        private readonly IConfiguration _configuration;
        private readonly ITenants _tenants;
        private readonly ICryptoService _cryptoService;
        private readonly IHttpService _httpService;
        private readonly ILogger<MigrationService> _logger;

        [SuppressMessage("Major Code Smell", "S107:Methods should not have too many parameters", Justification = "DI constructor: each parameter is an injected dependency.")]
        public MigrationService(
            ICacheClient cacheClient,
            IMessageClient messageClient,
            IDbContextProvider dbContextProvider,
            IValidator<MigrationRequest> migrationRequestValidator,
            IMigrationRepository migrationRepository,
            IConfiguration configuration,
            ITenants tenants,
            ICryptoService cryptoService,
            IHttpService httpService,
            ILogger<MigrationService> logger,
            IOsDataAccess dataAccess)
        {
            _dataAccess = dataAccess;
            _cacheClient = cacheClient;
            _messageClient = messageClient;
            _dbContextProvider = dbContextProvider;
            _migrationRequestValidator = migrationRequestValidator;
            _configuration = configuration;
            _migrationRepository = migrationRepository;
            _tenants = tenants;
            _cryptoService = cryptoService;
            _httpService = httpService;
            _logger = logger;
        }

        [SuppressMessage("Major Code Smell", "S2139:Exceptions should be either logged or rethrown but not both", Justification = "The global exception middleware logs this exception but not the ProjectKey/TargetedProjectKey logged here; wrapping is not possible because the middleware maps the exception type to the HTTP status and returns its message as the problem detail.")]
        public async Task<MigrationOtpGenerationResponse> Migrate(MigrationRequest request)
        {
            try
            {
                var validationResult = await _migrationRequestValidator.ValidateAsync(request);
                if (!validationResult.IsValid)
                {
                    var validationErrors = validationResult.Errors.ToDictionary(e => e.PropertyName, e => e.ErrorMessage);
                    _logger.LogWarning("Migration request validation failed. ProjectKey: {ProjectKey}, Errors: {@ValidationErrors}",
                        request?.ProjectKey, validationErrors);
                    return new MigrationOtpGenerationResponse { IsSuccess = false, Errors = validationErrors };
                }
                _logger.LogDebug("Migration request validation succeeded for ProjectKey: {ProjectKey}", request.ProjectKey);

                var bc = BlocksContext.GetContext();

                var userDetails = await _migrationRepository.GetUserByIdAsync(bc.UserId);

                if (userDetails == null || string.IsNullOrEmpty(userDetails.Email))
                {
                    _logger.LogWarning("User details not found or missing email during migration. ProjectKey: {ProjectKey}, UserId: {UserId}",
                        request.ProjectKey, bc.UserId);
                    return new MigrationOtpGenerationResponse { IsSuccess = false, Errors = new Dictionary<string, string> { { ErrorMessageKey, "user_details_not_found" } } };
                }

                var code = GenerateSecureRandomNumber();
                var verificationId = Guid.NewGuid().ToString();

                // IssuedToUserId binds the code to whoever started the migration: Verify
                // asserts against it, so holding a verification id is not on its own enough
                // to finish somebody else's migration.
                var serializedData = JsonSerializer.Serialize(new
                {
                    Code = code,
                    Request = request,
                    IssuedToUserId = BlocksContext.GetContext()?.UserId ?? string.Empty
                });

                await _cacheClient.AddStringValueAsync(verificationId, serializedData, 600);
                _logger.LogInformation("Migration OTP cached successfully. VerificationId: {VerificationId}, Email: {Email}, ExpirySeconds: {ExpirySeconds}",
                    verificationId, userDetails.Email, 600);

                var result = await SendMfaCodeAsync(userDetails.Email, code, "en-US");
                if (!result)
                {
                    _logger.LogError("Failed to send MFA OTP email. VerificationId: {VerificationId}, Email: {Email}", verificationId, userDetails.Email);
                }
                else
                {
                    _logger.LogInformation("Migration OTP email sent successfully. VerificationId: {VerificationId}, Email: {Email}",
                        verificationId, userDetails.Email);
                }

                return new MigrationOtpGenerationResponse { VerificationId = verificationId, IsSuccess = result };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Unexpected error occurred during migration OTP generation. ProjectKey: {ProjectKey}, TargetedProjectKey: {TargetedProjectKey}",
                    request?.ProjectKey, request?.TargetedProjectKey);
                throw;
            }
        }
        public static string GenerateSecureRandomNumber()
        {
            using var rng = RandomNumberGenerator.Create();
            var bytes = new byte[2];
            rng.GetBytes(bytes);
            int number = BitConverter.ToUInt16(bytes, 0) % 88889 + 11111;
            return number.ToString();
        }

        private async Task<bool> SendMfaCodeAsync(string email, string code, string language)
        {
            _logger.LogDebug("Preparing MFA email. Email: {Email}, Purpose: MfaViaEmail, Language: {Language}", email, language ?? "en-US");

            var sendMailCommand = new SendMail
            {
                Cc = Array.Empty<string>(),
                Bcc = Array.Empty<string>(),
                BodyDataContext = new Dictionary<string, string>
                                {
                                   { "TwoFactorCode", code }
                                },

                Purpose = "MfaViaEmail",
                Language = language ?? "en-US",
                To = [email]
            };

            // Same checks the retired mail driver ran in the request; a failure queues nothing.
            var failedCheck = await MailPreCheck.FindFailureAsync(
                _dbContextProvider, _dataAccess, sendMailCommand.Purpose, sendMailCommand.Language, sendMailCommand.To, sendPhoneNumberAsEmail: false, sendMailCommand.BodyDataContext);
            if (failedCheck != null)
            {
                _logger.LogError("MailDriver failed to send MFA email. Email: {Email}, Purpose: {Purpose}, FailedCheck: {FailedCheck}", email, sendMailCommand.Purpose, failedCheck);
                return false;
            }

            try
            {
                await _messageClient.SendToConsumerAsync(
                    new ConsumerMessage<SendMail>
                    {
                        ConsumerName = IdentifierConstants.MailQueue,
                        Payload = sendMailCommand
                    });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to queue MFA email. Email: {Email}, Purpose: {Purpose}", email, sendMailCommand.Purpose);
                return false;
            }

            _logger.LogDebug("MFA email dispatched via MailDriver successfully. Email: {Email}", email);

            return true;
        }

        public async Task<MigrationOtpVerificationResponse> VerifyAsync(MigrationVerifyOtpRequest request)
        {
            var isKeyExist = await _cacheClient.KeyExistsAsync(request.VerificationId);

            if (!isKeyExist)
            {
                return new MigrationOtpVerificationResponse { Errors = new Dictionary<string, string> { { ErrorMessageKey, InvalidTwoFactorIdError } }, IsSuccess = false, IsValid = false };
            }

            var keyValue = await _cacheClient.GetStringValueAsync(request.VerificationId);
            if (string.IsNullOrEmpty(keyValue))
            {
                return new MigrationOtpVerificationResponse { Errors = new Dictionary<string, string> { { ErrorMessageKey, InvalidTwoFactorIdError } }, IsSuccess = false, IsValid = false };
            }

            var data = JsonSerializer.Deserialize<MigrationOtpData>(keyValue);
            if (data == null)
            {
                return new MigrationOtpVerificationResponse { Errors = new Dictionary<string, string> { { ErrorMessageKey, InvalidTwoFactorIdError } }, IsSuccess = false, IsValid = false };
            }

            // The endpoint's ProjectPolicy attribute decides whether this person may migrate this project,
            // and this check decides whether the migration is theirs. Both must pass, not either.
            var callerId = BlocksContext.GetContext()?.UserId ?? string.Empty;
            if (!string.IsNullOrEmpty(data.IssuedToUserId) && data.IssuedToUserId != callerId)
            {
                return new MigrationOtpVerificationResponse { Errors = new Dictionary<string, string> { { ErrorMessageKey, InvalidTwoFactorIdError } }, IsSuccess = false, IsValid = false };
            }

            if (data.Code == request.VerificationCode)
            {
                await _cacheClient.RemoveKeyAsync(request.VerificationId);
                await HandleServiceMigrations(data.Request);
                await NotifyMigrationStarted(data.Request.ProjectKey, data.Request.TargetedProjectKey);
                return new MigrationOtpVerificationResponse { IsSuccess = true, IsValid = true };
            }

            return new MigrationOtpVerificationResponse { Errors = new Dictionary<string, string> { { ErrorMessageKey, "invalid_two_factor_code" } }, IsSuccess = false, IsValid = false };
        }

        private async Task HandleServiceMigrations(MigrationRequest request)
        {
            // Create migration tracker
            var migrationTracker = new MigrationTracker
            {
                ItemId = Guid.NewGuid().ToString(),
                ProjectKey = request.ProjectKey,
                TargetedProjectKey = request.TargetedProjectKey,
                TenantGroupId = request.TenantGroupId,
                CreatedDate = DateTime.UtcNow,
                LastUpdatedDate = DateTime.UtcNow,
                CreatedBy = BlocksContext.GetContext()?.UserId ?? "system",
                LastUpdatedBy = BlocksContext.GetContext()?.UserId ?? "system"
            };

            // Set up service properties based on requested services
            foreach (var service in request.Services)
            {
                var serviceStatus = new ServiceMigrationStatus
                {
                    ShouldOverWriteExistingData = service.ShouldOverWriteExistingData,
                    QueueName = GetQueueNameForService(service.ServiceName)
                };

                SetServiceProperty(migrationTracker, service.ServiceName, serviceStatus);
            }

            var trackerId = await _migrationRepository.CreateMigrationTrackerAsync(migrationTracker);

            // Process each service
            foreach (var serviceName in request.Services.Select(service => service.ServiceName))
            {
                var queueName = GetQueueNameForService(serviceName);
                if (!string.IsNullOrEmpty(queueName))
                {
                    Console.WriteLine($"Sending migration event for service: {serviceName}, Queue: {queueName}, TrackerId: {trackerId}");
                    await SendMigrationEvent(request, serviceName, queueName, trackerId);
                }
                // If queueName is null/empty, service migration is not yet implemented
            }
        }

        private static void SetServiceProperty(MigrationTracker tracker, MigrationServiceNames serviceName, ServiceMigrationStatus status)
        {
            switch (serviceName)
            {
                case MigrationServiceNames.Authentication:
                    tracker.Authentication = status;
                    break;
                case MigrationServiceNames.IAM:
                    tracker.IAM = status;
                    break;
                case MigrationServiceNames.MFA:
                    tracker.MFA = status;
                    break;
                case MigrationServiceNames.CAPTCHA:
                    tracker.CAPTCHA = status;
                    break;
                case MigrationServiceNames.Email:
                    tracker.Email = status;
                    break;
                case MigrationServiceNames.DataGateway:
                    tracker.DataGateway = status;
                    break;
                case MigrationServiceNames.Notifications:
                    tracker.Notifications = status;
                    break;
                case MigrationServiceNames.Storage:
                    tracker.Storage = status;
                    break;
                case MigrationServiceNames.Language:
                    tracker.LanguageService = status;
                    break;
            }
        }

        private static string GetQueueNameForService(MigrationServiceNames serviceName)
        {
            return serviceName switch
            {
                MigrationServiceNames.Language => IdentifierConstants.LanguageDataMigrationQueue,
                MigrationServiceNames.IAM => IdentifierConstants.IamQueue,
                MigrationServiceNames.Email => IdentifierConstants.GenericMigrationQueue,
                MigrationServiceNames.Authentication => "", // Not migrated yet: no queue name defined for the Authentication service
                MigrationServiceNames.MFA => "", // Not migrated yet: no queue name defined for the MFA service
                MigrationServiceNames.CAPTCHA => "", // Not migrated yet: no queue name defined for the CAPTCHA service
                MigrationServiceNames.DataGateway => IdentifierConstants.GenericMigrationQueue,
                MigrationServiceNames.Notifications => "", // Not migrated yet: no queue name defined for the Notifications service
                MigrationServiceNames.Storage => "", // Not migrated yet: no queue name defined for the Storage service
                _ => "" // Unknown service
            };
        }


        private async Task SendMigrationEvent(MigrationRequest request, MigrationServiceNames serviceName, string queueName, string? trackerId = null)
        {
            await _messageClient.SendToConsumerAsync(
                new ConsumerMessage<Dtos.EnvironmentDataMigrationEvent>
                {
                    ConsumerName = queueName,
                    Payload = new Dtos.EnvironmentDataMigrationEvent
                    {
                        ProjectKey = request.ProjectKey,
                        TargetedProjectKey = request.TargetedProjectKey,
                        ShouldOverWriteExistingData = request.Services.Any(s => s.ServiceName == serviceName && s.ShouldOverWriteExistingData),
                        TrackerId = trackerId // Add trackerId to the payload
                    }
                }
            );
        }

        public async Task<bool> NotifyDataMigrationProgress(bool response, string projectKey, string targetedProjectKey)
        {
            var requestData = new
            {
                ConnectionId = projectKey,
                Roles = new List<string> { },
                UserIds = new List<string> { BlocksContext.GetContext()?.UserId ?? "" },
                DenormalizedPayload = JsonSerializer.Serialize(new
                {
                    IsSuccess = response,
                    title = response ? "Migration Completed": "Migration failed",
                    projectKey = projectKey,
                    targetedProjectKey = targetedProjectKey
                }),
                SaveDenormalizedPayloadAsAnObject = false,
                ConfigurationName = "DataMigrationProgress",
                ContentAvailable = true,
                ResponseKey = "Environment Data Migration",
                ResponseValue = response ? "Migration completed" : "Migration failed"
            };

            var blocksKey = _configuration[RootTenantIdConfigKey];
            var rootTenantId = _configuration[RootTenantIdConfigKey];
            var salt = _tenants.GetTenantByID(rootTenantId)?.TenantSalt;
            var actulalSecret = _cryptoService.Hash(rootTenantId, salt);

            var url = _configuration["NotificationServiceUrl"];
            var headers = new Dictionary<string, string>
            {
                { "x-blocks-key", blocksKey },
                { "Secret", actulalSecret}
            };

            var (data, _) = await _httpService.Post<NotificationResponse>(requestData, url, "application/json", headers);
            return data != null && data.isSuccess;
        }

        public async Task<bool> NotifyEnvironmentDataMigration(bool response, string projectKey, string targetedProjectKey)
        {
            var requestData = new
            {
                ConnectionId = projectKey,
                Roles = new List<string> { },
                UserIds = new List<string> { BlocksContext.GetContext()?.UserId ?? "" },
                DenormalizedPayload = JsonSerializer.Serialize(new
                {
                    IsSuccess = response,
                    title = "Migration Completed",
                    description = $"Migration {(response ? "completed successfully" : "failed")}",
                    projectKey = projectKey,
                    targetedProjectKey = targetedProjectKey
                }),
                SaveDenormalizedPayloadAsAnObject = false,
                ConfigurationName = "EnvironmentDataMigration",
                ContentAvailable = true,
                ResponseKey = "Environment Data Migration",
                ResponseValue = response ? "Migration completed" : "Migration failed"
            };

            var blocksKey = _configuration[RootTenantIdConfigKey];
            var rootTenantId = _configuration[RootTenantIdConfigKey];
            var salt = _tenants.GetTenantByID(rootTenantId)?.TenantSalt;
            var actulalSecret = _cryptoService.Hash(rootTenantId, salt);

            var url = _configuration["NotificationServiceUrl"];
            var headers = new Dictionary<string, string>
            {
                { "x-blocks-key", blocksKey },
                { "Secret", actulalSecret}
            };

            var (data, _) = await _httpService.Post<NotificationResponse>(requestData, url, "application/json", headers);
            return data != null && data.isSuccess;
        }

        public async Task<bool> NotifyServiceDataMigrationProgress(bool response, string projectKey, string targetedProjectKey)
        {
            return await NotifyDataMigrationProgress(response, projectKey, targetedProjectKey);
        }

        public async Task<bool> NotifyDataMigrationEvent(bool response, string projectKey, string targetedProjectKey)
        {
            return await NotifyEnvironmentDataMigration(response, projectKey, targetedProjectKey);
        }

        public async Task<bool> NotifyMigrationStarted(string projectKey, string targetedProjectKey)
        {
            var requestData = new
            {
                ConnectionId = projectKey,
                Roles = new List<string> { },
                UserIds = new List<string> { BlocksContext.GetContext()?.UserId ?? "" },
                DenormalizedPayload = JsonSerializer.Serialize(new
                {
                    IsSuccess = true,
                    title = "Migration Started",
                    description = "Environment data migration has been initiated successfully",
                    projectKey = projectKey,
                    targetedProjectKey = targetedProjectKey
                }),
                SaveDenormalizedPayloadAsAnObject = false,
                ConfigurationName = "EnvironmentDataMigration",
                ContentAvailable = true,
                ResponseKey = "Environment Data Migration",
                ResponseValue = "Migration started"
            };

            var blocksKey = _configuration[RootTenantIdConfigKey];
            var rootTenantId = _configuration[RootTenantIdConfigKey];
            var salt = _tenants.GetTenantByID(rootTenantId)?.TenantSalt;
            var actulalSecret = _cryptoService.Hash(rootTenantId, salt);

            var url = _configuration["NotificationServiceUrl"];
            var headers = new Dictionary<string, string>
            {
                { "x-blocks-key", blocksKey },
                { "Secret", actulalSecret}
            };

            var (data, _) = await _httpService.Post<NotificationResponse>(requestData, url, "application/json", headers);
            return data != null && data.isSuccess;
        }

        public bool AreAllServicesCompleted(MigrationTracker tracker)
        {
            var services = new List<ServiceMigrationStatus?>
            {
                tracker.Authentication,
                tracker.IAM,
                tracker.MFA,
                tracker.CAPTCHA,
                tracker.Email,
                tracker.DataGateway,
                tracker.Notifications,
                tracker.Storage,
                tracker.LanguageService
            };

            var activeServices = services.Where(s => s != null).ToList();
            return activeServices.Any() && activeServices.All(s => s!.IsCompleted);
        }

        public async Task MigrateEnvironmentDataAsync(string projectKey, string targetedProjectKey, bool shouldOverwriteExistingData, string trackerId)
        {
            var tracker = await _migrationRepository.GetMigrationTrackerAsync(trackerId);
            if (tracker == null)
            {
                _logger.LogError("Migration tracker not found for trackerId: {TrackerId}", trackerId);
                return;
            }

            // Get incomplete services that use GenericMigrationQueue
            var incompleteGenericServices = GetIncompleteServicesUsingGenericQueue(tracker);

            if (!incompleteGenericServices.Any())
            {
                _logger.LogInformation("No incomplete services using GenericMigrationQueue found for trackerId: {TrackerId}", trackerId);
                return;
            }

            _logger.LogInformation("Found {Count} incomplete services using GenericMigrationQueue for trackerId: {TrackerId}",
                incompleteGenericServices.Count, trackerId);

            // Migrate collections for each incomplete service
            foreach (var serviceName in incompleteGenericServices)
            {
                try
                {
                    var requiredCollections = GetRequiredCollectionsForService(serviceName);
                    _logger.LogInformation("Migrating {CollectionCount} collections for service {ServiceName}",
                        requiredCollections.Count, serviceName);

                    await MigrateServiceCollections(projectKey, targetedProjectKey, shouldOverwriteExistingData,
                        serviceName, requiredCollections, trackerId);

                    _logger.LogInformation("Successfully migrated collections for service {ServiceName}", serviceName);
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Error migrating collections for service {ServiceName} in trackerId: {TrackerId}",
                        serviceName, trackerId);

                    // Send completion event for failed migration
                    await SendMigrationCompletionEvent(trackerId, serviceName, false, ex.Message);
                }
            }
        }

        private static List<MigrationServiceNames> GetIncompleteServicesUsingGenericQueue(MigrationTracker tracker)
        {
            var incompleteServices = new List<MigrationServiceNames>();

            // Map each service property to its corresponding enum and check if it uses GenericMigrationQueue
            var serviceMapping = new Dictionary<MigrationServiceNames, ServiceMigrationStatus?>
            {
                { MigrationServiceNames.Authentication, tracker.Authentication },
                { MigrationServiceNames.IAM, tracker.IAM },
                { MigrationServiceNames.MFA, tracker.MFA },
                { MigrationServiceNames.CAPTCHA, tracker.CAPTCHA },
                { MigrationServiceNames.Email, tracker.Email },
                { MigrationServiceNames.DataGateway, tracker.DataGateway },
                { MigrationServiceNames.Notifications, tracker.Notifications },
                { MigrationServiceNames.Storage, tracker.Storage },
                { MigrationServiceNames.Language, tracker.LanguageService }
            };

            foreach (var kvp in serviceMapping)
            {
                var serviceName = kvp.Key;
                var serviceStatus = kvp.Value;

                // Check if service is tracked and not completed
                if (serviceStatus != null && !serviceStatus.IsCompleted)
                {
                    // Check if this service uses GenericMigrationQueue
                    var queueName = GetQueueNameForService(serviceName);
                    if (queueName == IdentifierConstants.GenericMigrationQueue)
                    {
                        incompleteServices.Add(serviceName);
                    }
                }
            }

            return incompleteServices;
        }

        private static List<string> GetRequiredCollectionsForService(MigrationServiceNames serviceName)
        {
            return serviceName switch
            {
                MigrationServiceNames.DataGateway => new List<string>
                {
                    "SchemaDefinitions",
                    "DataAccessPolicys",
                    "DataValidations"
                },
                MigrationServiceNames.Email => new List<string>
                {
                    "EmailTemplates"
                },
                MigrationServiceNames.Authentication => new List<string>
                {
                    // "AuthProviders",
                    // "AuthConfigurations",
                    // "AuthTokens",
                    // "OAuthSettings"
                },
                MigrationServiceNames.MFA => new List<string>
                {
                    // "MfaSettings",
                    // "MfaDevices",
                    // "MfaBackupCodes"
                },
                MigrationServiceNames.CAPTCHA => new List<string>
                {
                    // "CaptchaSettings",
                    // "CaptchaProviders"
                },
                MigrationServiceNames.Notifications => new List<string>
                {
                    // "NotificationTemplates",
                    // "NotificationSettings",
                    // "NotificationChannels",
                    // "NotificationSubscriptions"
                },
                MigrationServiceNames.Storage => new List<string>
                {
                    // "StorageConfigurations",
                    // "StorageProviders",
                    // "FileMetadata",
                    // "StoragePolicies"
                },
                _ => new List<string>() // Return empty list for services not using GenericMigrationQueue
            };
        }

        private async Task MigrateServiceCollections(string projectKey, string targetedProjectKey,
            bool shouldOverwriteExistingData, MigrationServiceNames serviceName,
            List<string> requiredCollections, string trackerId)
        {
            try
            {
                _logger.LogInformation("Starting migration of {CollectionCount} collections for service {ServiceName} from {ProjectKey} to {TargetedProjectKey}",
                    requiredCollections.Count, serviceName, projectKey, targetedProjectKey);

                foreach (var collectionName in requiredCollections)
                {
                    await MigrateCollection(projectKey, targetedProjectKey, collectionName, shouldOverwriteExistingData);
                    _logger.LogDebug("Successfully migrated collection {CollectionName} for service {ServiceName}",
                        collectionName, serviceName);
                }

                // Send completion event for successful migration
                await SendMigrationCompletionEvent(trackerId, serviceName, true, null);
                _logger.LogInformation("Completed migration of all collections for service {ServiceName}", serviceName);
            }
            catch (Exception ex)
            {
                // Logged by the caller (MigrateEnvironmentDataAsync) with ServiceName and TrackerId.
                // Send completion event for failed migration
                await SendMigrationCompletionEvent(trackerId, serviceName, false, ex.Message);
                throw;
            }
        }

        [SuppressMessage("Major Code Smell", "S2139:Exceptions should be either logged or rethrown but not both", Justification = "Only this log names the failing collection; wrapping would change ex.Message, which callers persist as the tracker ErrorMessage in the migration completion event.")]
        private async Task MigrateCollection(string sourceProjectKey, string targetProjectKey,
            string collectionName, bool shouldOverwriteExistingData)
        {
            try
            {
                _logger.LogDebug("Migrating collection {CollectionName} from {SourceProject} to {TargetProject}",
                    collectionName, sourceProjectKey, targetProjectKey);

                var (totalDocuments, migratedDocuments) = await _migrationRepository.MigrateCollectionAsync(sourceProjectKey, targetProjectKey,
                    collectionName, shouldOverwriteExistingData);

                _logger.LogInformation("Collection {CollectionName} migration completed: migrated {MigratedCount} out of {TotalCount} documents",
                    collectionName, migratedDocuments, totalDocuments);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to migrate collection {CollectionName} from {SourceProject} to {TargetProject}",
                    collectionName, sourceProjectKey, targetProjectKey);
                throw;
            }
        }

        private async Task SendMigrationCompletionEvent(string trackerId, MigrationServiceNames serviceName, bool isSuccess, string? errorMessage)
        {
            var completionEvent = new Dtos.MigrationCompletionEvent
            {
                TrackerId = trackerId,
                ServiceName = serviceName.ToString(),
                IsSuccess = isSuccess,
                ErrorMessage = errorMessage,
                CompletedAt = DateTime.UtcNow
            };

            await _messageClient.SendToConsumerAsync(
                new ConsumerMessage<Dtos.MigrationCompletionEvent>
                {
                    ConsumerName = IdentifierConstants.MigrationCompletionTopic,
                    Payload = completionEvent
                }
            );

            _logger.LogInformation("Migration completion event sent for service {ServiceName}, TrackerId: {TrackerId}, Success: {IsSuccess}",
                serviceName, trackerId, isSuccess);
        }

        public async Task<bool> DataCleanupAsync(DataCleanupRequest request)
        {
            if (request == null || string.IsNullOrWhiteSpace(request.ProjectKey))
            {
                _logger.LogWarning("DataCleanupAsync called with invalid request");
                return false;
            }

            try
            {
                var collectionsToClean = new List<string>
                {
                    "UilmFiles",
                    "BlocksLanguageModules",
                    "BlocksLanguageKeys",
                    "BlocksLanguages"
                };

                var cleanupTasks = collectionsToClean.Select(async collection =>
                {
                    await _migrationRepository.CleanupCollectionAsync(request.ProjectKey, collection);
                    _logger.LogInformation("Cleaned up collection {Collection} in project {ProjectKey}", collection, request.ProjectKey);
                });

                await Task.WhenAll(cleanupTasks);

                var migrationTasks = collectionsToClean.Select(async collection =>
                {
                    await _migrationRepository.MigrateDocumentsAsync(request.ProjectKey, collection);
                    _logger.LogInformation("Migrated documents for collection {Collection} in project {ProjectKey}", collection, request.ProjectKey);
                });

                await Task.WhenAll(migrationTasks);

                return true;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error during data cleanup for project {ProjectKey}", request.ProjectKey);
                return false;
            }
        }
    }
}
