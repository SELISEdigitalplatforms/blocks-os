using Blocks.Genesis;
using MongoDB.Driver;

namespace Blocks.Secrets;

/// <summary>
/// Resolves the <c>SecretStore</c> database.
/// </summary>
/// <remarks>
/// The secret store is one database shared by every tenant, not a per-tenant collection —
/// so it can be backed up, replicated and access-controlled separately from application data.
/// That makes the <c>TenantId</c> filter on every query load-bearing rather than
/// defence-in-depth: it is the only thing separating tenants here. Both repositories go
/// through <see cref="Secrets"/> and <see cref="AuditLogs"/> so no caller can reach the
/// database without one.
/// </remarks>
public sealed class SecretStoreContext
{
    private readonly IDbContextProvider _dbContextProvider;
    private readonly IBlocksSecret _blocksSecret;

    public SecretStoreContext(IDbContextProvider dbContextProvider, IBlocksSecret blocksSecret)
    {
        _dbContextProvider = dbContextProvider;
        _blocksSecret = blocksSecret;
    }

    public IMongoCollection<Secret> Secrets => Database.GetCollection<Secret>(SecretCollections.Secrets);

    public IMongoCollection<SecretAuditLog> AuditLogs => Database.GetCollection<SecretAuditLog>(SecretCollections.AuditLogs);

    public IMongoDatabase Database
    {
        get
        {
            var connectionString = _blocksSecret.DatabaseConnectionString;

            if (string.IsNullOrWhiteSpace(connectionString))
            {
                throw new InvalidOperationException(
                    "No connection string is available for the secret store. " +
                    "IBlocksSecret.DatabaseConnectionString must be populated.");
            }

            return _dbContextProvider.GetDatabase(connectionString, SecretCollections.DatabaseName);
        }
    }
}
