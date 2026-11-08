using Blocks.Genesis;
using MongoDB.Bson;
using MongoDB.Driver;

namespace Configuration.DomainService.Shared.Services;

/// <summary>
/// The context tenant's <c>KeyValueStores</c> collection as raw documents, for atomic updates inside one stored list
/// that <see cref="IKeyValueStore"/> cannot express. Same database as <see cref="IKeyValueStore"/> with impersonated: true.
/// </summary>
public static class KeyValueCollection
{
    public const string Name = "KeyValueStores";
    public const string KeyField = nameof(KeyValueEntry.Key);
    public const string ValueField = nameof(KeyValueEntry.Value);
    public const string LastUpdatedDateField = nameof(KeyValueEntry.LastUpdatedDate);
    public const string LastUpdatedByField = nameof(KeyValueEntry.LastUpdatedBy);

    public static IMongoCollection<BsonDocument> Of(IDbContextProvider dbContextProvider)
    {
        ArgumentNullException.ThrowIfNull(dbContextProvider);
        var database = dbContextProvider.GetDatabase()
            ?? throw new InvalidOperationException("No tenant database in the current context.");
        return database.GetCollection<BsonDocument>(Name);
    }

    /// <summary>Stamps who changed the row and when.</summary>
    public static UpdateDefinition<BsonDocument> Touch(UpdateDefinition<BsonDocument> update, DateTime now) =>
        update.Set(LastUpdatedDateField, now).Set(LastUpdatedByField, BlocksContext.GetContext()?.UserId);
}
