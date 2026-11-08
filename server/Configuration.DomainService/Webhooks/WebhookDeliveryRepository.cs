using System.Collections.Concurrent;
using Blocks.Genesis;
using MongoDB.Driver;

namespace Configuration.DomainService.Webhooks;

/// <summary>
/// The context tenant's <c>WebhookDeliveries</c> history. Data access only. A unique index on (EventId, WebhookId)
/// makes a redelivered action never create a second row. No TTL: history is kept with no time limit (user, 2026-11-04).
/// </summary>
public interface IWebhookDeliveryRepository
{
    /// <summary>False when a row for the same event and webhook already exists.</summary>
    Task<bool> InsertAsync(WebhookDelivery delivery, CancellationToken cancellationToken);

    Task<WebhookDelivery?> GetAsync(string id, CancellationToken cancellationToken);

    Task<WebhookDelivery?> GetByEventAsync(string eventId, string webhookId, CancellationToken cancellationToken);

    /// <summary>
    /// Claims attempt <paramref name="attempt"/> of the current run: only a row still in flight whose run made
    /// exactly <paramref name="attempt"/> - 1 attempts. Null when the row is done or the attempt was already claimed.
    /// </summary>
    Task<WebhookDelivery?> TryStartAttemptAsync(string id, int attempt, CancellationToken cancellationToken);

    Task RecordAttemptAsync(string id, WebhookAttempt attempt, string status, DateTime? nextAttemptAt, CancellationToken cancellationToken);

    /// <summary>Ends the row without an HTTP attempt (Skipped or Failed with a reason).</summary>
    Task MarkAsync(string id, string status, string reason, CancellationToken cancellationToken);

    /// <summary>
    /// Starts a resend run when the row is Delivered or Failed, or in flight but untouched since
    /// <paramref name="staleBefore"/>. Returns the row as it was before, or null when it cannot start.
    /// </summary>
    Task<WebhookDelivery?> TryStartResendAsync(string id, DateTime staleBefore, CancellationToken cancellationToken);

    /// <summary>Puts the status back after a resend that could not be queued.</summary>
    Task RestoreStatusAsync(string id, string status, CancellationToken cancellationToken);

    Task<WebhookDeliveryPage> ListAsync(WebhookDeliveriesQuery query, CancellationToken cancellationToken);
}

/// <inheritdoc cref="IWebhookDeliveryRepository"/>
public sealed class WebhookDeliveryRepository : IWebhookDeliveryRepository
{
    public const string CollectionName = "WebhookDeliveries";
    public const string EventWebhookIndexName = "EventId_WebhookId_unique";
    public const string WebhookCreatedIndexName = "WebhookId_CreatedDate";

    private static readonly ConcurrentDictionary<string, byte> IndexedDatabases = new();

    private readonly IDbContextProvider _dbContextProvider;
    private readonly TimeProvider _timeProvider;

    public WebhookDeliveryRepository(IDbContextProvider dbContextProvider, TimeProvider timeProvider)
    {
        _dbContextProvider = dbContextProvider;
        _timeProvider = timeProvider;
    }

    private static FilterDefinitionBuilder<WebhookDelivery> Filter => Builders<WebhookDelivery>.Filter;

    private static UpdateDefinitionBuilder<WebhookDelivery> Update => Builders<WebhookDelivery>.Update;

    public async Task<bool> InsertAsync(WebhookDelivery delivery, CancellationToken cancellationToken)
    {
        var collection = await IndexedCollectionAsync(cancellationToken);
        try
        {
            await collection.InsertOneAsync(delivery, cancellationToken: cancellationToken);
            return true;
        }
        catch (MongoWriteException ex) when (ex.WriteError?.Category == ServerErrorCategory.DuplicateKey)
        {
            return false;
        }
    }

    public async Task<WebhookDelivery?> GetAsync(string id, CancellationToken cancellationToken) =>
        await Collection().Find(Filter.Eq(d => d.ItemId, id)).FirstOrDefaultAsync(cancellationToken);

    public async Task<WebhookDelivery?> GetByEventAsync(string eventId, string webhookId, CancellationToken cancellationToken) =>
        await Collection()
            .Find(Filter.Eq(d => d.EventId, eventId) & Filter.Eq(d => d.WebhookId, webhookId))
            .FirstOrDefaultAsync(cancellationToken);

    public async Task<WebhookDelivery?> TryStartAttemptAsync(string id, int attempt, CancellationToken cancellationToken)
    {
        var filter = Filter.Eq(d => d.ItemId, id)
            & Filter.In(d => d.Status, WebhookDeliveryStatus.InFlight)
            & Filter.Eq(d => d.RunAttempts, attempt - 1);
        var update = Update.Inc(d => d.RunAttempts, 1).Set(d => d.LastUpdatedDate, Now());
        return await Collection().FindOneAndUpdateAsync(
            filter,
            update,
            new FindOneAndUpdateOptions<WebhookDelivery> { ReturnDocument = ReturnDocument.After },
            cancellationToken);
    }

    public Task RecordAttemptAsync(string id, WebhookAttempt attempt, string status, DateTime? nextAttemptAt, CancellationToken cancellationToken) =>
        Collection().UpdateOneAsync(
            Filter.Eq(d => d.ItemId, id),
            Update.Push(d => d.Attempts, attempt)
                .Set(d => d.Status, status)
                .Set(d => d.StatusReason, null)
                .Set(d => d.NextAttemptAt, nextAttemptAt)
                .Set(d => d.LastUpdatedDate, Now()),
            cancellationToken: cancellationToken);

    public Task MarkAsync(string id, string status, string reason, CancellationToken cancellationToken) =>
        Collection().UpdateOneAsync(
            Filter.Eq(d => d.ItemId, id),
            Update.Set(d => d.Status, status)
                .Set(d => d.StatusReason, reason)
                .Set(d => d.NextAttemptAt, null)
                .Set(d => d.LastUpdatedDate, Now()),
            cancellationToken: cancellationToken);

    public async Task<WebhookDelivery?> TryStartResendAsync(string id, DateTime staleBefore, CancellationToken cancellationToken)
    {
        var done = Filter.In(d => d.Status, WebhookDeliveryStatus.Resendable);
        var stuck = Filter.In(d => d.Status, WebhookDeliveryStatus.InFlight) & Filter.Lt(d => d.LastUpdatedDate, staleBefore);
        var update = Update.Set(d => d.Status, WebhookDeliveryStatus.Pending)
            .Set(d => d.StatusReason, null)
            .Set(d => d.NextAttemptAt, null)
            .Set(d => d.RunAttempts, 0)
            .Set(d => d.LastUpdatedDate, Now());
        return await Collection().FindOneAndUpdateAsync(
            Filter.Eq(d => d.ItemId, id) & (done | stuck),
            update,
            new FindOneAndUpdateOptions<WebhookDelivery> { ReturnDocument = ReturnDocument.Before },
            cancellationToken);
    }

    public Task RestoreStatusAsync(string id, string status, CancellationToken cancellationToken) =>
        Collection().UpdateOneAsync(
            Filter.Eq(d => d.ItemId, id),
            Update.Set(d => d.Status, status).Set(d => d.LastUpdatedDate, Now()),
            cancellationToken: cancellationToken);

    public async Task<WebhookDeliveryPage> ListAsync(WebhookDeliveriesQuery query, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(query);
        var filter = Filter.Eq(d => d.WebhookId, query.WebhookId);
        if (!string.IsNullOrWhiteSpace(query.Status))
        {
            filter &= Filter.Eq(d => d.Status, query.Status);
        }

        if (!string.IsNullOrWhiteSpace(query.Action))
        {
            filter &= Filter.Eq(d => d.Action, query.Action);
        }

        var collection = await IndexedCollectionAsync(cancellationToken);
        var total = await collection.CountDocumentsAsync(filter, cancellationToken: cancellationToken);
        var rows = await collection.Find(filter)
            .SortByDescending(d => d.CreatedDate)
            .Skip((query.Page - 1) * query.PageSize)
            .Limit(query.PageSize)
            .ToListAsync(cancellationToken);
        return new WebhookDeliveryPage(total, [.. rows.Select(WebhookDeliveryView.From)]);
    }

    private DateTime Now() => _timeProvider.GetUtcNow().UtcDateTime;

    private IMongoCollection<WebhookDelivery> Collection()
    {
        var database = _dbContextProvider.GetDatabase()
            ?? throw new InvalidOperationException("No tenant database in the current context.");
        return database.GetCollection<WebhookDelivery>(CollectionName);
    }

    private async Task<IMongoCollection<WebhookDelivery>> IndexedCollectionAsync(CancellationToken cancellationToken)
    {
        var collection = Collection();
        var key = collection.Database.DatabaseNamespace.DatabaseName;
        if (IndexedDatabases.ContainsKey(key))
        {
            return collection;
        }

        var keys = Builders<WebhookDelivery>.IndexKeys;
        await collection.Indexes.CreateManyAsync(
        [
            new CreateIndexModel<WebhookDelivery>(
                keys.Ascending(d => d.EventId).Ascending(d => d.WebhookId),
                new CreateIndexOptions { Name = EventWebhookIndexName, Unique = true }),
            new CreateIndexModel<WebhookDelivery>(
                keys.Ascending(d => d.WebhookId).Descending(d => d.CreatedDate),
                new CreateIndexOptions { Name = WebhookCreatedIndexName })
        ], cancellationToken);
        IndexedDatabases.TryAdd(key, 0);
        return collection;
    }
}
