using DomainService.Billing.Entities;
using DomainService.Billing.Models;
using Microsoft.Extensions.Logging;

namespace DomainService.Billing.Services;

public interface IOrderPaymentService
{
    /// <summary>
    /// Takes payment for a started order and hands provisioning to the worker.
    /// </summary>
    /// <remarks>
    /// Returns as soon as the charge clears — it never waits for environments, which take minutes.
    /// The caller gets the order and watches it.
    /// </remarks>
    Task<OrderView> PayAsync(PayCheckoutRequest request, CancellationToken cancellationToken = default);
}

/// <summary>
/// The one place money is taken.
/// </summary>
/// <remarks>
/// Three rules live here, and each exists because of a failure that is otherwise silent.
/// <list type="number">
/// <item><description><b>One key, one charge.</b> A second call for an order already paid returns
/// that order untouched rather than charging again.</description></item>
/// <item><description><b>A timeout is not a decline.</b> An unknown outcome leaves the order
/// pending for the webhook to resolve; assuming failure would lose a charge that succeeded a
/// second later.</description></item>
/// <item><description><b>Payment gates creation.</b> Nothing is provisioned until the money is
/// ours, so a refusal leaves nothing to undo.</description></item>
/// </list>
/// </remarks>
public sealed class OrderPaymentService : IOrderPaymentService
{
    private readonly ISubscriptionOrderStore _orders;
    private readonly IPaymentMethodService _paymentMethods;
    private readonly IPaymentGateway _gateway;
    private readonly IProvisioningQueue _queue;
    private readonly ILogger<OrderPaymentService> _logger;
    private readonly TimeProvider _time;

    public OrderPaymentService(
        ISubscriptionOrderStore orders,
        IPaymentMethodService paymentMethods,
        IPaymentGateway gateway,
        IProvisioningQueue queue,
        ILogger<OrderPaymentService> logger,
        TimeProvider? timeProvider = null)
    {
        _orders = orders;
        _paymentMethods = paymentMethods;
        _gateway = gateway;
        _queue = queue;
        _logger = logger;
        _time = timeProvider ?? TimeProvider.System;
    }

    public async Task<OrderView> PayAsync(PayCheckoutRequest request, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(request);

        var order = await _orders
            .GetAsync(request.TenantGroupId, request.OrderId, cancellationToken)
            .ConfigureAwait(false);

        if (order is null)
        {
            return Failed(CheckoutFailures.OrderNotFound);
        }

        // The key is the proof that this call is the one that started checkout. A mismatch means a
        // stale tab or a crafted request, and neither should be able to charge.
        if (!string.Equals(order.IdempotencyKey, request.IdempotencyKey, StringComparison.Ordinal))
        {
            return Failed(CheckoutFailures.KeyMismatch);
        }

        // Already paid, already creating, already done — the answer is the order as it stands, and
        // emphatically not a second charge. This is the duplicate-call path.
        if (order.State != OrderStates.Pending)
        {
            return CheckoutService.ToView(order);
        }

        var utcNow = _time.GetUtcNow().UtcDateTime;

        if (order.ExpiresAtUtc <= utcNow)
        {
            order.State = OrderStates.Expired;
            order.UpdatedAtUtc = utcNow;
            await _orders.UpdateAsync(order, cancellationToken).ConfigureAwait(false);
            return CheckoutService.ToView(order);
        }

        var secret = await _paymentMethods
            .GetDefaultChargeSecretAsync(order.TenantGroupId, cancellationToken)
            .ConfigureAwait(false);

        if (secret is null || string.IsNullOrWhiteSpace(secret.ProviderToken))
        {
            return Failed(CheckoutFailures.NoCard);
        }

        // Marked before the call, not after: if the process dies mid-charge, the order must
        // already say a charge was attempted or the sweeper will expire it as abandoned.
        order.ChargeAttemptedAtUtc = _time.GetUtcNow().UtcDateTime;
        await _orders.UpdateAsync(order, cancellationToken).ConfigureAwait(false);

        var chargeRequest = new ChargeRequest
        {
            TenantGroupId = order.TenantGroupId,
            OrderId = order.ItemId,
            IdempotencyKey = order.IdempotencyKey,
            Amount = order.Total,
            Market = order.Market,
            StoredPaymentMethodId = secret.ProviderToken,
            ShopperReference = order.TenantGroupId,
        };

        var charge = await _gateway.ChargeStoredCardAsync(chargeRequest, cancellationToken).ConfigureAwait(false);

        // One immediate replay, and only for a transport failure. The same key means the provider
        // returns its original answer rather than charging again — which is what makes "did my
        // request land?" answerable at all.
        //
        // Deliberately once, and deliberately now. A scheduled replay hours later would fall
        // outside the provider's idempotency window, where a replay stops reporting the first
        // charge and becomes a second one.
        if (charge.Outcome == ChargeOutcome.Unknown)
        {
            _logger.LogWarning(
                "No answer for order {OrderId} ({Reason}); replaying once with the same key.",
                order.ItemId,
                charge.Reason);

            charge = await _gateway.ChargeStoredCardAsync(chargeRequest, cancellationToken).ConfigureAwait(false);
        }

        order.UpdatedAtUtc = _time.GetUtcNow().UtcDateTime;
        order.ProviderName = "adyen";

        switch (charge.Outcome)
        {
            case ChargeOutcome.Authorised:
                order.State = OrderStates.Paid;
                order.ProviderReference = charge.ProviderReference;
                order.ChargedAtUtc = order.UpdatedAtUtc;
                break;

            case ChargeOutcome.Refused:
                order.State = OrderStates.Declined;
                order.DeclineReason = charge.Reason;
                break;

            default:
                // Stays pending, and stays pending until the provider says otherwise — by webhook,
                // or by a person reading the provider's dashboard. Never by a timer, and never by
                // this method assuming the worst.
                _logger.LogError(
                    "Order {OrderId} has an unresolved charge ({Reason}). It will not be expired; "
                    + "resolve it against the provider.",
                    order.ItemId,
                    charge.Reason);
                break;
        }

        await _orders.UpdateAsync(order, cancellationToken).ConfigureAwait(false);

        if (order.State == OrderStates.Paid)
        {
            // Enqueue for promptness only. The durable work item is the order row itself, sitting
            // in Paid with no completion — which is what the sweeper looks for when this message
            // is lost or the worker restarts mid-job.
            await _queue.EnqueueAsync(order.TenantGroupId, order.ItemId, cancellationToken).ConfigureAwait(false);
        }

        return CheckoutService.ToView(order);
    }

    private static OrderView Failed(string reason) => new() { State = reason };
}
