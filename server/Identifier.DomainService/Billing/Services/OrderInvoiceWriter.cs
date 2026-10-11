using DomainService.Billing.Entities;
using DomainService.Catalogue.Services;
using Microsoft.Extensions.Logging;

namespace DomainService.Billing.Services;

public interface IOrderInvoiceWriter
{
    /// <summary>
    /// Writes the invoice for an order that has just been paid. Safe to call twice: an order that
    /// already has its invoice is left alone.
    /// </summary>
    /// <remarks>
    /// Never throws. By the time this runs the money has moved, and a failure to write the record
    /// of it must not turn a successful payment into an error — it is logged for operations.
    /// </remarks>
    Task WriteAsync(SubscriptionOrder order, CancellationToken cancellationToken = default);
}

/// <summary>
/// The bill for a purchase, as opposed to a renewal.
/// </summary>
/// <remarks>
/// A free order is not billed: nothing was charged, and an invoice for zero would only be noise
/// in the list a customer reads for what they paid.
/// </remarks>
public sealed class OrderInvoiceWriter : IOrderInvoiceWriter
{
    private readonly IInvoiceStore _invoices;
    private readonly IPaymentMethodService _paymentMethods;
    private readonly ISubscriptionStore _subscriptions;
    private readonly ICatalogueProvider _catalogue;
    private readonly ILogger<OrderInvoiceWriter> _logger;
    private readonly TimeProvider _time;

    public OrderInvoiceWriter(
        IInvoiceStore invoices,
        IPaymentMethodService paymentMethods,
        ISubscriptionStore subscriptions,
        ICatalogueProvider catalogue,
        ILogger<OrderInvoiceWriter> logger,
        TimeProvider? timeProvider = null)
    {
        _invoices = invoices;
        _paymentMethods = paymentMethods;
        _subscriptions = subscriptions;
        _catalogue = catalogue;
        _logger = logger;
        _time = timeProvider ?? TimeProvider.System;
    }

    public async Task WriteAsync(SubscriptionOrder order, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(order);

        if (order.State != OrderStates.Paid || order.Total <= 0m)
        {
            return;
        }

        try
        {
            // The sync answer and the provider's webhook can both see the same order paid; one
            // invoice per order whichever arrives first.
            if (await _invoices.FindByOrderAsync(order.TenantGroupId, order.ItemId, cancellationToken).ConfigureAwait(false) is not null)
            {
                return;
            }

            var utcNow = _time.GetUtcNow().UtcDateTime;
            var paidAt = order.ChargedAtUtc ?? utcNow;

            var cards = await _paymentMethods.ListAsync(order.TenantGroupId, cancellationToken).ConfigureAwait(false) ?? [];
            var card = cards.FirstOrDefault(c => string.Equals(c.PaymentMethodId, order.PaymentMethodId, StringComparison.Ordinal))
                ?? cards.FirstOrDefault(c => c.IsDefault);

            // An order covers the rest of the current period: up to the subscription's next charge
            // when there is one, or a whole period when this purchase starts it.
            var subscription = await _subscriptions.GetAsync(order.TenantGroupId, cancellationToken).ConfigureAwait(false);
            var periodDays = _catalogue.Catalogue.UsagePeriod.Days > 0 ? _catalogue.Catalogue.UsagePeriod.Days : 30;
            var periodEnd = subscription is { State: not SubscriptionStates.Cancelled } && subscription.NextChargeAtUtc > paidAt
                ? subscription.NextChargeAtUtc
                : paidAt.AddDays(periodDays);

            var invoice = new Invoice
            {
                ItemId = Guid.NewGuid().ToString("N"),
                Number = await _invoices.NextNumberAsync(utcNow, cancellationToken).ConfigureAwait(false),
                TenantGroupId = order.TenantGroupId,
                OrderId = order.ItemId,
                Market = order.Market,
                Subtotal = order.Subtotal,
                Vat = order.Vat,
                Total = order.Total,
                Lines = [.. order.Lines.Select(l => new InvoiceLine
                {
                    Label = !string.IsNullOrWhiteSpace(l.Label) ? l.Label
                        : !string.IsNullOrWhiteSpace(l.Meter) ? l.Meter
                        : l.Environment,
                    Environment = l.Environment,
                    Units = l.Units,
                    Amount = l.Amount,
                    Billing = l.Billing,
                })],
                State = InvoiceStates.Paid,
                ProviderReference = order.ProviderReference,
                IssuedAtUtc = utcNow,
                PaidAtUtc = paidAt,
                PeriodStartUtc = paidAt,
                PeriodEndUtc = periodEnd,
                PaymentMethodBrand = card?.Brand ?? string.Empty,
                PaymentMethodLastFour = card?.LastFour ?? string.Empty,
            };

            await _invoices.InsertAsync(invoice, cancellationToken).ConfigureAwait(false);
        }
        catch (Exception exception) when (exception is not OperationCanceledException)
        {
            _logger.LogError(
                exception,
                "Order {OrderId} of {TenantGroupId} was paid but its invoice could not be written; write it by hand.",
                order.ItemId,
                order.TenantGroupId);
        }
    }
}
