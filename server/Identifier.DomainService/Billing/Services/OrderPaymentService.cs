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
    private readonly IProjectInventory? _inventory;
    private readonly IOrderInvoiceWriter? _invoices;
    private readonly DomainService.Catalogue.Services.ICatalogueProvider? _catalogue;

    public OrderPaymentService(
        ISubscriptionOrderStore orders,
        IPaymentMethodService paymentMethods,
        IPaymentGateway gateway,
        IProvisioningQueue queue,
        ILogger<OrderPaymentService> logger,
        TimeProvider? timeProvider = null,
        IProjectInventory? inventory = null,
        IOrderInvoiceWriter? invoices = null,
        DomainService.Catalogue.Services.ICatalogueProvider? catalogue = null)
    {
        _orders = orders;
        _paymentMethods = paymentMethods;
        _gateway = gateway;
        _queue = queue;
        _logger = logger;
        _time = timeProvider ?? TimeProvider.System;
        _inventory = inventory;
        _invoices = invoices;
        _catalogue = catalogue;
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

        // Checked again here, not only at start: two checkout tabs can each start an order for
        // the same environment, and only the first one paid may go through. The second would be
        // charged for a tenant provisioning then adopts rather than creates.
        if (_inventory is not null)
        {
            var held = await _inventory
                .GetAsync(order.TenantGroupId, order.ItemId, cancellationToken)
                .ConfigureAwait(false);

            if (order.Lines.Any(l => l.Kind == "environment" && held.HasOrIsCreating(l.Environment)))
            {
                return Failed(CheckoutFailures.EnvironmentExists);
            }

            // An upgrade is for a free environment that is still free and that no other paid order
            // is already upgrading.
            foreach (var line in order.Lines.Where(l => l.Kind == "upgrade"))
            {
                if (held.UpgradesInFlight.Contains(line.Environment))
                {
                    return Failed(CheckoutFailures.EnvironmentExists);
                }

                if (!held.FreeEnvironments.Contains(line.Environment))
                {
                    return Failed(CheckoutFailures.NothingToUpgrade);
                }
            }

            foreach (var line in order.Lines.Where(l => l.Kind == "environment" && l.FreeTier))
            {
                var max = FreeLimit(line.Environment);

                if (held.FreeHeld(line.Environment) + 1 > max)
                {
                    return Failed(CheckoutFailures.FreeTierTaken);
                }
            }
        }

        // Nothing to charge — the free tier, alone. No card is needed and the provider is not
        // called: there is no money to move and no answer to wait for. Everything after the
        // charge is exactly what a paid order gets, so the free environment is built the same way.
        if (order.Total <= 0m)
        {
            var paidAt = _time.GetUtcNow().UtcDateTime;
            order.State = OrderStates.Paid;
            order.ProviderName = "none";
            order.ChargedAtUtc = paidAt;
            order.UpdatedAtUtc = paidAt;

            await _orders.UpdateAsync(order, cancellationToken).ConfigureAwait(false);
            await _queue.EnqueueAsync(order.TenantGroupId, order.ItemId, cancellationToken).ConfigureAwait(false);

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

        if (order.State == OrderStates.Paid && _invoices is not null)
        {
            // The record of the money, written before provisioning starts: the charge happened
            // whether or not the environments ever finish.
            await _invoices.WriteAsync(order, cancellationToken).ConfigureAwait(false);
        }

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

    /// <summary>
    /// The free allowance for an environment, from the catalogue. One when no catalogue is at
    /// hand: the order was priced with a free line, so the environment offered at least that.
    /// </summary>
    private int FreeLimit(string environment) =>
        _catalogue?.Catalogue.Environments.TryGetValue(environment, out var definition) == true
            ? Math.Max(0, definition.MaxFreePerProject)
            : 1;
}
