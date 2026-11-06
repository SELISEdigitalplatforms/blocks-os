using Blocks.Genesis;
using Configuration.DomainService.Shared.Services;
using MongoDB.Bson;
using MongoDB.Driver;

namespace Configuration.DomainService.Webhooks;

/// <summary>The fields an update writes. A null <see cref="SecretRef"/> keeps the stored secret.</summary>
public sealed record WebhookUpdate(
    string Id,
    string Name,
    string Url,
    bool IsActive,
    IReadOnlyList<string> Actions,
    string? SecretRef,
    DateTime? SecretChangedDate,
    bool ResetFailures);

public enum WebhookWriteResult
{
    Written,
    NotFound,
    NameTaken
}

/// <summary>Result of counting one final failure.</summary>
public sealed record WebhookFailureCount(int ConsecutiveFailures, bool TurnedOff);

/// <summary>
/// The context tenant's <c>webhooks</c> KV list. Data access only. Every write changes one item with one atomic
/// update (never a rewrite of the whole list), so concurrent saves of different webhooks never lose each other.
/// </summary>
public interface IWebhookRepository
{
    Task<IReadOnlyList<WebhookEntry>> GetAllAsync(CancellationToken cancellationToken);

    Task<WebhookEntry?> GetAsync(string id, CancellationToken cancellationToken);

    /// <summary>Adds the webhook unless another one has the same name (case-insensitive).</summary>
    Task<WebhookWriteResult> InsertAsync(WebhookEntry entry, CancellationToken cancellationToken);

    Task<WebhookWriteResult> UpdateAsync(WebhookUpdate update, CancellationToken cancellationToken);

    Task<bool> DeleteAsync(string id, CancellationToken cancellationToken);

    /// <summary>Adds one to the failure counter; at <paramref name="threshold"/> turns the webhook off.</summary>
    Task<WebhookFailureCount> RecordFinalFailureAsync(string id, int threshold, string disabledReason, CancellationToken cancellationToken);

    /// <summary>Sets the failure counter back to 0 (only writes when it is not 0).</summary>
    Task ResetFailuresAsync(string id, CancellationToken cancellationToken);
}

/// <inheritdoc cref="IWebhookRepository"/>
public sealed class WebhookRepository : IWebhookRepository
{
    /// <summary>Fixed row id, so two first saves at once cannot create two <c>webhooks</c> rows.</summary>
    internal const string RowId = "webhooks";

    private const string Value = KeyValueCollection.ValueField;
    private const string ItemFilter = "w";
    private const string IdField = nameof(WebhookEntry.Id);
    private const string NameKeyField = nameof(WebhookEntry.NameKey);
    private const string IsActiveField = nameof(WebhookEntry.IsActive);
    private const string FailuresField = nameof(WebhookEntry.ConsecutiveFailures);
    private const string DisabledReasonField = nameof(WebhookEntry.DisabledReason);

    private readonly IKeyValueStore _keyValueStore;
    private readonly IDbContextProvider _dbContextProvider;
    private readonly TimeProvider _timeProvider;

    public WebhookRepository(IKeyValueStore keyValueStore, IDbContextProvider dbContextProvider, TimeProvider timeProvider)
    {
        _keyValueStore = keyValueStore;
        _dbContextProvider = dbContextProvider;
        _timeProvider = timeProvider;
    }

    public async Task<IReadOnlyList<WebhookEntry>> GetAllAsync(CancellationToken cancellationToken)
    {
        var entries = await _keyValueStore.GetAsync<List<WebhookEntry>>(ActionConstants.WebhooksKey, impersonated: true, cancellationToken);
        return entries?.Where(e => e is not null).ToList() ?? [];
    }

    public async Task<WebhookEntry?> GetAsync(string id, CancellationToken cancellationToken) =>
        (await GetAllAsync(cancellationToken)).FirstOrDefault(e => string.Equals(e.Id, id, StringComparison.Ordinal));

    public async Task<WebhookWriteResult> InsertAsync(WebhookEntry entry, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(entry);
        var collection = Collection();
        await EnsureRowAsync(collection, cancellationToken);

        var filter = new BsonDocument
        {
            { KeyValueCollection.KeyField, ActionConstants.WebhooksKey },
            { Value, new BsonDocument("$not", ElemMatch(new BsonDocument(NameKeyField, entry.NameKey))) }
        };
        var update = Touch(Builders<BsonDocument>.Update.Push(Value, entry.ToBsonDocument()));
        var result = await collection.UpdateOneAsync(filter, update, cancellationToken: cancellationToken);
        return result.MatchedCount > 0 ? WebhookWriteResult.Written : WebhookWriteResult.NameTaken;
    }

    public async Task<WebhookWriteResult> UpdateAsync(WebhookUpdate update, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(update);
        var nameKey = WebhookEntry.KeyOf(update.Name);
        var filter = new BsonDocument
        {
            { KeyValueCollection.KeyField, ActionConstants.WebhooksKey },
            {
                "$and", new BsonArray
                {
                    new BsonDocument(Value, ElemMatch(new BsonDocument(IdField, update.Id))),
                    new BsonDocument(Value, new BsonDocument("$not", ElemMatch(new BsonDocument
                    {
                        { NameKeyField, nameKey },
                        { IdField, new BsonDocument("$ne", update.Id) }
                    })))
                }
            }
        };

        var result = await Collection().UpdateOneAsync(filter, Touch(UpdateFields(update, nameKey)), ForItem(update.Id), cancellationToken);
        if (result.MatchedCount > 0)
        {
            return WebhookWriteResult.Written;
        }

        return await GetAsync(update.Id, cancellationToken) is null ? WebhookWriteResult.NotFound : WebhookWriteResult.NameTaken;
    }

    public async Task<bool> DeleteAsync(string id, CancellationToken cancellationToken)
    {
        var pull = new BsonDocumentUpdateDefinition<BsonDocument>(
            new BsonDocument("$pull", new BsonDocument(Value, new BsonDocument(IdField, id))));
        var result = await Collection().UpdateOneAsync(ItemFilterOf(new BsonDocument(IdField, id)), Touch(pull), cancellationToken: cancellationToken);
        return result.MatchedCount > 0;
    }

    public async Task<WebhookFailureCount> RecordFinalFailureAsync(string id, int threshold, string disabledReason, CancellationToken cancellationToken)
    {
        var collection = Collection();
        var row = await collection.FindOneAndUpdateAsync(
            ItemFilterOf(new BsonDocument(IdField, id)),
            Builders<BsonDocument>.Update.Inc(Item(FailuresField), 1),
            new FindOneAndUpdateOptions<BsonDocument> { ArrayFilters = ItemArrayFilter(id), ReturnDocument = ReturnDocument.After },
            cancellationToken);
        var count = FailuresOf(row, id);
        if (count < threshold)
        {
            return new WebhookFailureCount(count, false);
        }

        var turnOff = Builders<BsonDocument>.Update
            .Set($"{Value}.$.{IsActiveField}", false)
            .Set($"{Value}.$.{DisabledReasonField}", disabledReason);
        var result = await collection.UpdateOneAsync(
            ItemFilterOf(new BsonDocument { { IdField, id }, { IsActiveField, true } }),
            Touch(turnOff),
            cancellationToken: cancellationToken);
        return new WebhookFailureCount(count, result.ModifiedCount > 0);
    }

    public Task ResetFailuresAsync(string id, CancellationToken cancellationToken) =>
        Collection().UpdateOneAsync(
            ItemFilterOf(new BsonDocument { { IdField, id }, { FailuresField, new BsonDocument("$gt", 0) } }),
            Builders<BsonDocument>.Update.Set($"{Value}.$.{FailuresField}", 0),
            cancellationToken: cancellationToken);

    private IMongoCollection<BsonDocument> Collection() => KeyValueCollection.Of(_dbContextProvider);

    private UpdateDefinition<BsonDocument> Touch(UpdateDefinition<BsonDocument> update) =>
        KeyValueCollection.Touch(update, _timeProvider.GetUtcNow().UtcDateTime);

    // Creates the empty row once; a row that already exists (any id) is left as it is.
    private async Task EnsureRowAsync(IMongoCollection<BsonDocument> collection, CancellationToken cancellationToken)
    {
        var now = _timeProvider.GetUtcNow().UtcDateTime;
        var context = BlocksContext.GetContext();
        var insert = Builders<BsonDocument>.Update
            .SetOnInsert("_id", RowId)
            .SetOnInsert(KeyValueCollection.KeyField, ActionConstants.WebhooksKey)
            .SetOnInsert(Value, new BsonArray())
            .SetOnInsert(nameof(KeyValueEntry.Tags), new BsonArray())
            .SetOnInsert(nameof(KeyValueEntry.CreatedDate), now)
            .SetOnInsert(nameof(KeyValueEntry.CreatedBy), context?.UserId)
            .SetOnInsert(nameof(KeyValueEntry.OrganizationId), string.IsNullOrWhiteSpace(context?.OrganizationId) ? "default" : context.OrganizationId)
            .SetOnInsert(KeyValueCollection.LastUpdatedDateField, now);
        try
        {
            await collection.UpdateOneAsync(
                new BsonDocument(KeyValueCollection.KeyField, ActionConstants.WebhooksKey),
                insert,
                new UpdateOptions { IsUpsert = true },
                cancellationToken);
        }
        catch (MongoWriteException ex) when (ex.WriteError?.Category == ServerErrorCategory.DuplicateKey)
        {
            // Another save created the row first; it is there now.
        }
    }

    private static UpdateDefinition<BsonDocument> UpdateFields(WebhookUpdate update, string nameKey)
    {
        var fields = Builders<BsonDocument>.Update
            .Set(Item(nameof(WebhookEntry.Name)), update.Name)
            .Set(Item(NameKeyField), nameKey)
            .Set(Item(nameof(WebhookEntry.Url)), update.Url)
            .Set(Item(IsActiveField), update.IsActive)
            .Set(Item(nameof(WebhookEntry.Actions)), new BsonArray(update.Actions));
        if (update.SecretRef is not null)
        {
            fields = fields
                .Set(Item(nameof(WebhookEntry.SecretRef)), update.SecretRef)
                .Set(Item(nameof(WebhookEntry.SecretChangedDate)), update.SecretChangedDate);
        }

        if (update.IsActive)
        {
            fields = fields.Set(Item(DisabledReasonField), BsonNull.Value);
        }

        return update.ResetFailures ? fields.Set(Item(FailuresField), 0) : fields;
    }

    private static string Item(string field) => $"{Value}.$[{ItemFilter}].{field}";

    private static BsonDocument ElemMatch(BsonDocument condition) => new("$elemMatch", condition);

    private static BsonDocument ItemFilterOf(BsonDocument condition) => new()
    {
        { KeyValueCollection.KeyField, ActionConstants.WebhooksKey },
        { Value, ElemMatch(condition) }
    };

    private static List<ArrayFilterDefinition> ItemArrayFilter(string id) =>
        [new BsonDocumentArrayFilterDefinition<BsonDocument>(new BsonDocument($"{ItemFilter}.{IdField}", id))];

    private static UpdateOptions ForItem(string id) => new() { ArrayFilters = ItemArrayFilter(id) };

    private static int FailuresOf(BsonDocument? row, string id)
    {
        if (row is null || !row.TryGetValue(Value, out var value) || !value.IsBsonArray)
        {
            return 0;
        }

        var item = value.AsBsonArray
            .Where(v => v.IsBsonDocument)
            .Select(v => v.AsBsonDocument)
            .FirstOrDefault(d => d.TryGetValue(IdField, out var itemId) && itemId == id);
        return item is not null && item.TryGetValue(FailuresField, out var failures) && failures.IsNumeric ? failures.ToInt32() : 0;
    }
}
