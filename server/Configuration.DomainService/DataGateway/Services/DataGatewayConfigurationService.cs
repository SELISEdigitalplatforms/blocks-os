using Blocks.Genesis;
using Blocks.Secrets;
using Configuration.DomainService.DataGateway.Entities;
using Configuration.DomainService.DataGateway.RequestModel;
using Configuration.DomainService.Shared.Services;
using FluentValidation;
using Microsoft.Extensions.Logging;
using MongoDB.Bson;
using MongoDB.Driver;
using StackExchange.Redis;

namespace Configuration.DomainService.DataGateway.Services
{
    /// <summary>
    /// Data-gateway GET/save (os SPEC2 X-3).
    /// <para>
    /// Switch OFF (<see cref="DataGatewayRootMode"/>): today's code on the tenant DB, moved here unchanged, plus
    /// the §6.1a refusal of an update whose target doc is a root doc.
    /// </para>
    /// <para>
    /// Switch ON: the source of truth is the caller's root doc (<c>BlocksRootDb.DataServiceConfigurations</c>,
    /// <c>_id = TenantId</c>, same contract as blocks-data SPEC1 §4); the connection string lives in a Blocks
    /// <c>service</c> secret and is read per call, never cached or stored. Saves write the root doc with a field
    /// <c>$set</c>, the tenant copy's non-secret fields only (owner "Stop writing"), and the Redis routing hash in
    /// one transaction.
    /// </para>
    /// Errors: no catch-all (os SPEC2 §6.5a). Secret errors go to <c>SecretExceptionFilter</c>, everything else to
    /// the Genesis middleware, as today. Handled on purpose: GET of a locked/deleted/missing secret (repair), the
    /// create DuplicateKey, the off-path DuplicateKey, the Redis transaction result.
    /// </summary>
    public class DataGatewayConfigurationService : IDataGatewayConfigurationService
    {
        public const string DefaultSentinel = "default";
        public const string SecretName = "data-source-connection";
        public const string SecretTag = "data";
        public const string SecretDescription = "Data source connection";
        public const string SecretOrganizationId = "default";

        public const string NotFoundMessage = "DataGateway configuration not found.";
        public const string AlreadyExistsMessage = "A DataGateway configuration already exists. Use update instead.";
        public const string NotMigratedMessage = "Data source not migrated yet. Ask ops to run the data migration job.";
        public const string RedisFailedMessage = "The data source was saved but not activated. Save again.";
        private const string ItemIdField = "ItemId";

        // Redis hash fields (blocks-data GqlDbRepository.HashField*): same names as the entity fields.
        public const string HashFieldSecretId = nameof(DataGatewayConfiguration.DbConnectionSecretId);
        public const string HashFieldDatabaseName = nameof(DataGatewayConfiguration.DatabaseName);
        public const string HashFieldVersion = "Version";
        public const string HashFieldLegacyConnectionString = nameof(DataGatewayConfiguration.DbConnectionString);

        /// <summary>Secret action of a switch-on update (os SPEC2 §6.5 step 2).</summary>
        public enum SecretAction { None, Rotate, Set, ToDefault }

        private readonly IConfigurationRepository _configurationRepository;
        private readonly IValidator<SaveDataGatewayConfigurationRequest> _validator;
        private readonly ISecretService _secretService;
        private readonly ICacheClient _cacheClient;
        private readonly DataGatewayRootMode _rootMode;
        private readonly ILogger<DataGatewayConfigurationService> _logger;

        public DataGatewayConfigurationService(
            IConfigurationRepository configurationRepository,
            IValidator<SaveDataGatewayConfigurationRequest> validator,
            ISecretService secretService,
            ICacheClient cacheClient,
            DataGatewayRootMode rootMode,
            ILogger<DataGatewayConfigurationService> logger)
        {
            _configurationRepository = configurationRepository;
            _validator = validator;
            _secretService = secretService;
            _cacheClient = cacheClient;
            _rootMode = rootMode;
            _logger = logger;
        }

        /// <summary>"default" in any case = the Blocks DB (today's data rule, StringHelper; decisions.md 2026-10-13).</summary>
        public static bool IsDefault(string? value) =>
            string.Equals(value, DefaultSentinel, StringComparison.OrdinalIgnoreCase);

        #region Get

        public async Task<DataGatewayConfiguration?> GetDataGatewayConfigurationAsync()
        {
            if (!_rootMode.IsOn)
            {
                return DecodeTenantCopy(await _configurationRepository.GetDataGatewayConfigurationAsync());
            }

            var tenantId = BlocksContext.GetContext()?.TenantId ?? string.Empty;
            var root = await _configurationRepository.GetDataGatewayRootAsync(tenantId);
            if (root == null)
            {
                // Not migrated yet (or soft-deleted root doc): today's answer from the tenant copy, or null → 204.
                return DecodeTenantCopy(await _configurationRepository.GetDataGatewayTenantCopyAsync());
            }

            root.ItemId = root.ConfigItemId ?? string.Empty;
            root.DbConnectionString = await ResolveForGetAsync(tenantId, root.DbConnectionSecretId);
            return root;
        }

        // Today's GET code: decode the base64 value of a tenant-DB doc.
        private static DataGatewayConfiguration? DecodeTenantCopy(DataGatewayConfiguration? configuration)
        {
            // Unlike Storage's masked secrets, blocks-data's own DataGatewayConfigurationService.GetConfiguration
            // returns the connection string decoded, not masked - the client needs the real value to
            // tell a platform-managed ("default") configuration apart from a custom one and to let an
            // admin edit an existing custom connection string.
            if (configuration != null && !string.IsNullOrEmpty(configuration.DbConnectionString))
            {
                configuration.DbConnectionString = System.Text.Encoding.UTF8.GetString(
                    Convert.FromBase64String(configuration.DbConnectionString));
            }

            return configuration;
        }

        /// <summary>
        /// null → "", "default" (any case) → "default", else the secret value read for this call only. A locked, deleted or
        /// missing secret (also a value missing in the vault, or an id that is not a secret) answers "" so the admin
        /// can repair it with an update (owner 2026-10-13 "Yes, allow repair"). Vault down and every other error
        /// is not caught (SecretExceptionFilter 502 / Genesis 500, as today).
        /// </summary>
        private async Task<string> ResolveForGetAsync(string tenantId, string? secretId)
        {
            if (secretId == null)
            {
                return string.Empty;
            }

            if (IsDefault(secretId))
            {
                // Any case = the Blocks DB; always answered (and stored) as "default".
                return DefaultSentinel;
            }

            try
            {
                return await _secretService.GetValueAsync(secretId);
            }
            catch (SecretException ex) when (ex is SecretStateException or SecretNotFoundException)
            {
                _logger.LogWarning(
                    ex,
                    "DataGateway step=get result=secret-unavailable error={ErrorType} tenant={TenantId} secretId={SecretId}",
                    ex.GetType().Name, tenantId, secretId);
                return string.Empty;
            }
        }

        #endregion

        #region Save

        public async Task<BaseMutationResponse> SaveDataGatewayConfigurationAsync(SaveDataGatewayConfigurationRequest request)
        {
            var validationResult = await _validator.ValidateAsync(request);

            if (!validationResult.IsValid)
                return new BaseMutationResponse { IsSuccess = false, Errors = validationResult.Errors.ToDictionary(e => e.PropertyName, e => e.ErrorMessage) };

            if (!_rootMode.IsOn)
            {
                return await SaveOffAsync(request);
            }

            var tenantId = BlocksContext.GetContext()?.TenantId ?? string.Empty;
            return request.UpdateRequest
                ? await UpdateOnAsync(tenantId, request)
                : await CreateOnAsync(tenantId, request);
        }

        private static BaseMutationResponse Refuse(string key, string message) =>
            new() { IsSuccess = false, Errors = new Dictionary<string, string> { { key, message } } };

        #endregion

        #region Switch off (today's code + §6.1a guard)

        private async Task<BaseMutationResponse> SaveOffAsync(SaveDataGatewayConfigurationRequest request)
        {
            var existing = request.UpdateRequest
                ? await _configurationRepository.GetDataGatewayConfigurationByIdAsync(request.ItemId ?? "")
                : null;

            // §6.1a: a root doc (has ConfigItemId) is never a target of the old path.
            if (existing?.ConfigItemId != null)
            {
                _logger.LogWarning("DataGateway step=off-save result=refused-root-doc itemId={ItemId}", request.ItemId);
                return Refuse(ItemIdField, NotFoundMessage);
            }

            var repoConfiguration = MapIntoRepoConfiguration(request, existing);

            try
            {
                await _configurationRepository.SaveDataGatewayConfigurationAsync(repoConfiguration);
            }
            catch (MongoWriteException ex) when (ex.WriteError?.Category == ServerErrorCategory.DuplicateKey)
            {
                // Second line of defence: the ReplaceOne filter excludes root docs, so an upsert onto a root doc's
                // _id hits DuplicateKey. Nothing was replaced.
                _logger.LogWarning(ex, "DataGateway step=off-save error=DuplicateKey itemId={ItemId}", repoConfiguration.ItemId);
                return Refuse(ItemIdField, NotFoundMessage);
            }

            return new BaseMutationResponse { IsSuccess = true, ItemId = repoConfiguration.ItemId };
        }

        // Today's map (ConfigurationService.MappedIntoRepoConfigurationAsync), with the update read moved to the caller.
        private static DataGatewayConfiguration MapIntoRepoConfiguration(SaveDataGatewayConfigurationRequest request, DataGatewayConfiguration? repoConfiguration)
        {
            var isNewConfiguration = repoConfiguration == null;

            if (repoConfiguration == null)
            {
                repoConfiguration = new DataGatewayConfiguration { ItemId = Guid.NewGuid().ToString(), CreatedDate = DateTime.UtcNow };
                repoConfiguration.CreatedBy = BlocksContext.GetContext()?.UserId;
                repoConfiguration.ProjectKey = request.ProjectKey ?? "";
            }

            repoConfiguration.LastUpdatedBy = BlocksContext.GetContext()?.UserId;
            repoConfiguration.LastUpdatedDate = DateTime.UtcNow;

            repoConfiguration.DbConnectionString = Convert.ToBase64String(System.Text.Encoding.UTF8.GetBytes(request.ConnectionString ?? ""));
            ApplyNonSecretFields(repoConfiguration, request, isNewConfiguration);

            return repoConfiguration;
        }

        // Today's non-secret field and analytics rules (shared by both paths, unchanged).
        private static void ApplyNonSecretFields(DataGatewayConfiguration repoConfiguration, SaveDataGatewayConfigurationRequest request, bool isNewConfiguration)
        {
            repoConfiguration.DatabaseName = request.DatabaseName ?? "";
            repoConfiguration.IsCollectionNameEditable = request.IsCollectionNameEditable;
            repoConfiguration.CollectionNamePattern = request.CollectionNamePattern ?? repoConfiguration.CollectionNamePattern;

            if (request.EnableAnalytics.HasValue)
            {
                repoConfiguration.AnalyticsConfiguration ??= new AnalyticsConfiguration();
                if (request.EnableAnalytics.Value
                    && !repoConfiguration.AnalyticsConfiguration.EnableDate.HasValue
                    && !repoConfiguration.AnalyticsConfiguration.ValidTill.HasValue)
                {
                    var enableDate = DateTime.UtcNow;
                    repoConfiguration.AnalyticsConfiguration.EnableDate = enableDate;
                    repoConfiguration.AnalyticsConfiguration.ValidTill = enableDate.AddDays(14);
                }

                repoConfiguration.AnalyticsConfiguration.EnableAnalytics = request.EnableAnalytics.Value;
            }
            else if (isNewConfiguration)
            {
                var enableDate = DateTime.UtcNow;
                repoConfiguration.AnalyticsConfiguration = new AnalyticsConfiguration
                {
                    EnableAnalytics = true,
                    EnableDate = enableDate,
                    ValidTill = enableDate.AddDays(14)
                };
            }
        }

        #endregion

        #region Switch on: create

        private async Task<BaseMutationResponse> CreateOnAsync(string tenantId, SaveDataGatewayConfigurationRequest request)
        {
            var value = request.ConnectionString ?? string.Empty;
            var secretId = IsDefault(value) ? DefaultSentinel : await SetSecretAsync(value);

            var now = DateTime.UtcNow;
            var userId = BlocksContext.GetContext()?.UserId;
            var root = new DataGatewayConfiguration
            {
                ItemId = tenantId,
                // A new GUID as today; a body itemId is ignored on create (CL-os-23 removed).
                ConfigItemId = Guid.NewGuid().ToString(),
                DbConnectionString = null,
                DbConnectionSecretId = secretId,
                // Body value as today (CL-os-29 removed); _id, secret and Redis key are the caller's tenant.
                ProjectKey = request.ProjectKey ?? "",
                CreatedDate = now,
                CreatedBy = userId,
                LastUpdatedDate = now,
                LastUpdatedBy = userId,
                IsDeleted = false,
                // The value was chosen by new code and there is no tenant copy: flagged in the insert itself.
                ValueChangedAfterDeploy = true
            };
            ApplyNonSecretFields(root, request, isNewConfiguration: true);

            if (!await _configurationRepository.InsertDataGatewayRootAsync(root))
            {
                // A parallel create (or a soft-deleted root doc) won. The new secret stays unused (no
                // compensation, CL-os-32 removed).
                _logger.LogWarning("DataGateway step=create result=duplicate-key tenant={TenantId}", tenantId);
                return Refuse(ItemIdField, AlreadyExistsMessage);
            }

            if (!await WriteRedisAsync(tenantId, secretId, root.DatabaseName))
            {
                return Refuse("Redis", RedisFailedMessage);
            }

            return new BaseMutationResponse { IsSuccess = true, ItemId = root.ConfigItemId };
        }

        #endregion

        #region Switch on: update

        private async Task<BaseMutationResponse> UpdateOnAsync(string tenantId, SaveDataGatewayConfigurationRequest request)
        {
            var root = await _configurationRepository.GetDataGatewayRootAsync(tenantId);
            if (root == null)
            {
                return RefuseNotMigrated(tenantId);
            }

            // One doc per tenant: a wrong ItemId used to create a second doc; now it is refused.
            if (!string.Equals(request.ItemId, root.ConfigItemId, StringComparison.Ordinal))
            {
                return Refuse(ItemIdField, NotFoundMessage);
            }

            var value = request.ConnectionString ?? string.Empty;
            var oldSecretId = root.DbConnectionSecretId;
            var action = await DecideSecretActionAsync(value, oldSecretId);

            // Flag FIRST (review H3): before any secret write, so a later failure never leaves a changed value
            // unflagged (rollback / Worker verify rely on it).
            if (action != SecretAction.None && root.ValueChangedAfterDeploy != true)
            {
                var flagged = await _configurationRepository.SetDataGatewayRootFieldsAsync(
                    tenantId, new BsonDocument(nameof(DataGatewayConfiguration.ValueChangedAfterDeploy), true));
                if (flagged == 0)
                {
                    return RefuseNotMigrated(tenantId);
                }
            }

            // "default" in any case is always written back as "default".
            var newSecretId = IsDefault(oldSecretId) ? DefaultSentinel : oldSecretId;
            switch (action)
            {
                case SecretAction.Rotate:
                    await _secretService.RotateAsync(oldSecretId!, new RotateSecretRequest { Value = value });
                    break;
                case SecretAction.Set:
                    newSecretId = await SetSecretAsync(value);
                    break;
                case SecretAction.ToDefault:
                    // The old secret is left as it is (no delete, CL-os-27 removed).
                    newSecretId = DefaultSentinel;
                    break;
            }

            root.LastUpdatedDate = DateTime.UtcNow;
            root.LastUpdatedBy = BlocksContext.GetContext()?.UserId;
            root.DbConnectionSecretId = newSecretId;
            ApplyNonSecretFields(root, request, isNewConfiguration: false);

            // Root: field $set (never a whole-doc replace: keeps MigratedFrom); ProjectKey unchanged on update.
            var set = new BsonDocument
            {
                { nameof(DataGatewayConfiguration.DatabaseName), root.DatabaseName },
                { nameof(DataGatewayConfiguration.IsCollectionNameEditable), root.IsCollectionNameEditable },
                { nameof(DataGatewayConfiguration.CollectionNamePattern), StringOrNull(root.CollectionNamePattern) },
                { nameof(DataGatewayConfiguration.LastUpdatedDate), root.LastUpdatedDate },
            };
            var unset = new List<string>();
            SetOrUnset(set, unset, nameof(DataGatewayConfiguration.DbConnectionSecretId), newSecretId == null ? null : new BsonString(newSecretId));
            SetOrUnset(set, unset, nameof(DataGatewayConfiguration.AnalyticsConfiguration), root.AnalyticsConfiguration?.ToBsonDocument());
            SetOrUnset(set, unset, nameof(DataGatewayConfiguration.LastUpdatedBy), root.LastUpdatedBy == null ? null : new BsonString(root.LastUpdatedBy));

            if (await _configurationRepository.SetDataGatewayRootFieldsAsync(tenantId, set, unset) == 0)
            {
                // Removed between the read and this write.
                return RefuseNotMigrated(tenantId);
            }

            // Tenant copy while it exists: non-secret fields only, never the value (owner "Stop writing").
            await _configurationRepository.SetDataGatewayTenantCopyNonSecretAsync(root.ConfigItemId!, new BsonDocument
            {
                { nameof(DataGatewayConfiguration.DatabaseName), root.DatabaseName },
                { nameof(DataGatewayConfiguration.IsCollectionNameEditable), root.IsCollectionNameEditable },
                { nameof(DataGatewayConfiguration.CollectionNamePattern), StringOrNull(root.CollectionNamePattern) },
                { nameof(DataGatewayConfiguration.AnalyticsConfiguration), (BsonValue?)root.AnalyticsConfiguration?.ToBsonDocument() ?? BsonNull.Value },
                { nameof(DataGatewayConfiguration.LastUpdatedDate), root.LastUpdatedDate },
                { nameof(DataGatewayConfiguration.LastUpdatedBy), StringOrNull(root.LastUpdatedBy) },
            });

            if (!await WriteRedisAsync(tenantId, newSecretId ?? string.Empty, root.DatabaseName))
            {
                return Refuse("Redis", RedisFailedMessage);
            }

            return new BaseMutationResponse { IsSuccess = true, ItemId = root.ConfigItemId };
        }

        /// <summary>
        /// Reads only (os SPEC2 §6.5 step 2). custom + active id: compare (equal → none, differs → rotate);
        /// custom + locked → rotate; custom + deleted / not found → set (repair); custom + null/"default" → set;
        /// "default" + "default" → none; "default" + anything else → to-default. No branch for a malformed id: it
        /// goes to Blocks Secrets like any id. An active secret whose vault value is gone → rotate (writes the value
        /// again; same rule as blocks-data SPEC1 §3.5.6).
        /// </summary>
        internal async Task<SecretAction> DecideSecretActionAsync(string newValue, string? rootSecretId)
        {
            if (IsDefault(newValue))
            {
                return IsDefault(rootSecretId) ? SecretAction.None : SecretAction.ToDefault;
            }

            if (string.IsNullOrEmpty(rootSecretId) || IsDefault(rootSecretId))
            {
                return SecretAction.Set;
            }

            SecretResult? metadata;
            try
            {
                metadata = await _secretService.GetAsync(rootSecretId);
            }
            catch (SecretNotFoundException)
            {
                metadata = null;
            }

            if (metadata == null || metadata.Status == SecretStatuses.Deleted)
            {
                return SecretAction.Set;
            }

            if (metadata.Status == SecretStatuses.Locked)
            {
                return SecretAction.Rotate;
            }

            string current;
            try
            {
                current = await _secretService.GetValueAsync(rootSecretId);
            }
            catch (SecretNotFoundException)
            {
                return SecretAction.Rotate;
            }

            return string.Equals(current, newValue, StringComparison.Ordinal) ? SecretAction.None : SecretAction.Rotate;
        }

        private BaseMutationResponse RefuseNotMigrated(string tenantId)
        {
            _logger.LogWarning("DataGateway step=update result=refused-not-migrated tenant={TenantId}", tenantId);
            return Refuse(ItemIdField, NotMigratedMessage);
        }

        private static BsonValue StringOrNull(string? value) => value == null ? BsonNull.Value : new BsonString(value);

        private static void SetOrUnset(BsonDocument set, List<string> unset, string field, BsonValue? value)
        {
            if (value == null || value.IsBsonNull)
                unset.Add(field);
            else
                set.Add(field, value);
        }

        #endregion

        #region Secrets and Redis

        private Task<string> SetSecretAsync(string value) =>
            _secretService.SetAsync(new SetSecretRequest
            {
                Name = SecretName,
                Type = SecretTypes.Service,
                Tags = new[] { SecretTag },
                // Same org as the data Worker; without it SetAsync takes the admin's org.
                OrganizationId = SecretOrganizationId,
                Value = value,
                Description = SecretDescription
            });

        /// <summary>
        /// One transaction: HSET secret id, DB name, Version (ticks) + HDEL the legacy value field. Never
        /// <c>KeyDelete</c> + add, never a value. False when Redis refuses or throws ("Save again").
        /// </summary>
        private async Task<bool> WriteRedisAsync(string tenantId, string secretId, string databaseName)
        {
            var queued = new List<Task>();
            try
            {
                var database = _cacheClient.CacheDatabase();
                var transaction = database.CreateTransaction();
                queued.Add(transaction.HashSetAsync(tenantId, new[]
                {
                    new HashEntry(HashFieldSecretId, secretId),
                    new HashEntry(HashFieldDatabaseName, databaseName ?? string.Empty),
                    new HashEntry(HashFieldVersion, DateTime.UtcNow.Ticks)
                }));
                queued.Add(transaction.HashDeleteAsync(tenantId, HashFieldLegacyConnectionString));

                if (await transaction.ExecuteAsync())
                {
                    return true;
                }

                _logger.LogError("DataGateway step=redis result=not-committed tenant={TenantId}", tenantId);
                return false;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "DataGateway step=redis result=failed error={ErrorType} tenant={TenantId}", ex.GetType().Name, tenantId);
                return false;
            }
            finally
            {
                // Observe the queued operations so a failed transaction leaves no unobserved task exception.
                foreach (var task in queued)
                {
                    _ = task.ContinueWith(t => _ = t.Exception, TaskContinuationOptions.OnlyOnFaulted);
                }
            }
        }

        #endregion
    }
}
