using Blocks.Genesis;
using Blocks.Secrets;
using Configuration.DomainService.DataGateway.Entities;
using Configuration.DomainService.DataGateway.RequestModel;
using Configuration.DomainService.DataGateway.ResponseModel;
using Configuration.DomainService.Shared.Secrets;
using FluentValidation;
using Microsoft.Extensions.Logging;
using MongoDB.Bson;
using MongoDB.Driver;

namespace Configuration.DomainService.DataGateway.Services
{
    /// <summary>
    /// Data-source configuration (GET/save). The source of truth is the tenant's root doc
    /// (<c>BlocksRootDb.DataServiceConfigurations</c>, <c>_id = TenantId</c>). The connection string lives only in a Blocks
    /// <c>Service</c> secret named <c>data-source</c> (plain text, <c>default</c> = Blocks DB). Save follows
    /// <c>CaptchaConfigService.SaveAsync</c>: <c>SetAsync</c> first, <c>RotateAsync</c> on the same id later, and a new
    /// secret when the linked one is broken (archived or missing). Order: secret, then root doc, then Redis hash.
    /// </summary>
    public class DataGatewayConfigurationService : IDataGatewayConfigurationService
    {
        public const string DefaultValue = "default";
        public const string SecretName = "data-source";
        public const string SecretTag = "data";
        public const string SecretOrganizationId = "default";
        public const string SeedDatabaseName = "default";
        public const string SeedCollectionNamePattern = "sb_{SchemaName}s";

        public const string NotFoundMessage = "Data source not found.";
        public const string DeletedMessage = "The data source configuration of this project is deleted.";
        public const string RedisFailedMessage = "The data source was saved but not activated. Save again.";

        private readonly IDataGatewayRootStore _store;
        private readonly IValidator<SaveDataGatewayConfigurationRequest> _validator;
        private readonly ISecretService _secretService;
        private readonly ILogger<DataGatewayConfigurationService> _logger;

        public DataGatewayConfigurationService(
            IDataGatewayRootStore store,
            IValidator<SaveDataGatewayConfigurationRequest> validator,
            ISecretService secretService,
            ILogger<DataGatewayConfigurationService> logger)
        {
            _store = store;
            _validator = validator;
            _secretService = secretService;
            _logger = logger;
        }

        /// <summary>A real connection string (not null, blank or <c>default</c> in any case).</summary>
        public static bool IsCustom(string? value) =>
            !string.IsNullOrWhiteSpace(value) && !string.Equals(value.Trim(), DefaultValue, StringComparison.OrdinalIgnoreCase);

        /// <summary>Null, blank, <c>default</c>, or a string the MongoDB driver accepts. Never echoes the value.</summary>
        public static bool IsValidOrDefault(string? value)
        {
            if (!IsCustom(value))
                return true;
            try
            {
                _ = MongoClientSettings.FromConnectionString(value!.Trim());
                return true;
            }
            catch
            {
                return false;
            }
        }

        private static string TenantId() => BlocksContext.GetContext()?.TenantId ?? string.Empty;

        #region Get

        public async Task<DataGatewayConfigurationResponse?> GetDataGatewayConfigurationAsync()
        {
            var tenantId = TenantId();
            var root = await EnsureRootAsync(tenantId);
            if (root is null)
                return null;

            var isCustom = await IsCustomSecretAsync(tenantId, root.DbConnectionSecretId);
            return new DataGatewayConfigurationResponse
            {
                ItemId = root.ItemId,
                ConnectionType = isCustom ? DataGatewayRootStore.ConnectionTypeCustom : DataGatewayRootStore.ConnectionTypeDefault,
                ProjectKey = root.ProjectKey,
                ProjectShortKey = root.ProjectShortKey,
                DatabaseName = root.DatabaseName,
                IsCollectionNameEditable = root.IsCollectionNameEditable,
                CollectionNamePattern = root.CollectionNamePattern,
                AnalyticsConfiguration = root.AnalyticsConfiguration
            };
        }

        /// <summary>
        /// The live root doc. No doc: creates the default doc and a secret with the value <c>default</c> (insert only; the
        /// loser of a parallel create deletes its own new secret). A soft-deleted doc answers null.
        /// </summary>
        public async Task<DataGatewayConfiguration?> EnsureRootAsync(string tenantId)
        {
            if (string.IsNullOrWhiteSpace(tenantId))
                throw new InvalidOperationException("Tenant ID is missing in the current context.");

            var existing = await _store.GetRootAsync(tenantId, includeDeleted: true);
            if (existing is not null)
                return existing.IsDeleted ? null : existing;

            var secretId = await SetSecretAsync(DefaultValue);
            var root = Seed(tenantId, secretId);
            bool inserted;
            try
            {
                inserted = await _store.TryInsertRootAsync(root);
            }
            catch
            {
                await DeleteOwnSecretAsync(secretId);
                throw;
            }

            if (inserted)
            {
                _logger.LogInformation("DataGateway step=default-root-created tenant={TenantId}", tenantId);
                return root;
            }

            // Another request created it first: drop our own secret, use the winner's doc.
            await DeleteOwnSecretAsync(secretId);
            var winner = await _store.GetRootAsync(tenantId, includeDeleted: true);
            return winner is null || winner.IsDeleted ? null : winner;
        }

        /// <summary>
        /// Whether the linked secret holds a real connection string. Only the kind leaves this method. A locked, archived,
        /// missing or empty secret answers custom: at runtime such a tenant fails closed, so it must not look like Blocks DB.
        /// A secret-store outage fails the call.
        /// </summary>
        private async Task<bool> IsCustomSecretAsync(string tenantId, string secretId)
        {
            if (string.IsNullOrEmpty(secretId))
                return true;

            var status = await SecretStatusAsync(secretId, failOnError: true);
            if (status != LinkedSecretStatus.Active)
            {
                _logger.LogWarning("DataGateway step=get result=secret-unusable tenant={TenantId} state={State}", tenantId, status);
                return true;
            }

            try
            {
                return IsCustom(await _secretService.GetValueAsync(secretId));
            }
            catch (SecretException ex) when (ex is SecretStateException or SecretNotFoundException)
            {
                _logger.LogWarning("DataGateway step=get result=secret-unusable tenant={TenantId} state=value-missing", tenantId);
                return true;
            }
        }

        #endregion

        #region Save

        public async Task<BaseMutationResponse> SaveDataGatewayConfigurationAsync(SaveDataGatewayConfigurationRequest request)
        {
            var validation = await _validator.ValidateAsync(request);
            if (!validation.IsValid)
                return Refuse(validation.Errors.GroupBy(e => e.PropertyName).ToDictionary(g => g.Key, g => g.First().ErrorMessage));

            var tenantId = TenantId();
            var root = await EnsureRootAsync(tenantId);
            if (root is null)
                return Refuse("ItemId", NotFoundMessage);

            if (request.UpdateRequest && !string.Equals(root.ItemId, request.ItemId, StringComparison.Ordinal))
                return Refuse("ItemId", NotFoundMessage);

            // null on an update = keep the saved data source; blank / "default" = Blocks DB; anything else = the real string.
            string? value = request.ConnectionString is null && request.UpdateRequest
                ? null
                : IsCustom(request.ConnectionString) ? request.ConnectionString!.Trim() : DefaultValue;

            var secretId = root.DbConnectionSecretId;
            string? repairedSecretId = null;
            if (value is not null)
            {
                var status = await SecretStatusAsync(secretId, failOnError: false);
                if (string.IsNullOrEmpty(secretId) || LinkedSecretStatus.IsBroken(status))
                {
                    // A broken pointer cannot be rotated: new secret, same doc repointed at it (the old one is left as it is).
                    var isRepair = !string.IsNullOrEmpty(secretId);
                    secretId = await SetSecretAsync(value);
                    repairedSecretId = isRepair ? secretId : null;
                }
                else
                {
                    await _secretService.RotateAsync(secretId, new RotateSecretRequest { Value = value });
                }
            }

            var now = new DateTime(DataGatewayRootStore.VersionOf(DateTime.UtcNow), DateTimeKind.Utc);
            var databaseName = string.IsNullOrWhiteSpace(request.DatabaseName) ? root.DatabaseName : request.DatabaseName;
            var userId = BlocksContext.GetContext()?.UserId;
            var set = new BsonDocument
            {
                { nameof(DataGatewayConfiguration.DbConnectionSecretId), secretId },
                { nameof(DataGatewayConfiguration.DatabaseName), databaseName },
                { nameof(DataGatewayConfiguration.IsCollectionNameEditable), request.IsCollectionNameEditable },
                { nameof(DataGatewayConfiguration.LastUpdatedDate), now },
                { nameof(DataGatewayConfiguration.LastUpdatedBy), (BsonValue?)userId ?? BsonNull.Value },
            };
            if (!string.IsNullOrWhiteSpace(request.CollectionNamePattern))
                set[nameof(DataGatewayConfiguration.CollectionNamePattern)] = request.CollectionNamePattern;
            var analytics = ApplyAnalytics(root.AnalyticsConfiguration, request.EnableAnalytics);
            if (analytics is not null)
                set[nameof(DataGatewayConfiguration.AnalyticsConfiguration)] = analytics.ToBsonDocument();

            bool matched;
            try
            {
                matched = await _store.SetRootFieldsAsync(tenantId, set);
            }
            catch
            {
                await CompensateRepairAsync(repairedSecretId);
                throw;
            }

            if (!matched)
            {
                // Removed between the read above and this write.
                await CompensateRepairAsync(repairedSecretId);
                return Refuse("ItemId", NotFoundMessage);
            }

            var isCustom = value is not null ? IsCustom(value) : await IsCustomSecretAsync(tenantId, secretId);
            try
            {
                await _store.WriteHashAsync(tenantId, secretId, databaseName, isCustom, now);
            }
            catch (Exception ex)
            {
                _logger.LogError("DataGateway step=redis result=failed error={ErrorType} tenant={TenantId}", ex.GetType().Name, tenantId);
                return Refuse("Redis", RedisFailedMessage);
            }

            return new BaseMutationResponse { IsSuccess = true, ItemId = tenantId };
        }

        private static BaseMutationResponse Refuse(string key, string message) =>
            Refuse(new Dictionary<string, string> { { key, message } });

        private static BaseMutationResponse Refuse(Dictionary<string, string> errors) =>
            new() { IsSuccess = false, Errors = errors };

        /// <summary>The analytics doc after the request, or null when nothing changes.</summary>
        private static AnalyticsConfiguration? ApplyAnalytics(AnalyticsConfiguration? current, bool? enable)
        {
            if (!enable.HasValue)
                return null;

            var analytics = current ?? new AnalyticsConfiguration();
            if (enable.Value && !analytics.EnableDate.HasValue && !analytics.ValidTill.HasValue)
            {
                var enableDate = DateTime.UtcNow;
                analytics.EnableDate = enableDate;
                analytics.ValidTill = enableDate.AddDays(14);
            }

            analytics.EnableAnalytics = enable.Value;
            return analytics;
        }

        #endregion

        #region Secrets

        private Task<string> SetSecretAsync(string value) =>
            _secretService.SetAsync(new SetSecretRequest
            {
                Name = SecretName,
                Type = SecretTypes.Service,
                Tags = [SecretTag],
                OrganizationId = SecretOrganizationId,
                Value = value
            });

        /// <summary>Metadata read only. An outage is "unavailable", not broken, unless <paramref name="failOnError"/>.</summary>
        private async Task<string> SecretStatusAsync(string secretId, bool failOnError)
        {
            if (string.IsNullOrEmpty(secretId))
                return LinkedSecretStatus.Missing;
            try
            {
                return LinkedSecretStatus.FromMetadata(await _secretService.GetAsync(secretId));
            }
            catch (Exception ex)
            {
                _logger.LogWarning("DataGateway step=secret-status result=failed error={ErrorType}", ex.GetType().Name);
                if (failOnError)
                    throw;
                return LinkedSecretStatus.Unavailable;
            }
        }

        /// <summary>Best effort delete of a secret this code created itself (never throws).</summary>
        private async Task DeleteOwnSecretAsync(string secretId)
        {
            try
            {
                await _secretService.DeleteAsync(secretId, CancellationToken.None);
            }
            catch (Exception ex)
            {
                _logger.LogError("DataGateway step=own-secret-delete result=failed error={ErrorType}", ex.GetType().Name);
            }
        }

        private async Task CompensateRepairAsync(string? repairedSecretId)
        {
            if (!string.IsNullOrEmpty(repairedSecretId))
                await DeleteOwnSecretAsync(repairedSecretId);
        }

        #endregion

        /// <summary>The default root doc of a new tenant: the seed doc values (contract).</summary>
        internal static DataGatewayConfiguration Seed(string tenantId, string secretId)
        {
            var now = new DateTime(DataGatewayRootStore.VersionOf(DateTime.UtcNow), DateTimeKind.Utc);
            var userId = BlocksContext.GetContext()?.UserId;
            return new DataGatewayConfiguration
            {
                ItemId = tenantId,
                TenantId = tenantId,
                DbConnectionSecretId = secretId,
                DatabaseName = SeedDatabaseName,
                IsCollectionNameEditable = false,
                CollectionNamePattern = SeedCollectionNamePattern,
                ProjectKey = string.Empty,
                ProjectShortKey = string.Empty,
                AnalyticsConfiguration = null,
                CreatedDate = now,
                CreatedBy = userId,
                LastUpdatedDate = now,
                LastUpdatedBy = userId,
                IsDeleted = false
            };
        }
    }
}
