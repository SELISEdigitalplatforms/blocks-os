using Blocks.Genesis;
using Configuration.DomainService.Shared.Services;
using MongoDB.Bson;
using MongoDB.Driver;

namespace Configuration.DomainService.Actions;

/// <summary>
/// The <c>actions</c> KV list: the full catalog in the root database (read only here) and, per tenant, only the
/// actions an admin switched on. Data access only.
/// </summary>
public interface IActionsRepository
{
    /// <summary>The tenant's switched-on actions, or null when the tenant has none.</summary>
    Task<List<ActionDefinition>?> GetAllAsync(CancellationToken cancellationToken);

    /// <summary>The root database's full catalog, or null when it is not seeded.</summary>
    Task<List<ActionDefinition>?> GetCatalogAsync(CancellationToken cancellationToken);

    /// <summary>
    /// Switches one flag on: makes sure the tenant row and the item exist (a full copy of <paramref name="catalogEntry"/>),
    /// sets the flag and refreshes label, service and payload from the catalog. Atomic updates only, so two admins
    /// at once never lose a flag or make a duplicate item. False when concurrent removals kept winning.
    /// </summary>
    Task<bool> EnableAsync(ActionDefinition catalogEntry, string flagField, CancellationToken cancellationToken);

    /// <summary>
    /// Switches one flag off, then removes the item when all three flags are off. No item is nothing to do.
    /// </summary>
    Task DisableAsync(string name, string flagField, CancellationToken cancellationToken);
}

/// <inheritdoc cref="IActionsRepository"/>
public sealed class ActionsRepository : IActionsRepository
{
    private const string NameField = nameof(ActionDefinition.Name);
    private const int MaxEnableAttempts = 3;

    private static readonly string[] FlagFields =
        [nameof(ActionDefinition.Workflow), nameof(ActionDefinition.Function), nameof(ActionDefinition.Webhook)];

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

    public Task<List<ActionDefinition>?> GetCatalogAsync(CancellationToken cancellationToken) =>
        _keyValueStore.GetAsync<List<ActionDefinition>>(ActionConstants.ActionsKey, impersonated: false, cancellationToken);

    public async Task<bool> EnableAsync(ActionDefinition catalogEntry, string flagField, CancellationToken cancellationToken)
    {
        var collection = KeyValueCollection.Of(_dbContextProvider);
        var now = _timeProvider.GetUtcNow().UtcDateTime;
        await EnsureRowAsync(collection, now, cancellationToken);

        for (var attempt = 0; attempt < MaxEnableAttempts; attempt++)
        {
            // Add the item (flag already on) only when no item has this name.
            var pushed = await collection.UpdateOneAsync(
                RowFilter().Add($"{KeyValueCollection.ValueField}.{NameField}", new BsonDocument("$ne", catalogEntry.Name)),
                KeyValueCollection.Touch(
                    Builders<BsonDocument>.Update.Push(KeyValueCollection.ValueField, NewItem(catalogEntry, flagField)), now),
                cancellationToken: cancellationToken);
            if (pushed.ModifiedCount > 0)
            {
                return true;
            }

            // The item exists: switch the flag on and refresh the catalog fields on it.
            var update = Builders<BsonDocument>.Update
                .Set(ItemField(flagField), true)
                .Set(ItemField(nameof(ActionDefinition.Label)), catalogEntry.Label ?? string.Empty)
                .Set(ItemField(nameof(ActionDefinition.Service)), catalogEntry.Service ?? string.Empty)
                .Set(ItemField(nameof(ActionDefinition.Payload)), PayloadOf(catalogEntry));
            var set = await collection.UpdateOneAsync(
                ItemFilter(catalogEntry.Name), KeyValueCollection.Touch(update, now), cancellationToken: cancellationToken);
            if (set.MatchedCount > 0)
            {
                return true;
            }

            // A disable removed the item between the two steps: try again.
        }

        return false;
    }

    public async Task DisableAsync(string name, string flagField, CancellationToken cancellationToken)
    {
        var collection = KeyValueCollection.Of(_dbContextProvider);
        var now = _timeProvider.GetUtcNow().UtcDateTime;
        var set = await collection.UpdateOneAsync(
            ItemFilter(name),
            KeyValueCollection.Touch(Builders<BsonDocument>.Update.Set(ItemField(flagField), false), now),
            cancellationToken: cancellationToken);
        if (set.MatchedCount == 0)
        {
            return;
        }

        // The all-off test is inside the $pull, so a flag another admin switched on meanwhile keeps the item.
        var allOff = new BsonDocument(NameField, name);
        foreach (var flag in FlagFields)
        {
            allOff.Add(flag, false);
        }

        await collection.UpdateOneAsync(
            RowFilter(),
            KeyValueCollection.Touch(Builders<BsonDocument>.Update.PullFilter(KeyValueCollection.ValueField, new BsonDocumentFilterDefinition<BsonDocument>(allOff)), now),
            cancellationToken: cancellationToken);
    }

    // The Key index is not unique (Genesis), so two admins creating the very first row in the same instant could
    // make two rows. The window is one upsert; later changes are atomic updates on the row found by Key.
    private async Task EnsureRowAsync(IMongoCollection<BsonDocument> collection, DateTime now, CancellationToken cancellationToken)
    {
        var context = BlocksContext.GetContext();
        var organizationId = string.IsNullOrWhiteSpace(context?.OrganizationId) ? "default" : context.OrganizationId;
        var insert = Builders<BsonDocument>.Update
            .SetOnInsert("_id", ObjectId.GenerateNewId().ToString())
            .SetOnInsert(nameof(KeyValueEntry.Tags), new BsonArray())
            .SetOnInsert(KeyValueCollection.ValueField, new BsonArray())
            .SetOnInsert(nameof(KeyValueEntry.CreatedDate), now)
            .SetOnInsert(nameof(KeyValueEntry.CreatedBy), context?.UserId)
            .SetOnInsert(nameof(KeyValueEntry.OrganizationId), organizationId)
            .SetOnInsert(KeyValueCollection.LastUpdatedDateField, now)
            .SetOnInsert(KeyValueCollection.LastUpdatedByField, context?.UserId);
        await collection.UpdateOneAsync(
            RowFilter(), insert, new UpdateOptions { IsUpsert = true }, cancellationToken);
    }

    private static BsonDocument RowFilter() => new(KeyValueCollection.KeyField, ActionConstants.ActionsKey);

    private static BsonDocument ItemFilter(string name) => RowFilter().Add(
        KeyValueCollection.ValueField, new BsonDocument("$elemMatch", new BsonDocument(NameField, name)));

    private static string ItemField(string field) => $"{KeyValueCollection.ValueField}.$.{field}";

    private static BsonDocument PayloadOf(ActionDefinition entry)
    {
        var payload = new BsonDocument();
        foreach (var (field, type) in entry.Payload ?? [])
        {
            payload.Add(field, type);
        }

        return payload;
    }

    private static BsonDocument NewItem(ActionDefinition entry, string flagField)
    {
        var item = new BsonDocument
        {
            { NameField, entry.Name },
            { nameof(ActionDefinition.Label), entry.Label ?? string.Empty },
            { nameof(ActionDefinition.Service), entry.Service ?? string.Empty },
            { nameof(ActionDefinition.Payload), PayloadOf(entry) }
        };
        foreach (var flag in FlagFields)
        {
            item.Add(flag, flag == flagField);
        }

        return item;
    }
}
