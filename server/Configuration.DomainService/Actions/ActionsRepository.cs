using Blocks.Genesis;
using Configuration.DomainService.Shared.Services;
using MongoDB.Bson;
using MongoDB.Driver;

namespace Configuration.DomainService.Actions;

/// <summary>
/// Actions in KeyValueStores: the full catalog in the root database (key <c>actions</c>, read only here) and, per
/// tenant, one entry per switched-on action (key <c>actions:&lt;name&gt;</c>, a copy of the catalog entry with its
/// flags). Data access only.
/// </summary>
public interface IActionsRepository
{
    /// <summary>The tenant's switched-on actions; empty when the tenant has none.</summary>
    Task<IReadOnlyList<ActionDefinition>> GetAllAsync(CancellationToken cancellationToken);

    /// <summary>The tenant's entry of one action, or null when it is off for every target.</summary>
    Task<ActionDefinition?> GetAsync(string name, CancellationToken cancellationToken);

    /// <summary>The root database's full catalog, or null when it is not seeded.</summary>
    Task<List<ActionDefinition>?> GetCatalogAsync(CancellationToken cancellationToken);

    /// <summary>
    /// Switches one flag on: one upsert of the action's entry that copies label, service and payload from
    /// <paramref name="catalogEntry"/> and sets the flag; the other flags stay as they are (off on a new entry).
    /// </summary>
    Task EnableAsync(ActionDefinition catalogEntry, string flagField, CancellationToken cancellationToken);

    /// <summary>
    /// Switches one flag off, then deletes the entry when all three flags are off. No entry is nothing to do.
    /// </summary>
    Task DisableAsync(string name, string flagField, CancellationToken cancellationToken);
}

/// <inheritdoc cref="IActionsRepository"/>
public sealed class ActionsRepository : IActionsRepository
{
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

    public Task<IReadOnlyList<ActionDefinition>> GetAllAsync(CancellationToken cancellationToken) =>
        _keyValueStore.GetByPrefixAsync<ActionDefinition>(ActionConstants.ActionKeyPrefix, impersonated: true, cancellationToken);

    public Task<ActionDefinition?> GetAsync(string name, CancellationToken cancellationToken) =>
        _keyValueStore.GetAsync<ActionDefinition>(ActionConstants.ActionKey(name), impersonated: true, cancellationToken);

    public Task<List<ActionDefinition>?> GetCatalogAsync(CancellationToken cancellationToken) =>
        _keyValueStore.GetAsync<List<ActionDefinition>>(ActionConstants.ActionsKey, impersonated: false, cancellationToken);

    // The Key index is not unique (Genesis), so two admins switching on the same new action in the same instant
    // could make two entries; the newer one is merged into the older one right after the insert.
    public async Task EnableAsync(ActionDefinition catalogEntry, string flagField, CancellationToken cancellationToken)
    {
        var collection = KeyValueCollection.Of(_dbContextProvider);
        var now = _timeProvider.GetUtcNow().UtcDateTime;
        var context = BlocksContext.GetContext();
        var organizationId = string.IsNullOrWhiteSpace(context?.OrganizationId) ? "default" : context.OrganizationId;

        var update = Builders<BsonDocument>.Update
            .SetOnInsert("_id", ObjectId.GenerateNewId().ToString())
            .SetOnInsert(nameof(KeyValueEntry.Tags), new BsonArray())
            .SetOnInsert(nameof(KeyValueEntry.CreatedDate), now)
            .SetOnInsert(nameof(KeyValueEntry.CreatedBy), context?.UserId)
            .SetOnInsert(nameof(KeyValueEntry.OrganizationId), organizationId)
            .Set(ValueField(nameof(ActionDefinition.Name)), catalogEntry.Name)
            .Set(ValueField(nameof(ActionDefinition.Label)), catalogEntry.Label ?? string.Empty)
            .Set(ValueField(nameof(ActionDefinition.Service)), catalogEntry.Service ?? string.Empty)
            .Set(ValueField(nameof(ActionDefinition.Payload)), PayloadOf(catalogEntry))
            .Set(ValueField(flagField), true);
        foreach (var flag in FlagFields.Where(f => f != flagField))
        {
            update = update.SetOnInsert(ValueField(flag), false);
        }

        var result = await collection.UpdateOneAsync(
            EntryFilter(catalogEntry.Name), KeyValueCollection.Touch(update, now),
            new UpdateOptions { IsUpsert = true }, cancellationToken);
        if (result.UpsertedId is not null)
        {
            await MergeDuplicatesAsync(collection, catalogEntry.Name, now, cancellationToken);
        }
    }

    public async Task DisableAsync(string name, string flagField, CancellationToken cancellationToken)
    {
        var collection = KeyValueCollection.Of(_dbContextProvider);
        var now = _timeProvider.GetUtcNow().UtcDateTime;
        var set = await collection.UpdateManyAsync(
            EntryFilter(name),
            KeyValueCollection.Touch(Builders<BsonDocument>.Update.Set(ValueField(flagField), false), now),
            cancellationToken: cancellationToken);
        if (set.MatchedCount == 0)
        {
            return;
        }

        // The all-off test is inside the delete, so a flag another admin switched on meanwhile keeps the entry.
        var allOff = EntryFilter(name);
        foreach (var flag in FlagFields)
        {
            allOff.Add(ValueField(flag), false);
        }

        await collection.DeleteManyAsync(allOff, cancellationToken);
    }

    // Keeps the oldest entry with every flag that is on in any of them, and deletes the others.
    internal static async Task MergeDuplicatesAsync(IMongoCollection<BsonDocument> collection, string name, DateTime now, CancellationToken cancellationToken)
    {
        var entries = await collection.Find(EntryFilter(name))
            .Sort(Builders<BsonDocument>.Sort.Ascending(nameof(KeyValueEntry.CreatedDate)).Ascending("_id"))
            .ToListAsync(cancellationToken);
        if (entries.Count < 2)
        {
            return;
        }

        var keep = entries[0];
        var update = Builders<BsonDocument>.Update.Combine(FlagFields
            .Where(flag => entries.Exists(e => IsOn(e, flag)))
            .Select(flag => Builders<BsonDocument>.Update.Set(ValueField(flag), true)));
        if (FlagFields.Any(flag => entries.Exists(e => IsOn(e, flag))))
        {
            await collection.UpdateOneAsync(
                new BsonDocument("_id", keep["_id"]), KeyValueCollection.Touch(update, now), cancellationToken: cancellationToken);
        }

        await collection.DeleteManyAsync(
            EntryFilter(name).Add("_id", new BsonDocument("$ne", keep["_id"])), cancellationToken);
    }

    private static bool IsOn(BsonDocument entry, string flag) =>
        entry.TryGetValue(KeyValueCollection.ValueField, out var value)
        && value is BsonDocument item
        && item.TryGetValue(flag, out var on)
        && on is BsonBoolean { Value: true };

    private static BsonDocument EntryFilter(string name) => new(KeyValueCollection.KeyField, ActionConstants.ActionKey(name));

    private static string ValueField(string field) => $"{KeyValueCollection.ValueField}.{field}";

    private static BsonDocument PayloadOf(ActionDefinition entry)
    {
        var payload = new BsonDocument();
        foreach (var (field, type) in entry.Payload ?? [])
        {
            payload.Add(field, type);
        }

        return payload;
    }
}
