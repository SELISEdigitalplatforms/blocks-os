using Blocks.Genesis;
using Blocks.Secrets;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Logging.Abstractions;
using MongoDB.Bson;
using MongoDB.Driver;

namespace DomainService.Projects
{
    /// <summary>
    /// Gives a new project its default data-source config: the root doc (<c>BlocksRootDb.DataServiceConfigurations</c>,
    /// <c>_id = TenantId</c>) and its secret (value <c>default</c> = Blocks DB). No Redis hash: blocks-data rebuilds it on
    /// the first miss. Field and secret names match <c>Configuration.DomainService.DataGateway</c> (this project does not
    /// reference it). Values equal the contract seed doc.
    /// </summary>
    public interface IDataGatewayRootProvisioner
    {
        /// <summary>Idempotent: an existing root doc (live or soft-deleted) is left as it is and no secret is created.</summary>
        Task EnsureAsync(string tenantId, string? createdBy);
    }

    public sealed class DataGatewayRootProvisioner : IDataGatewayRootProvisioner
    {
        public const string CollectionName = "DataServiceConfigurations";
        public const string SecretName = "data-source";
        public const string SecretTag = "data";
        public const string SecretOrganizationId = "default";
        public const string DefaultValue = "default";
        public const string ServiceUserId = "blocks-os-datasource";

        private readonly IDbContextProvider _dbContextProvider;
        private readonly IBlocksSecret _blocksSecret;
        private readonly IServiceScopeFactory _scopeFactory;
        private readonly ILogger<DataGatewayRootProvisioner> _logger;

        public DataGatewayRootProvisioner(
            IDbContextProvider dbContextProvider,
            IBlocksSecret blocksSecret,
            IServiceScopeFactory scopeFactory,
            ILogger<DataGatewayRootProvisioner>? logger = null)
        {
            _dbContextProvider = dbContextProvider;
            _blocksSecret = blocksSecret;
            _scopeFactory = scopeFactory;
            _logger = logger ?? NullLogger<DataGatewayRootProvisioner>.Instance;
        }

        public async Task EnsureAsync(string tenantId, string? createdBy)
        {
            if (string.IsNullOrWhiteSpace(tenantId))
                throw new ArgumentException("Tenant ID is required.", nameof(tenantId));

            var collection = _dbContextProvider
                .GetDatabase(_blocksSecret.DatabaseConnectionString, _blocksSecret.RootDatabaseName)
                .GetCollection<BsonDocument>(CollectionName);

            var idFilter = new BsonDocument("_id", tenantId);
            if (await collection.CountDocumentsAsync(idFilter, new CountOptions { Limit = 1 }) > 0)
            {
                _logger.LogInformation("DataGateway step=root-default result=exists tenant={TenantId}", tenantId);
                return;
            }

            // Order: secret, then doc. A failed or lost insert deletes the secret this call created.
            var secretId = await ExecuteInTenantAsync(tenantId, s => s.SetAsync(new SetSecretRequest
            {
                Name = SecretName,
                Type = SecretTypes.Service,
                Tags = [SecretTag],
                OrganizationId = SecretOrganizationId,
                Value = DefaultValue
            }));

            try
            {
                await collection.InsertOneAsync(Build(tenantId, secretId, createdBy, DateTime.UtcNow));
                _logger.LogInformation("DataGateway step=root-default result=created tenant={TenantId}", tenantId);
            }
            catch (MongoWriteException ex) when (ex.WriteError?.Category == ServerErrorCategory.DuplicateKey)
            {
                // Resumed run or a parallel GET created it first: keep that doc, drop our own secret.
                await DeleteOwnSecretAsync(tenantId, secretId);
                _logger.LogInformation(ex, "DataGateway step=root-default result=exists tenant={TenantId}", tenantId);
            }
            catch
            {
                await DeleteOwnSecretAsync(tenantId, secretId);
                throw;
            }
        }

        /// <summary>The seed doc values (contract): DatabaseName "default", pattern "sb_{SchemaName}s", no analytics.</summary>
        public static BsonDocument Build(string tenantId, string secretId, string? createdBy, DateTime now)
        {
            // Mongo keeps milliseconds; the Redis Version is the same value on every pod.
            var stamp = new DateTime(now.Ticks - now.Ticks % TimeSpan.TicksPerMillisecond, DateTimeKind.Utc);
            return new BsonDocument
            {
                { "_id", tenantId },
                { "TenantId", tenantId },
                { "DbConnectionSecretId", secretId },
                { "DatabaseName", "default" },
                { "IsCollectionNameEditable", false },
                { "CollectionNamePattern", "sb_{SchemaName}s" },
                { "ProjectKey", "" },
                { "ProjectShortKey", "" },
                { "CreatedDate", stamp },
                { "LastUpdatedDate", stamp },
                { "CreatedBy", (BsonValue?)createdBy ?? BsonNull.Value },
                { "LastUpdatedBy", (BsonValue?)createdBy ?? BsonNull.Value },
                { "IsDeleted", false },
            };
        }

        private async Task DeleteOwnSecretAsync(string tenantId, string secretId)
        {
            try
            {
                await ExecuteInTenantAsync(tenantId, async s =>
                {
                    await s.DeleteAsync(secretId);
                    return true;
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "DataGateway step=own-secret-delete result=failed error={ErrorType} tenant={TenantId}", ex.GetType().Name, tenantId);
            }
        }

        /// <summary>One secret call in a new scope, in the service context of the NEW tenant (the caller is another tenant).</summary>
        private async Task<T> ExecuteInTenantAsync<T>(string tenantId, Func<ISecretService, Task<T>> operation)
        {
            using var scope = _scopeFactory.CreateScope();
            var secretService = scope.ServiceProvider.GetRequiredService<ISecretService>();
            var context = BlocksContext.Create(
                tenantId: tenantId,
                roles: [],
                userId: ServiceUserId,
                isAuthenticated: true,
                requestUri: string.Empty,
                organizationId: SecretOrganizationId,
                expireOn: DateTime.UtcNow.AddMinutes(5),
                email: string.Empty,
                permissions: [],
                userName: ServiceUserId,
                phoneNumber: string.Empty,
                displayName: ServiceUserId,
                oauthToken: string.Empty,
                originalTenantId: tenantId);
            return await BlocksContext.ExecuteInContext(context, () => operation(secretService));
        }
    }
}
