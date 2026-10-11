using DomainService.Billing.Entities;
using DomainService.Billing.Models;
using DomainService.Catalogue.Services;
using Microsoft.Extensions.Logging;

namespace DomainService.Billing.Services;

public interface IRenewalService
{
    /// <summary>
    /// Charges one subscription for the period that has come due.
    /// </summary>
    /// <returns>True when the money was collected.</returns>
    Task<bool> RenewAsync(ProjectSubscription subscription, CancellationToken cancellationToken = default);

    /// <summary>
    /// Adds what an order bought to the standing arrangement, so it is billed again next period.
    /// </summary>
    /// <remarks>
    /// Only the recurring half: environments, and resource ceilings that are rent while held.
    /// Counter units are bought once and carry until spent, so they never join this.
    /// </remarks>
    Task ApplyOrderAsync(SubscriptionOrder order, CancellationToken cancellationToken = default);

    /// <summary>
    /// Stops the monthly charge for a project.
    /// </summary>
    /// <remarks>
    /// Ends the billing relationship and nothing else. Environments are left running and their
    /// data untouched: tearing them down is a separate, destructive decision that nobody should
    /// make by pressing a button labelled "unsubscribe".
    /// <para>
    /// Money already owed stays owed — a carried balance is not forgiven by cancelling, and the
    /// final invoice still shows it.
    /// </para>
    /// </remarks>
    Task<UnsubscribeResult> UnsubscribeAsync(string tenantGroupId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Charges what a past-due project owes now, on its default card, instead of waiting for the
    /// next renewal to carry it.
    /// </summary>
    Task<RetryPaymentResult> RetryPaymentAsync(string tenantGroupId, CancellationToken cancellationToken = default);
}

/// <param name="State">The subscription's state afterwards.</param>
/// <param name="CarriedBalance">Still owed afterwards, before tax. Zero once collected.</param>
public readonly record struct RetryPaymentResult(bool IsSuccess, string Reason, string State, decimal CarriedBalance);

/// <param name="OutstandingBalance">What was owed at the moment of cancelling. Still owed.</param>
public readonly record struct UnsubscribeResult(
    bool IsSuccess,
    string Reason,
    decimal OutstandingBalance,
    DateTime? EffectiveUtc)
{
    public static UnsubscribeResult Failed(string reason) => new(false, reason, 0m, null);
}

/// <summary>
/// The monthly charge.
/// </summary>
/// <remarks>
/// A decline never cuts anyone off. The amount joins <see cref="ProjectSubscription.CarriedBalance"/>
/// and appears on the next invoice, the subscription is marked past due, and every environment
/// keeps running. Suspending a customer over a card that expired is a worse failure than waiting a
/// month for the money.
/// <para>
/// The period always advances, even on a failure. Leaving it in the past would have the sweeper
/// find the same subscription every few minutes and retry a card that is not going to work yet.
/// </para>
/// </remarks>
public sealed class RenewalService : IRenewalService
{
    /// <summary>Failed periods before the flag is worth a human's attention.</summary>
    public const int AttentionAfterFailures = 3;

    private static readonly TimeSpan Period = TimeSpan.FromDays(30);

    private readonly ISubscriptionStore _subscriptions;
    private readonly IInvoiceStore _invoices;
    private readonly IPaymentMethodService _paymentMethods;
    private readonly IPaymentGateway _gateway;
    private readonly IInvoiceMailer _mailer;
    private readonly ISubscriptionLifecycleService _lifecycle;
    private readonly ILogger<RenewalService> _logger;
    private readonly TimeProvider _time;
    private readonly IEnvironmentDisabler? _disabler;

    public RenewalService(
        ISubscriptionStore subscriptions,
        IInvoiceStore invoices,
        IPaymentMethodService paymentMethods,
        IPaymentGateway gateway,
        IInvoiceMailer mailer,
        ISubscriptionLifecycleService lifecycle,
        ILogger<RenewalService> logger,
        TimeProvider? timeProvider = null,
        IEnvironmentDisabler? disabler = null)
    {
        _disabler = disabler;
        _subscriptions = subscriptions;
        _invoices = invoices;
        _paymentMethods = paymentMethods;
        _gateway = gateway;
        _mailer = mailer;
        _lifecycle = lifecycle;
        _logger = logger;
        _time = timeProvider ?? TimeProvider.System;
    }

    public async Task<bool> RenewAsync(ProjectSubscription subscription, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(subscription);

        var utcNow = _time.GetUtcNow().UtcDateTime;

        // Removed lines go first, before anything is priced: a removal takes effect at this
        // boundary, so the period starting now must not charge for it.
        await DropEndedLinesAsync(subscription, utcNow, cancellationToken).ConfigureAwait(false);

        var subtotal = subscription.MonthlyBeforeTax + subscription.CarriedBalance;

        // Nothing recurring and nothing owed: no charge, but the boundary still happened. This is
        // a project that only ever bought counter top-ups, and its allowances must still reset.
        if (subtotal <= 0m)
        {
            await RollEnvironmentsAsync(subscription, utcNow, cancellationToken).ConfigureAwait(false);

            subscription.NextChargeAtUtc = utcNow.Add(Period);
            subscription.UpdatedAtUtc = utcNow;
            await _subscriptions.UpsertAsync(subscription, cancellationToken).ConfigureAwait(false);
            return true;
        }

        var vat = Math.Round(subtotal * CheckoutService.VatRate, 2, MidpointRounding.AwayFromZero);
        var total = subtotal + vat;

        var secret = await _paymentMethods
            .GetDefaultChargeSecretAsync(subscription.TenantGroupId, cancellationToken)
            .ConfigureAwait(false);

        var charge = secret is null || string.IsNullOrWhiteSpace(secret.ProviderToken)
            ? ChargeResult.Refused("no_card_on_file")
            : await _gateway
                .ChargeStoredCardAsync(
                    new ChargeRequest
                    {
                        TenantGroupId = subscription.TenantGroupId,
                        // The period is part of the key, so a sweep that runs twice in one period
                        // cannot charge twice — and next period's charge is a different key.
                        OrderId = $"renewal-{subscription.TenantGroupId}-{utcNow:yyyyMMdd}",
                        IdempotencyKey = $"renewal-{subscription.TenantGroupId}-{utcNow:yyyyMMdd}",
                        Amount = total,
                        Market = subscription.Market,
                        StoredPaymentMethodId = secret.ProviderToken,
                        ShopperReference = subscription.TenantGroupId,
                    },
                    cancellationToken)
                .ConfigureAwait(false);

        var collected = charge.Outcome == ChargeOutcome.Authorised;
        var card = await DefaultCardAsync(subscription.TenantGroupId, cancellationToken).ConfigureAwait(false);

        var invoice = new Invoice
        {
            ItemId = Guid.NewGuid().ToString("N"),
            Number = await _invoices.NextNumberAsync(utcNow, cancellationToken).ConfigureAwait(false),
            TenantGroupId = subscription.TenantGroupId,
            Market = subscription.Market,
            Subtotal = subtotal,
            Vat = vat,
            Total = total,
            CarriedIn = subscription.CarriedBalance,
            Lines = [.. subscription.Lines.Select(l => new InvoiceLine
            {
                Label = string.IsNullOrWhiteSpace(l.Label) ? l.Environment : l.Label,
                Environment = l.Environment,
                Units = l.Units,
                Amount = l.Amount,
                Billing = "rent",
            })],
            State = collected ? InvoiceStates.Paid : InvoiceStates.Unpaid,
            ProviderReference = charge.ProviderReference,
            IssuedAtUtc = utcNow,
            PaidAtUtc = collected ? utcNow : null,
            PeriodStartUtc = utcNow,
            PeriodEndUtc = utcNow.Add(Period),
            PaymentMethodBrand = card?.Brand ?? string.Empty,
            PaymentMethodLastFour = card?.LastFour ?? string.Empty,
            // An uncollected amount is tried again by the next renewal, which carries it; the
            // owner can retry sooner from the billing screen.
            DeclinedAtUtc = collected ? null : utcNow,
            NextRetryUtc = collected ? null : utcNow.Add(Period),
        };

        await _invoices.InsertAsync(invoice, cancellationToken).ConfigureAwait(false);

        if (collected)
        {
            subscription.CarriedBalance = 0m;
            subscription.FailedAttempts = 0;
            subscription.LastFailureReason = string.Empty;
            subscription.State = SubscriptionStates.Active;
            subscription.LastChargedAtUtc = utcNow;
        }
        else
        {
            // Carries, does not cut off. An unknown outcome is treated the same as a refusal here:
            // the invoice is unpaid either way, and if the money does arrive the next period's
            // reconciliation clears it rather than this method guessing.
            subscription.CarriedBalance = subtotal;
            subscription.FailedAttempts++;
            subscription.LastFailureReason = charge.Reason;
            subscription.State = SubscriptionStates.PastDue;

            _logger.LogWarning(
                "Renewal for {TenantGroupId} was not collected ({Reason}); {Amount} carries to the next invoice.",
                subscription.TenantGroupId,
                charge.Reason,
                subtotal);

            if (subscription.FailedAttempts >= AttentionAfterFailures)
            {
                _logger.LogError(
                    "{TenantGroupId} has failed {Count} renewals. Everything still runs; someone should look.",
                    subscription.TenantGroupId,
                    subscription.FailedAttempts);
            }
        }

        // The period turns whether or not the money arrived.
        //
        // Withholding the reset from someone whose card failed would mean a counter meter stays at
        // its ceiling for a second month — the customer is billed and still blocked, and the
        // blockage compounds every period until the card is fixed. A decline is a debt to collect,
        // not a punishment to apply, and the amount is already carried to the next invoice.
        await RollEnvironmentsAsync(subscription, utcNow, cancellationToken).ConfigureAwait(false);

        // Always forward, even after a failure: leaving it in the past would make the sweeper
        // retry the same card every few minutes.
        subscription.NextChargeAtUtc = utcNow.Add(Period);
        subscription.UpdatedAtUtc = utcNow;

        await _subscriptions.UpsertAsync(subscription, cancellationToken).ConfigureAwait(false);
        await _mailer.SendAsync(invoice, cancellationToken).ConfigureAwait(false);

        return collected;
    }

    /// <summary>
    /// Resets each environment's allowances for the new period, carrying purchased units.
    /// </summary>
    /// <remarks>
    /// One environment failing must not stop the others: a project whose staging rollover throws
    /// would otherwise have production stuck at its ceiling too.
    /// </remarks>
    private async Task RollEnvironmentsAsync(
        ProjectSubscription subscription,
        DateTime utcNow,
        CancellationToken cancellationToken)
    {
        var periodKey = utcNow.ToString("yyyy-MM-dd");

        foreach (var line in subscription.Lines.Where(l => l.Kind == "environment"))
        {
            if (string.IsNullOrWhiteSpace(line.TenantId))
            {
                continue;
            }

            try
            {
                var result = await _lifecycle
                    .RolloverAsync(line.TenantId, line.Environment, periodKey, line.Amount == 0m, cancellationToken)
                    .ConfigureAwait(false);

                _logger.LogInformation(
                    "Rolled {Environment} of {TenantGroupId}: {Count} meter(s) reset, {Carried} unit(s) carried.",
                    line.Environment,
                    subscription.TenantGroupId,
                    result.MetersReset,
                    result.PurchasedCarried);
            }
            catch (Exception exception) when (exception is not OperationCanceledException)
            {
                _logger.LogError(
                    exception,
                    "Rolling {Environment} of {TenantGroupId} failed; its allowances stay where they were.",
                    line.Environment,
                    subscription.TenantGroupId);
            }
        }
    }

    public async Task<UnsubscribeResult> UnsubscribeAsync(string tenantGroupId, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(tenantGroupId))
        {
            return UnsubscribeResult.Failed("unsubscribe_no_project");
        }

        var subscription = await _subscriptions.GetAsync(tenantGroupId, cancellationToken).ConfigureAwait(false);

        if (subscription is null)
        {
            return UnsubscribeResult.Failed("unsubscribe_nothing_to_cancel");
        }

        // Cancelling twice is not an error; the second one simply has nothing to do.
        if (subscription.State == SubscriptionStates.Cancelled)
        {
            return new UnsubscribeResult(true, string.Empty, subscription.CarriedBalance, subscription.UpdatedAtUtc);
        }

        var utcNow = _time.GetUtcNow().UtcDateTime;

        subscription.State = SubscriptionStates.Cancelled;
        // Emptied so a renewal that somehow reaches it charges nothing. FindDueAsync already
        // excludes cancelled subscriptions; this is the belt behind that brace.
        subscription.Lines = [];
        subscription.UpdatedAtUtc = utcNow;

        await _subscriptions.UpsertAsync(subscription, cancellationToken).ConfigureAwait(false);

        _logger.LogInformation(
            "{TenantGroupId} unsubscribed with {Balance} outstanding.",
            tenantGroupId,
            subscription.CarriedBalance);

        return new UnsubscribeResult(true, string.Empty, subscription.CarriedBalance, utcNow);
    }

    public async Task<RetryPaymentResult> RetryPaymentAsync(string tenantGroupId, CancellationToken cancellationToken = default)
    {
        var subscription = string.IsNullOrWhiteSpace(tenantGroupId)
            ? null
            : await _subscriptions.GetAsync(tenantGroupId, cancellationToken).ConfigureAwait(false);

        if (subscription is null
            || subscription.State != SubscriptionStates.PastDue
            || subscription.CarriedBalance <= 0m)
        {
            return new RetryPaymentResult(
                false,
                BillingFailures.NothingOwed,
                subscription?.State ?? string.Empty,
                subscription?.CarriedBalance ?? 0m);
        }

        var utcNow = _time.GetUtcNow().UtcDateTime;
        var owed = subscription.CarriedBalance;
        var vat = Math.Round(owed * CheckoutService.VatRate, 2, MidpointRounding.AwayFromZero);

        var secret = await _paymentMethods
            .GetDefaultChargeSecretAsync(subscription.TenantGroupId, cancellationToken)
            .ConfigureAwait(false);

        if (secret is null || string.IsNullOrWhiteSpace(secret.ProviderToken))
        {
            return new RetryPaymentResult(false, BillingFailures.NoCard, subscription.State, owed);
        }

        // Keyed to the debt and the minute. A double-click inside the minute replays the same
        // request, which the provider answers with its first result instead of charging twice;
        // a deliberate retry after a decline is a new key, so it is not handed the old refusal.
        var key = $"retry-{subscription.TenantGroupId}-{subscription.FailedAttempts}-{utcNow:yyyyMMddHHmm}";

        var charge = await _gateway
            .ChargeStoredCardAsync(
                new ChargeRequest
                {
                    TenantGroupId = subscription.TenantGroupId,
                    OrderId = key,
                    IdempotencyKey = key,
                    Amount = owed + vat,
                    Market = subscription.Market,
                    StoredPaymentMethodId = secret.ProviderToken,
                    ShopperReference = subscription.TenantGroupId,
                },
                cancellationToken)
            .ConfigureAwait(false);

        switch (charge.Outcome)
        {
            case ChargeOutcome.Authorised:
                subscription.CarriedBalance = 0m;
                subscription.FailedAttempts = 0;
                subscription.LastFailureReason = string.Empty;
                subscription.State = SubscriptionStates.Active;
                subscription.LastChargedAtUtc = utcNow;
                subscription.UpdatedAtUtc = utcNow;
                await _subscriptions.UpsertAsync(subscription, cancellationToken).ConfigureAwait(false);

                // The newest unpaid invoice is the one that carried the whole balance; older
                // unpaid ones were already rolled into it, exactly as a successful renewal leaves
                // them.
                var unpaid = await _invoices
                    .FindLatestUnpaidAsync(subscription.TenantGroupId, cancellationToken)
                    .ConfigureAwait(false);

                if (unpaid is not null)
                {
                    await _invoices
                        .MarkPaidAsync(subscription.TenantGroupId, unpaid.ItemId, charge.ProviderReference, utcNow, cancellationToken)
                        .ConfigureAwait(false);
                }

                return new RetryPaymentResult(true, string.Empty, subscription.State, 0m);

            case ChargeOutcome.Refused:
                subscription.LastFailureReason = charge.Reason;
                subscription.UpdatedAtUtc = utcNow;
                await _subscriptions.UpsertAsync(subscription, cancellationToken).ConfigureAwait(false);
                return new RetryPaymentResult(false, BillingFailures.PaymentDeclined, subscription.State, owed);

            default:
                // No answer is not a decline. Nothing is changed: if the money arrived, marking it
                // owed would charge it twice; if it did not, it is still owed. A person resolves
                // it against the provider.
                _logger.LogError(
                    "Retry for {TenantGroupId} has no outcome ({Reason}); key {Key}. Resolve it against the provider.",
                    subscription.TenantGroupId,
                    charge.Reason,
                    key);
                return new RetryPaymentResult(false, BillingFailures.PaymentPending, subscription.State, owed);
        }
    }

    /// <summary>
    /// Takes lines whose removal has come due off the subscription, and switches off the
    /// environments they belonged to.
    /// </summary>
    /// <remarks>
    /// Billing stops whether or not the switch-off works: the customer asked to stop paying, and
    /// a tenant that would not disable is the platform's problem, not theirs. It is recorded on
    /// <see cref="ProjectSubscription.RemovedEnvironments"/> and logged for a person.
    /// </remarks>
    private async Task DropEndedLinesAsync(ProjectSubscription subscription, DateTime utcNow, CancellationToken cancellationToken)
    {
        var ended = subscription.Lines.Where(l => l.EndsAtUtc is not null && l.EndsAtUtc <= utcNow).ToList();

        if (ended.Count == 0)
        {
            return;
        }

        subscription.Lines.RemoveAll(l => ended.Contains(l));
        subscription.RemovedEnvironments ??= [];

        foreach (var line in ended.Where(l => l.Kind == "environment"))
        {
            var disabled = false;

            try
            {
                disabled = _disabler is not null
                    && await _disabler
                        .DisableAsync(subscription.TenantGroupId, line.Environment, line.TenantId, cancellationToken)
                        .ConfigureAwait(false);
            }
            catch (Exception exception) when (exception is not OperationCanceledException)
            {
                _logger.LogError(
                    exception,
                    "Disabling {Environment} of {TenantGroupId} threw.",
                    line.Environment,
                    subscription.TenantGroupId);
            }

            if (!disabled)
            {
                _logger.LogError(
                    "{Environment} of {TenantGroupId} is no longer billed but is still running; disable it by hand.",
                    line.Environment,
                    subscription.TenantGroupId);
            }

            subscription.RemovedEnvironments.Add(new RemovedEnvironment
            {
                Environment = line.Environment,
                TenantId = line.TenantId,
                RemovedAtUtc = utcNow,
                Disabled = disabled,
            });
        }
    }

    /// <summary>The card a renewal charges, for printing on the invoice. Null when none is known.</summary>
    private async Task<DomainService.Billing.Models.PaymentMethodView?> DefaultCardAsync(string tenantGroupId, CancellationToken cancellationToken)
    {
        try
        {
            var cards = await _paymentMethods.ListAsync(tenantGroupId, cancellationToken).ConfigureAwait(false);
            return cards?.FirstOrDefault(c => c.IsDefault);
        }
        catch (Exception exception) when (exception is not OperationCanceledException)
        {
            // Display only. An invoice without "Visa ending 4242" is still a correct invoice.
            _logger.LogWarning(exception, "Could not read the default card of {TenantGroupId} for its invoice.", tenantGroupId);
            return null;
        }
    }

    public async Task ApplyOrderAsync(SubscriptionOrder order, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(order);

        var utcNow = _time.GetUtcNow().UtcDateTime;

        var subscription = await _subscriptions
            .GetAsync(order.TenantGroupId, cancellationToken)
            .ConfigureAwait(false)
            ?? new ProjectSubscription
            {
                TenantGroupId = order.TenantGroupId,
                Market = order.Market,
                CreatedAtUtc = utcNow,
                // The first purchase sets the anchor; every later one joins that date rather than
                // starting a clock of its own.
                NextChargeAtUtc = utcNow.Add(Period),
            };

        foreach (var line in order.Lines.Where(l => l.Kind == "upgrade"))
        {
            // The free environment's line now carries the paid price. The anchor is untouched:
            // the upgrade joins the period the project is already in.
            var price = line.RecurringAmount ?? line.Amount;
            var held = subscription.Lines.FirstOrDefault(l =>
                l.Kind == "environment" && string.Equals(l.Environment, line.Environment, StringComparison.Ordinal));

            if (held is null)
            {
                // A free environment made by Create never had a line; it gets one now.
                subscription.Lines.Add(new RecurringLine
                {
                    Kind = "environment",
                    Environment = line.Environment,
                    TenantId = line.TenantId,
                    Label = line.Environment,
                    Amount = price,
                });
            }
            else
            {
                held.Amount = price;

                if (string.IsNullOrWhiteSpace(held.TenantId))
                {
                    held.TenantId = line.TenantId;
                }
            }
        }

        foreach (var line in order.Lines.Where(l => l.Billing == "rent" && l.Kind != "upgrade"))
        {
            // The full monthly price, never what was due today: a line added mid-period was
            // charged only for the days left, and is charged in full from the next period on.
            var recurring = line.RecurringAmount ?? line.Amount;

            // A top-up bought for an environment already on its way out ends with it, rather
            // than outliving the environment it raises.
            var endsAtUtc = subscription.Lines
                .FirstOrDefault(l => l.Kind == "environment"
                    && string.Equals(l.Environment, line.Environment, StringComparison.Ordinal))
                ?.EndsAtUtc;

            var existing = subscription.Lines.FirstOrDefault(l =>
                l.Kind == line.Kind
                && string.Equals(l.Environment, line.Environment, StringComparison.Ordinal)
                && string.Equals(l.Meter, line.Meter, StringComparison.Ordinal));

            if (existing is null)
            {
                subscription.Lines.Add(new RecurringLine
                {
                    Kind = line.Kind,
                    Environment = line.Environment,
                    // Carried so the period boundary knows which rows to reset without going back
                    // to the project repository for every renewal.
                    TenantId = order.Progress
                        .FirstOrDefault(p => string.Equals(p.Environment, line.Environment, StringComparison.Ordinal))
                        ?.TenantId ?? string.Empty,
                    Meter = line.Meter,
                    Label = string.IsNullOrWhiteSpace(line.Meter) ? line.Environment : line.Meter,
                    Units = line.Units,
                    Amount = recurring,
                    EndsAtUtc = line.Kind == "environment" ? null : endsAtUtc,
                });
            }
            else
            {
                // Buying more of a ceiling already held raises the rent rather than adding a
                // second line for the same thing.
                existing.Units += line.Units;
                existing.Amount += recurring;
            }
        }

        subscription.UpdatedAtUtc = utcNow;
        await _subscriptions.UpsertAsync(subscription, cancellationToken).ConfigureAwait(false);
    }
}
