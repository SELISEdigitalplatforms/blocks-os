using Blocks.Genesis;
using DomainService.Billing.Entities;
using MongoDB.Driver;

namespace DomainService.Billing.Services;

public interface ISubscriptionStore
{
    Task<ProjectSubscription?> GetAsync(string tenantGroupId, CancellationToken cancellationToken = default);

    /// <summary>Subscriptions whose next charge has come due, oldest first.</summary>
    Task<IReadOnlyList<ProjectSubscription>> FindDueAsync(DateTime utcNow, int limit, CancellationToken cancellationToken = default);

    Task UpsertAsync(ProjectSubscription subscription, CancellationToken cancellationToken = default);
}

public interface IInvoiceStore
{
    Task<IReadOnlyList<Invoice>> ListAsync(string tenantGroupId, int limit, CancellationToken cancellationToken = default);

    Task InsertAsync(Invoice invoice, CancellationToken cancellationToken = default);

    /// <summary>One invoice, scoped to its project so an id alone cannot reach another's.</summary>
    Task<Invoice?> GetAsync(string tenantGroupId, string invoiceId, CancellationToken cancellationToken = default);

    /// <summary>Next number for the month. Sequential per month, and gap-free enough to audit.</summary>
    Task<string> NextNumberAsync(DateTime issuedAtUtc, CancellationToken cancellationToken = default);

    /// <summary>The invoice written for an order, if any. Scoped to its project.</summary>
    Task<Invoice?> FindByOrderAsync(string tenantGroupId, string orderId, CancellationToken cancellationToken = default);

    /// <summary>The newest invoice still unpaid, if any.</summary>
    Task<Invoice?> FindLatestUnpaidAsync(string tenantGroupId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Settles an unpaid invoice once its amount is collected by a retry. The only change an
    /// invoice ever takes: what it billed stays exactly as issued.
    /// </summary>
    Task MarkPaidAsync(string tenantGroupId, string invoiceId, string providerReference, DateTime paidAtUtc, CancellationToken cancellationToken = default);
}

public sealed class SubscriptionStore : ISubscriptionStore
{
    public const string CollectionName = "ProjectSubscriptions";

    private readonly IMongoCollection<ProjectSubscription> _collection;

    public SubscriptionStore(IDbContextProvider dbContextProvider, IBlocksSecret blocksSecret)
    {
        ArgumentNullException.ThrowIfNull(dbContextProvider);
        ArgumentNullException.ThrowIfNull(blocksSecret);

        _collection = dbContextProvider
            .GetDatabase(blocksSecret.DatabaseConnectionString, blocksSecret.RootDatabaseName)
            .GetCollection<ProjectSubscription>(CollectionName);
    }

    public async Task<ProjectSubscription?> GetAsync(string tenantGroupId, CancellationToken cancellationToken = default) =>
        string.IsNullOrWhiteSpace(tenantGroupId)
            ? null
            : await _collection
                .Find(Builders<ProjectSubscription>.Filter.Eq(s => s.TenantGroupId, tenantGroupId))
                .FirstOrDefaultAsync(cancellationToken)
                .ConfigureAwait(false);

    public async Task<IReadOnlyList<ProjectSubscription>> FindDueAsync(
        DateTime utcNow,
        int limit,
        CancellationToken cancellationToken = default) =>
        await _collection
            .Find(Builders<ProjectSubscription>.Filter.And(
                Builders<ProjectSubscription>.Filter.Ne(s => s.State, SubscriptionStates.Cancelled),
                Builders<ProjectSubscription>.Filter.Lte(s => s.NextChargeAtUtc, utcNow)))
            .SortBy(s => s.NextChargeAtUtc)
            .Limit(limit)
            .ToListAsync(cancellationToken)
            .ConfigureAwait(false);

    public async Task UpsertAsync(ProjectSubscription subscription, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(subscription);

        await _collection
            .ReplaceOneAsync(
                Builders<ProjectSubscription>.Filter.Eq(s => s.TenantGroupId, subscription.TenantGroupId),
                subscription,
                new ReplaceOptions { IsUpsert = true },
                cancellationToken)
            .ConfigureAwait(false);
    }
}

public sealed class InvoiceStore : IInvoiceStore
{
    public const string CollectionName = "Invoices";

    private readonly IMongoCollection<Invoice> _collection;

    public InvoiceStore(IDbContextProvider dbContextProvider, IBlocksSecret blocksSecret)
    {
        ArgumentNullException.ThrowIfNull(dbContextProvider);
        ArgumentNullException.ThrowIfNull(blocksSecret);

        _collection = dbContextProvider
            .GetDatabase(blocksSecret.DatabaseConnectionString, blocksSecret.RootDatabaseName)
            .GetCollection<Invoice>(CollectionName);
    }

    public async Task<IReadOnlyList<Invoice>> ListAsync(
        string tenantGroupId,
        int limit,
        CancellationToken cancellationToken = default) =>
        await _collection
            .Find(Builders<Invoice>.Filter.Eq(i => i.TenantGroupId, tenantGroupId))
            .SortByDescending(i => i.IssuedAtUtc)
            .Limit(limit)
            .ToListAsync(cancellationToken)
            .ConfigureAwait(false);

    public async Task<Invoice?> GetAsync(string tenantGroupId, string invoiceId, CancellationToken cancellationToken = default) =>
        await _collection
            .Find(Builders<Invoice>.Filter.And(
                Builders<Invoice>.Filter.Eq(i => i.TenantGroupId, tenantGroupId),
                Builders<Invoice>.Filter.Eq(i => i.ItemId, invoiceId)))
            .FirstOrDefaultAsync(cancellationToken)
            .ConfigureAwait(false);

    public async Task InsertAsync(Invoice invoice, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(invoice);

        await _collection
            .InsertOneAsync(invoice, cancellationToken: cancellationToken)
            .ConfigureAwait(false);
    }

    public async Task<Invoice?> FindByOrderAsync(string tenantGroupId, string orderId, CancellationToken cancellationToken = default) =>
        string.IsNullOrWhiteSpace(tenantGroupId) || string.IsNullOrWhiteSpace(orderId)
            ? null
            : await _collection
                .Find(Builders<Invoice>.Filter.And(
                    Builders<Invoice>.Filter.Eq(i => i.TenantGroupId, tenantGroupId),
                    Builders<Invoice>.Filter.Eq(i => i.OrderId, orderId)))
                .FirstOrDefaultAsync(cancellationToken)
                .ConfigureAwait(false);

    public async Task<Invoice?> FindLatestUnpaidAsync(string tenantGroupId, CancellationToken cancellationToken = default) =>
        string.IsNullOrWhiteSpace(tenantGroupId)
            ? null
            : await _collection
                .Find(Builders<Invoice>.Filter.And(
                    Builders<Invoice>.Filter.Eq(i => i.TenantGroupId, tenantGroupId),
                    Builders<Invoice>.Filter.Eq(i => i.State, InvoiceStates.Unpaid)))
                .SortByDescending(i => i.IssuedAtUtc)
                .FirstOrDefaultAsync(cancellationToken)
                .ConfigureAwait(false);

    public async Task MarkPaidAsync(
        string tenantGroupId,
        string invoiceId,
        string providerReference,
        DateTime paidAtUtc,
        CancellationToken cancellationToken = default) =>
        await _collection
            .UpdateOneAsync(
                Builders<Invoice>.Filter.And(
                    Builders<Invoice>.Filter.Eq(i => i.TenantGroupId, tenantGroupId),
                    Builders<Invoice>.Filter.Eq(i => i.ItemId, invoiceId),
                    Builders<Invoice>.Filter.Eq(i => i.State, InvoiceStates.Unpaid)),
                Builders<Invoice>.Update
                    .Set(i => i.State, InvoiceStates.Paid)
                    .Set(i => i.PaidAtUtc, paidAtUtc)
                    .Set(i => i.ProviderReference, providerReference)
                    .Set(i => i.NextRetryUtc, null),
                cancellationToken: cancellationToken)
            .ConfigureAwait(false);

    /// <remarks>
    /// Counts what the month already has. Good enough for a human-facing number and honest about
    /// what it is: if two invoices are issued in the same instant they can collide, which the
    /// unique index on the number turns into a retry rather than two invoices sharing one.
    /// </remarks>
    public async Task<string> NextNumberAsync(DateTime issuedAtUtc, CancellationToken cancellationToken = default)
    {
        var monthStart = new DateTime(issuedAtUtc.Year, issuedAtUtc.Month, 1, 0, 0, 0, DateTimeKind.Utc);
        var monthEnd = monthStart.AddMonths(1);

        var soFar = await _collection
            .CountDocumentsAsync(
                Builders<Invoice>.Filter.And(
                    Builders<Invoice>.Filter.Gte(i => i.IssuedAtUtc, monthStart),
                    Builders<Invoice>.Filter.Lt(i => i.IssuedAtUtc, monthEnd)),
                cancellationToken: cancellationToken)
            .ConfigureAwait(false);

        return $"INV-{issuedAtUtc:yyyy-MM}-{soFar + 1:D4}";
    }
}
