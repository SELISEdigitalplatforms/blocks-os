using Blocks.Genesis;
using Configuration.DomainService.Shared.Services;
using MongoDB.Bson;
using MongoDB.Driver;

namespace Configuration.DomainService.Actions;

/// <summary>The context tenant's <c>actions</c> KV list. Data access only.</summary>
public interface IActionsRepository
{
    /// <summary>The list, or null when the tenant has none.</summary>
    Task<List<ActionDefinition>?> GetAllAsync(CancellationToken cancellationToken);

    /// <summary>
    /// Sets one flag of the item named <paramref name="name"/> with a single positional update, so two admins
    /// switching different flags at once never overwrite each other.
    /// </summary>
    Task<ActionFlagUpdate> SetFlagAsync(string name, string flagField, bool enabled, CancellationToken cancellationToken);
}

/// <inheritdoc cref="IActionsRepository"/>
public sealed class ActionsRepository : IActionsRepository
{
    private const string NameField = nameof(ActionDefinition.Name);

    private readonly IKeyValueStore _keyValueStore;
    private readonly IDbContextProvider _dbContextProvider;
    private readonly TimeProvider _timeProvider;

    public ActionsRepository(IKeyValueStore keyValueStore, IDbContextProvider dbContextProvider, TimeProvider timeProvider)
    {
        _keyValueStore = keyValueStore;
        _dbContextProvider = dbContextProvider;
        _timeProvider = timeProvider;
    }

    public Task<List<ActionDefinition>?> GetAllAsync(CancellationToken cancellationToken) =>
        _keyValueStore.GetAsync<List<ActionDefinition>>(ActionConstants.ActionsKey, impersonated: true, cancellationToken);

    public async Task<ActionFlagUpdate> SetFlagAsync(string name, string flagField, bool enabled, CancellationToken cancellationToken)
    {
        var collection = KeyValueCollection.Of(_dbContextProvider);
        var filter = new BsonDocument
        {
            { KeyValueCollection.KeyField, ActionConstants.ActionsKey },
            { KeyValueCollection.ValueField, new BsonDocument("$elemMatch", new BsonDocument(NameField, name)) }
        };
        var update = KeyValueCollection.Touch(
            Builders<BsonDocument>.Update.Set($"{KeyValueCollection.ValueField}.$.{flagField}", enabled),
            _timeProvider.GetUtcNow().UtcDateTime);

        var result = await collection.UpdateOneAsync(filter, update, cancellationToken: cancellationToken);
        if (result.MatchedCount > 0)
        {
            return ActionFlagUpdate.Updated;
        }

        var seeded = new BsonDocument
        {
            { KeyValueCollection.KeyField, ActionConstants.ActionsKey },
            { KeyValueCollection.ValueField, new BsonDocument("$type", "array") }
        };
        return await collection.Find(seeded).AnyAsync(cancellationToken)
            ? ActionFlagUpdate.ActionNotFound
            : ActionFlagUpdate.NotSeeded;
    }
}
