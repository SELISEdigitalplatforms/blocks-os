using Blocks.Genesis;
using DomainService.Shared;
using MongoDB.Driver;

namespace XUnitTest.Integration
{
    /// <summary>
    /// Resolves the root database to the fixture's database and every tenant-scoped request to a
    /// separate one, so a repository reaching for the wrong handle reads an empty collection.
    /// </summary>
    /// <remarks>
    /// The shared fixture cannot stand in for this: its provider resolves the root database,
    /// every tenant database and every bare <c>GetCollection</c> call to one throwaway database,
    /// so the two handles are indistinguishable there. Whether a repository reads
    /// <c>ProjectPeoples</c> from the database it was written to is only visible through a
    /// provider that keeps them apart.
    /// </remarks>
    internal sealed class SplitDatabaseContextProvider : IDbContextProvider
    {
        private readonly IMongoClient _client;
        private readonly IMongoDatabase _rootDatabase;
        private readonly IMongoDatabase _tenantDatabase;
        private readonly string _tenantDatabaseName;

        public SplitDatabaseContextProvider(IMongoClient client, IMongoDatabase rootDatabase, string tenantDatabaseName)
        {
            _client = client;
            _rootDatabase = rootDatabase;
            _tenantDatabaseName = tenantDatabaseName;
            _tenantDatabase = client.GetDatabase(tenantDatabaseName);
        }

        public void Drop() => _client.DropDatabase(_tenantDatabaseName);

        public IMongoDatabase GetDatabase(string tenantId) => _tenantDatabase;

        public IMongoDatabase GetDatabase() => _tenantDatabase;

        public IMongoDatabase GetDatabase(string connectionString, string databaseName, bool isCacheRefreshed = false) =>
            databaseName == IdentifierConstants.RootDatabaseName ? _rootDatabase : _tenantDatabase;

        public IMongoCollection<T> GetCollection<T>(string collectionName) =>
            _tenantDatabase.GetCollection<T>(collectionName);

        public IMongoCollection<T> GetCollection<T>(string tenantId, string collectionName) =>
            _tenantDatabase.GetCollection<T>(collectionName);
    }
}
