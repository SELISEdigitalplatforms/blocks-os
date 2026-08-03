using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.Linq;
using Blocks.Genesis;
using MongoDB.Bson;
using MongoDB.Driver;

namespace XUnitTest.Integration;

/// <summary>
/// A reusable xUnit fixture that connects to a locally running MongoDB and
/// hands out a throwaway database that is unique to this test run. The database
/// name is derived from a <see cref="Guid"/> so concurrent test sessions never
/// clash, and the whole database is dropped on <see cref="Dispose"/>. No
/// pre-existing database is ever touched.
///
/// If mongod is not reachable the fixture throws on construction so the tests
/// that depend on it fail loudly rather than silently skipping.
/// </summary>
public sealed class MongoIntegrationFixture : IDisposable
{
    public const string ConnectionString = "mongodb://localhost:27017";

    public MongoIntegrationFixture()
    {
        DatabaseName = "blocks_os_it_" + Guid.NewGuid().ToString("N");

        var settings = MongoClientSettings.FromConnectionString(ConnectionString);
        settings.ServerSelectionTimeout = TimeSpan.FromSeconds(5);
        settings.ConnectTimeout = TimeSpan.FromSeconds(5);
        Client = new MongoClient(settings);

        try
        {
            Client.GetDatabase("admin").RunCommand<BsonDocument>(
                new BsonDocument("ping", 1));
        }
        catch (Exception exception)
        {
            throw new InvalidOperationException(
                $"MongoDB is not reachable at {ConnectionString}. " +
                "The integration test harness requires a running mongod.",
                exception);
        }

        // Short unique tag for this run, used to name any derived databases so
        // they stay under MongoDB's 63 character database name limit.
        var runTag = Guid.NewGuid().ToString("N")[..10];

        Database = Client.GetDatabase(DatabaseName);
        _provider = new SingleDatabaseContextProvider(Client, DatabaseName, Database, runTag);
        DbContextProvider = _provider;
    }

    private readonly SingleDatabaseContextProvider _provider;

    public string DatabaseName { get; }

    public IMongoClient Client { get; }

    public IMongoDatabase Database { get; }

    /// <summary>
    /// An <see cref="IDbContextProvider"/> that resolves every tenant to the
    /// same throwaway database. Tenant isolation is still exercised because the
    /// repositories filter on the TenantId field inside each collection.
    /// </summary>
    public IDbContextProvider DbContextProvider { get; }

    public IMongoCollection<T> Collection<T>(string name) =>
        Database.GetCollection<T>(name);

    /// <summary>Generates a fresh tenant id so each test is isolated.</summary>
    public static string NewTenantId() => Guid.NewGuid().ToString("N");

    public void Dispose()
    {
        // Drop the primary throwaway db plus every derived db the provider
        // handed out during the run. Only databases this run created are touched.
        Client.DropDatabase(DatabaseName);
        foreach (var name in _provider.DerivedDatabaseNames)
        {
            Client.DropDatabase(name);
        }
    }

    private sealed class SingleDatabaseContextProvider : IDbContextProvider
    {
        private readonly IMongoClient _client;
        private readonly string _mainName;
        private readonly IMongoDatabase _database;
        private readonly string _runTag;
        private readonly ConcurrentDictionary<string, string> _derived = new();

        public SingleDatabaseContextProvider(IMongoClient client, string mainName, IMongoDatabase database, string runTag)
        {
            _client = client;
            _mainName = mainName;
            _database = database;
            _runTag = runTag;
        }

        public IEnumerable<string> DerivedDatabaseNames => _derived.Values;

        public IMongoDatabase GetDatabase(string tenantId) => _database;

        public IMongoDatabase GetDatabase() => _database;

        // The primary throwaway db stands in for the tenant/root databases the
        // repositories ask for by name. Any other named database (for example a
        // config-copy source or a per-project db) resolves to a distinct db,
        // uniquely named for this run, so cross-database logic is exercised for
        // real; all of them are tracked and dropped on Dispose.
        public IMongoDatabase GetDatabase(
            string connectionString,
            string databaseName,
            bool isCacheRefreshed = false)
        {
            if (databaseName == _mainName || databaseName == "BlocksRootDb")
            {
                return _database;
            }

            var derived = _derived.GetOrAdd(databaseName,
                key => "os_it_" + _runTag + "_" + Sanitize(key));
            return _client.GetDatabase(derived);
        }

        private static string Sanitize(string databaseName)
        {
            var chars = databaseName
                .Select(c => char.IsLetterOrDigit(c) ? c : '_')
                .Take(40)
                .ToArray();
            return new string(chars);
        }

        public IMongoCollection<T> GetCollection<T>(string collectionName) =>
            _database.GetCollection<T>(collectionName);

        public IMongoCollection<T> GetCollection<T>(
            string tenantId,
            string collectionName) =>
            _database.GetCollection<T>(collectionName);
    }
}

/// <summary>
/// Shared xUnit collection so every MongoDB integration test class reuses one
/// fixture (one throwaway database) and runs serially, avoiding cross-test
/// interference on shared collections.
/// </summary>
[CollectionDefinition(Name)]
public sealed class MongoIntegrationCollection :
    ICollectionFixture<MongoIntegrationFixture>
{
    public const string Name = "mongo-integration";
}
