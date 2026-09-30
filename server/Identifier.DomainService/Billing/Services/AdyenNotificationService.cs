using DomainService.Billing.Entities;
using DomainService.Billing.Models;
using Microsoft.Extensions.Logging;
using MongoDB.Driver;

namespace DomainService.Billing.Services;

public interface IAdyenNotificationService
{
    /// <summary>
    /// Acts on one verified batch of notifications.
    /// </summary>
    /// <remarks>
    /// Adyen retries until it is acknowledged, so every item must be safe to process twice. Items
    /// that fail verification are dropped without acting, and the batch is still acknowledged —
    /// refusing it would only make Adyen resend something we will never accept.
    /// </remarks>
    Task HandleAsync(IReadOnlyList<AdyenNotificationItem> items, CancellationToken cancellationToken = default);
}

/// <summary>
/// Turns Adyen's notifications into order and card state.
/// </summary>
/// <remarks>
/// This is the authority on whether money moved. Where the charge response and the notification
/// disagree, the notification wins: the response can time out, be lost, or never arrive, while the
/// notification is signed and retried until acknowledged.
/// <para>
/// It is also the only path that files a card. A caller who could post a provider token could
/// attach someone else's card to their own project, so attaching happens here, from a signed
/// event, and nowhere else.
/// </para>
/// </remarks>
public sealed class AdyenNotificationService : IAdyenNotificationService
{
    private readonly ISubscriptionOrderStore _orders;
    private readonly IPaymentMethodService _paymentMethods;
    private readonly IProvisioningQueue _queue;
    private readonly IProcessedNotificationStore _processed;
    private readonly ILogger<AdyenNotificationService> _logger;
    private readonly TimeProvider _time;

    public AdyenNotificationService(
        ISubscriptionOrderStore orders,
        IPaymentMethodService paymentMethods,
        IProvisioningQueue queue,
        IProcessedNotificationStore processed,
        ILogger<AdyenNotificationService> logger,
        TimeProvider? timeProvider = null)
    {
        _orders = orders;
        _paymentMethods = paymentMethods;
        _queue = queue;
        _processed = processed;
        _logger = logger;
        _time = timeProvider ?? TimeProvider.System;
    }

    public async Task HandleAsync(IReadOnlyList<AdyenNotificationItem> items, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(items);

        foreach (var item in items)
        {
            // Adyen redelivers on any non-acknowledgement, so the same event arrives more than
            // once as a matter of course. Claiming the pspReference first is what keeps a repeat
            // from provisioning twice or filing a second copy of the same card.
            if (!await _processed.TryClaimAsync(item.PspReference, cancellationToken).ConfigureAwait(false))
            {
                continue;
            }

            try
            {
                switch (item.EventCode)
                {
                    case AdyenEventCodes.Authorisation:
                        await OnAuthorisationAsync(item, cancellationToken).ConfigureAwait(false);
                        break;

                    case AdyenEventCodes.RecurringContract:
                        await OnCardStoredAsync(item, cancellationToken).ConfigureAwait(false);
                        break;

                    default:
                        _logger.LogInformation("Ignoring Adyen event {EventCode}.", item.EventCode);
                        break;
                }
            }
            catch (Exception exception) when (exception is not OperationCanceledException)
            {
                // Release the claim so Adyen's next delivery can try again — swallowing it here
                // would make a transient failure permanent.
                await _processed.ReleaseAsync(item.PspReference, cancellationToken).ConfigureAwait(false);

                _logger.LogError(
                    exception,
                    "Adyen notification {PspReference} ({EventCode}) could not be handled.",
                    item.PspReference,
                    item.EventCode);
            }
        }
    }

    /// <summary>
    /// The charge's real answer. This is what resolves an order our own call left unknown.
    /// </summary>
    private async Task OnAuthorisationAsync(AdyenNotificationItem item, CancellationToken cancellationToken)
    {
        var order = await _orders
            .FindByReferenceAsync(item.MerchantReference, cancellationToken)
            .ConfigureAwait(false);

        if (order is null)
        {
            _logger.LogWarning(
                "Adyen authorised {MerchantReference}, which matches no order.",
                item.MerchantReference);
            return;
        }

        // Already settled by the synchronous response. The notification agreeing with it is the
        // ordinary case and there is nothing left to do.
        if (order.State != OrderStates.Pending)
        {
            return;
        }

        order.UpdatedAtUtc = _time.GetUtcNow().UtcDateTime;
        order.ProviderReference = item.PspReference;

        if (item.Success)
        {
            order.State = OrderStates.Paid;
            order.ChargedAtUtc = order.UpdatedAtUtc;
        }
        else
        {
            order.State = OrderStates.Declined;
            order.DeclineReason = string.IsNullOrWhiteSpace(item.Reason) ? "refused" : item.Reason;
        }

        await _orders.UpdateAsync(order, cancellationToken).ConfigureAwait(false);

        if (order.State == OrderStates.Paid)
        {
            _logger.LogInformation(
                "Order {OrderId} was resolved to paid by notification, not by our own call.",
                order.ItemId);

            await _queue.EnqueueAsync(order.TenantGroupId, order.ItemId, cancellationToken).ConfigureAwait(false);
        }
    }

    /// <summary>
    /// A card was stored. The shopper reference is the project group, so this says whose it is.
    /// </summary>
    private async Task OnCardStoredAsync(AdyenNotificationItem item, CancellationToken cancellationToken)
    {
        if (!item.Success)
        {
            return;
        }

        var tenantGroupId = Value(item, "shopperReference");
        var token = Value(item, "recurring.recurringDetailReference", "storedPaymentMethodId");

        if (string.IsNullOrWhiteSpace(tenantGroupId) || string.IsNullOrWhiteSpace(token))
        {
            _logger.LogWarning(
                "A stored-card notification arrived without a shopper reference or a token; ignoring it.");
            return;
        }

        var expiry = Value(item, "expiryDate");
        var (month, year) = ParseExpiry(expiry);

        var result = await _paymentMethods
            .AttachAsync(
                tenantGroupId,
                Value(item, "shopperEmail"),
                new AttachPaymentMethodRequest
                {
                    ProviderName = "adyen",
                    ProviderToken = token,
                    ProviderCustomerId = Value(item, "recurring.shopperReference") is { Length: > 0 } reference
                        ? reference
                        : tenantGroupId,
                    Brand = Value(item, "paymentMethod"),
                    LastFour = Value(item, "cardSummary"),
                    ExpiryMonth = month,
                    ExpiryYear = year,
                },
                cancellationToken)
            .ConfigureAwait(false);

        if (!result.IsSuccess)
        {
            // Throwing releases the claim above, so Adyen's retry gets another go at it.
            throw new InvalidOperationException($"The card could not be filed: {result.Reason}");
        }

        _logger.LogInformation("Filed a card for {TenantGroupId} from a stored-card notification.", tenantGroupId);
    }

    private static string Value(AdyenNotificationItem item, params string[] keys)
    {
        foreach (var key in keys)
        {
            if (item.AdditionalData.TryGetValue(key, out var value) && !string.IsNullOrWhiteSpace(value))
            {
                return value;
            }
        }

        return string.Empty;
    }

    /// <summary>Adyen sends <c>MM/YYYY</c>. Anything else leaves the expiry unset rather than wrong.</summary>
    private static (int Month, int Year) ParseExpiry(string expiry)
    {
        var parts = (expiry ?? string.Empty).Split('/');

        return parts.Length == 2
            && int.TryParse(parts[0], out var month)
            && int.TryParse(parts[1], out var year)
                ? (month, year)
                : (1, 2100);
    }
}

public interface IProcessedNotificationStore
{
    /// <summary>
    /// Claims an event id. False means it has already been handled and must not be handled again.
    /// </summary>
    Task<bool> TryClaimAsync(string pspReference, CancellationToken cancellationToken = default);

    /// <summary>Gives the claim back so a redelivery can retry after a transient failure.</summary>
    Task ReleaseAsync(string pspReference, CancellationToken cancellationToken = default);
}

/// <summary>
/// Remembers which notifications have been acted on, in the root database.
/// </summary>
/// <remarks>
/// A unique index on the event id does the work: claiming is an insert, and the duplicate-key
/// error <i>is</i> the answer. Checking first and inserting after would leave a gap two
/// simultaneous deliveries could both pass through.
/// </remarks>
public sealed class ProcessedNotificationStore : IProcessedNotificationStore
{
    public const string CollectionName = "ProcessedPaymentNotifications";

    private readonly IMongoCollection<ProcessedNotification> _collection;
    private readonly TimeProvider _time;

    public ProcessedNotificationStore(
        Blocks.Genesis.IDbContextProvider dbContextProvider,
        Blocks.Genesis.IBlocksSecret blocksSecret,
        TimeProvider? timeProvider = null)
    {
        ArgumentNullException.ThrowIfNull(dbContextProvider);
        ArgumentNullException.ThrowIfNull(blocksSecret);

        _time = timeProvider ?? TimeProvider.System;
        _collection = dbContextProvider
            .GetDatabase(blocksSecret.DatabaseConnectionString, blocksSecret.RootDatabaseName)
            .GetCollection<ProcessedNotification>(CollectionName);
    }

    public async Task<bool> TryClaimAsync(string pspReference, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(pspReference))
        {
            return false;
        }

        try
        {
            await _collection
                .InsertOneAsync(
                    new ProcessedNotification
                    {
                        PspReference = pspReference,
                        HandledAtUtc = _time.GetUtcNow().UtcDateTime,
                    },
                    cancellationToken: cancellationToken)
                .ConfigureAwait(false);

            return true;
        }
        catch (MongoWriteException exception)
            when (exception.WriteError?.Category == ServerErrorCategory.DuplicateKey)
        {
            return false;
        }
    }

    public async Task ReleaseAsync(string pspReference, CancellationToken cancellationToken = default) =>
        await _collection
            .DeleteOneAsync(
                Builders<ProcessedNotification>.Filter.Eq(n => n.PspReference, pspReference),
                cancellationToken)
            .ConfigureAwait(false);
}

public sealed class ProcessedNotification
{
    [MongoDB.Bson.Serialization.Attributes.BsonId]
    public string PspReference { get; set; } = string.Empty;

    public DateTime HandledAtUtc { get; set; }
}
