using Blocks.Genesis;
using Microsoft.Extensions.Logging;
using MongoDB.Bson.Serialization.Attributes;
using MongoDB.Driver;

namespace Cloud.LmtService.Repositories.Shared
{
    public sealed class RestoreUserRepository : IRestoreUserRepository
    {
        private const string UsersCollectionName = "Users";
        private IMongoDatabase _clientDb;
        private readonly IDbContextProvider _dbContextProvider;
        private readonly ILogger<RestoreUserRepository> _logger;
        private const string _rootDatabaseName = "BlocksRootDb";
        private readonly IBlocksSecret _blocksSecret;
        public RestoreUserRepository(IDbContextProvider dbContextProvider, IBlocksSecret blocksSecret, ILogger<RestoreUserRepository> logger)
        {
            _dbContextProvider = dbContextProvider ?? throw new ArgumentNullException(nameof(dbContextProvider));
            _logger = logger ?? throw new ArgumentNullException(nameof(logger));
           _blocksSecret = blocksSecret;
        }
        private IMongoDatabase ResolvedClientDb ( )
        {
            var blocksContext = BlocksContext.GetContext();
            _logger.LogInformation($"Blocks Context {blocksContext.ToString()}");
            if (blocksContext.Impersonated)
            {
             return _dbContextProvider.GetDatabase(_blocksSecret.DatabaseConnectionString, _rootDatabaseName);
            }

            return _dbContextProvider.GetDatabase(blocksContext.TenantId);
        }
        public async Task<string?> GetEmailByUserIdAsync(string? userId, CancellationToken ct = default)
        {
            if (string.IsNullOrWhiteSpace(userId))
            {
                return null;
            }

            try
            {
               // Reads the Users collection of whichever database ResolvedClientDb picked. Either
               // way the choice depends on the ambient BlocksContext, which is why this lookup
               // belongs on the request path rather than in the worker that later sends the mail.
               _clientDb = ResolvedClientDb();
               var users = _clientDb.GetCollection<RestoreUser>(UsersCollectionName);

                var email = await users
                    .Find(Builders<RestoreUser>.Filter.Eq(user => user.ItemId, userId))
                    .Project(user => user.Email)
                    .FirstOrDefaultAsync(ct);

                if (string.IsNullOrWhiteSpace(email))
                {
                    _logger.LogWarning(
                        "No email found for UserId {UserId}; the restore will run but its completion mail will be skipped",
                        userId);
                    return null;
                }

                return email;
            }
            catch (Exception ex)
            {
                // Deliberately swallowed: the address is only needed for a courtesy notification,
                // and a restore the user asked for must not fail because their user row could not
                // be read. Logged so it is still diagnosable.
                _logger.LogWarning(ex, "Could not resolve the email for UserId {UserId}", userId);
                return null;
            }
        }
    }

    /// <summary>
    /// Read-only projection over the Users collection. Derives from <see cref="BaseEntity"/> so
    /// ItemId keeps the same [BsonId] mapping as the User entity that writes these documents;
    /// declaring the id locally would risk mapping it to a field named "ItemId" instead of _id.
    /// </summary>
    [BsonIgnoreExtraElements]
    internal sealed class RestoreUser : BaseEntity
    {
        public string? Email { get; set; }
    }
}
