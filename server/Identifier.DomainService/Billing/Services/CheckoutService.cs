using DomainService.Billing.Entities;
using DomainService.Billing.Models;
using DomainService.Catalogue.Models;
using DomainService.Catalogue.Services;
using Microsoft.Extensions.Logging;

namespace DomainService.Billing.Services;

public interface ICheckoutService
{
    /// <summary>
    /// Prices and validates a purchase, writes it as a pending order, and mints the key that makes
    /// paying for it safe to retry.
    /// </summary>
    /// <remarks>
    /// Everything knowable is checked here, before any money moves. That is what makes "never
    /// refund" safe: after the charge the only failures left are infrastructure ones, and those do
    /// resolve on retry. A permanent failure discovered after taking payment would leave money
    /// collected for something that can never be delivered.
    /// </remarks>
    Task<StartCheckoutResult> StartAsync(
        StartCheckoutRequest request,
        string userId,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Prices a selection without writing anything.
    /// </summary>
    /// <remarks>
    /// What the screen calls while someone is still choosing. Pricing through
    /// <see cref="StartAsync"/> on every change would leave an abandoned order — and a wasted
    /// idempotency key — behind every tick of a checkbox.
    /// </remarks>
    Task<StartCheckoutResult> QuoteAsync(
        StartCheckoutRequest request,
        CancellationToken cancellationToken = default);

    /// <summary>Everything about one order, shaped for the screen that watches it.</summary>
    Task<OrderView?> GetAsync(string tenantGroupId, string orderId, CancellationToken cancellationToken = default);

    /// <summary>The order still being worked on, if any. What the console rebuilds its bar from.</summary>
    Task<OrderView?> GetActiveAsync(string tenantGroupId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Orders that need a person: a charge with no outcome, or provisioning out of attempts.
    /// </summary>
    /// <remarks>
    /// Not scoped to a project — this is the platform's own queue, not a customer's view, and is
    /// reachable only from an operator endpoint.
    /// </remarks>
    Task<IReadOnlyList<OrderView>> GetNeedingAttentionAsync(CancellationToken cancellationToken = default);
}

public sealed class CheckoutService : ICheckoutService
{
    /// <summary>Attempts per environment and step before an order waits for a human.</summary>
    public const int MaxAttempts = 5;

    /// <summary>Swiss VAT. One rate because there is one seller, not one per market.</summary>
    public const decimal VatRate = 0.081m;

    /// <summary>How long a started-but-unpaid order stays payable.</summary>
    public static readonly TimeSpan CheckoutLifetime = TimeSpan.FromHours(24);

    private readonly ISubscriptionOrderStore _orders;
    private readonly ICatalogueProvider _catalogue;
    private readonly ILogger<CheckoutService> _logger;
    private readonly TimeProvider _time;

    public CheckoutService(
        ISubscriptionOrderStore orders,
        ICatalogueProvider catalogue,
        ILogger<CheckoutService> logger,
        TimeProvider? timeProvider = null)
    {
        _orders = orders;
        _catalogue = catalogue;
        _logger = logger;
        _time = timeProvider ?? TimeProvider.System;
    }

    public Task<StartCheckoutResult> QuoteAsync(
        StartCheckoutRequest request,
        CancellationToken cancellationToken = default) =>
        PriceAsync(request, userId: null, cancellationToken);

    public Task<StartCheckoutResult> StartAsync(
        StartCheckoutRequest request,
        string userId,
        CancellationToken cancellationToken = default) =>
        PriceAsync(request, userId ?? string.Empty, cancellationToken);

    /// <summary>
    /// Prices the selection, and writes it as an order when <paramref name="userId"/> is given.
    /// </summary>
    /// <remarks>
    /// A null user means "quote only": the same arithmetic and the same validation, with nothing
    /// persisted. One method so a quote can never disagree with the order it becomes.
    /// </remarks>
    private async Task<StartCheckoutResult> PriceAsync(
        StartCheckoutRequest request,
        string? userId,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(request);

        if (string.IsNullOrWhiteSpace(request.TenantGroupId))
        {
            return StartCheckoutResult.Failed(CheckoutFailures.NothingSelected);
        }

        if (request.Environments.Count == 0 && request.TopUps.Count == 0)
        {
            return StartCheckoutResult.Failed(CheckoutFailures.NothingSelected);
        }

        var catalogue = _catalogue.Catalogue;
        var prices = _catalogue.PriceBook;
        var market = string.IsNullOrWhiteSpace(request.Market) ? prices.DefaultMarket : request.Market;

        if (!prices.Markets.Contains(market, StringComparer.OrdinalIgnoreCase))
        {
            return StartCheckoutResult.Failed(CheckoutFailures.NoPrice);
        }

        var lines = new List<CheckoutLine>();
        var orderLines = new List<OrderLine>();

        foreach (var environmentKey in request.Environments.Distinct(StringComparer.Ordinal))
        {
            if (!catalogue.Environments.TryGetValue(environmentKey, out var definition))
            {
                return StartCheckoutResult.Failed(CheckoutFailures.UnknownEnvironment);
            }

            var price = prices.PriceFor(environmentKey, market);

            if (price is null)
            {
                return StartCheckoutResult.Failed(CheckoutFailures.NoPrice);
            }

            lines.Add(new CheckoutLine
            {
                Kind = "environment",
                Label = definition.Label,
                Environment = environmentKey,
                Amount = price.Value,
                // An environment is rent: it is on every invoice while it exists.
                Billing = "rent",
            });

            orderLines.Add(new OrderLine
            {
                Kind = "environment",
                Environment = environmentKey,
                Amount = price.Value,
                Billing = "rent",
            });
        }

        foreach (var topUp in request.TopUps)
        {
            var failure = PriceTopUp(topUp, catalogue, prices, market, lines, orderLines);

            if (failure is not null)
            {
                return StartCheckoutResult.Failed(failure);
            }
        }

        var subtotal = lines.Sum(l => l.Amount);
        var vat = Math.Round(subtotal * VatRate, 2, MidpointRounding.AwayFromZero);
        var utcNow = _time.GetUtcNow().UtcDateTime;

        if (userId is null)
        {
            return new StartCheckoutResult
            {
                Market = market,
                Subtotal = subtotal,
                Vat = vat,
                Total = subtotal + vat,
                RecurringMonthly = lines.Where(l => l.Billing == "rent").Sum(l => l.Amount),
                Lines = lines,
            };
        }

        // One order per checkout session, not per change of mind. Re-pricing an order that is
        // still pending keeps its id and its idempotency key, so the button always commits the
        // thing on screen and no abandoned rows pile up behind it.
        if (!string.IsNullOrWhiteSpace(request.OrderId))
        {
            var reuse = await _orders
                .GetAsync(request.TenantGroupId, request.OrderId, cancellationToken)
                .ConfigureAwait(false);

            if (reuse is { State: OrderStates.Pending })
            {
                reuse.Market = market;
                reuse.Subtotal = subtotal;
                reuse.Vat = vat;
                reuse.Total = subtotal + vat;
                reuse.Lines = orderLines;
                reuse.Progress = [.. request.Environments
                    .Distinct(StringComparer.Ordinal)
                    .Select(e => new OrderEnvironmentProgress { Environment = e })];
                reuse.UpdatedAtUtc = utcNow;

                await _orders.UpdateAsync(reuse, cancellationToken).ConfigureAwait(false);

                return new StartCheckoutResult
                {
                    OrderId = reuse.ItemId,
                    IdempotencyKey = reuse.IdempotencyKey,
                    Market = market,
                    Subtotal = subtotal,
                    Vat = vat,
                    Total = subtotal + vat,
                    RecurringMonthly = lines.Where(l => l.Billing == "rent").Sum(l => l.Amount),
                    Lines = lines,
                };
            }
        }

        var order = new SubscriptionOrder
        {
            ItemId = Guid.NewGuid().ToString("N"),
            TenantGroupId = request.TenantGroupId,
            // Minted here, on opening checkout — never on the button press, where a double-click
            // would produce two keys and two charges.
            IdempotencyKey = Guid.NewGuid().ToString("N"),
            CreatedByUserId = userId ?? string.Empty,
            State = OrderStates.Pending,
            Market = market,
            Subtotal = subtotal,
            Vat = vat,
            Total = subtotal + vat,
            Lines = orderLines,
            Progress = [.. request.Environments
                .Distinct(StringComparer.Ordinal)
                .Select(e => new OrderEnvironmentProgress { Environment = e })],
            CreatedAtUtc = utcNow,
            UpdatedAtUtc = utcNow,
            ExpiresAtUtc = utcNow.Add(CheckoutLifetime),
        };

        var claim = await _orders.ClaimAsync(order, cancellationToken).ConfigureAwait(false);

        return new StartCheckoutResult
        {
            OrderId = claim.Order.ItemId,
            IdempotencyKey = claim.Order.IdempotencyKey,
            Market = market,
            Subtotal = subtotal,
            Vat = vat,
            Total = subtotal + vat,
            RecurringMonthly = lines.Where(l => l.Billing == "rent").Sum(l => l.Amount),
            Lines = lines,
        };
    }

    /// <summary>Prices one top-up, or names why it cannot be bought. Null means it is fine.</summary>
    private static string? PriceTopUp(
        TopUpSelection topUp,
        PlanCatalogue catalogue,
        PriceBook prices,
        string market,
        List<CheckoutLine> lines,
        List<OrderLine> orderLines)
    {
        if (topUp.Steps <= 0)
        {
            return CheckoutFailures.NothingSelected;
        }

        if (!catalogue.Environments.TryGetValue(topUp.Environment, out var environment))
        {
            return CheckoutFailures.UnknownEnvironment;
        }

        var meter = catalogue.FindMeter(topUp.Meter);

        if (meter is null)
        {
            return CheckoutFailures.UnknownMeter;
        }

        if (!meter.Purchasable)
        {
            return CheckoutFailures.NotPurchasable;
        }

        var stepPrice = prices.StepPriceFor(topUp.Meter);

        if (stepPrice is null || !stepPrice.Price.TryGetValue(market, out var unitPrice))
        {
            return CheckoutFailures.NoPrice;
        }

        var step = catalogue.StepFor(topUp.Meter) ?? stepPrice.Step;

        if (step <= 0)
        {
            return CheckoutFailures.NotPurchasable;
        }

        // The cap is on the ceiling, not the purchase: included plus bought may not exceed the
        // multiple. prod is deliberately uncapped — there is nothing above it to move up to.
        if (!environment.TopUpUncapped)
        {
            var limits = catalogue.LimitsFor(topUp.Environment);
            var included = limits.TryGetValue(topUp.Meter, out var value) ? value : 0;
            var cap = included * catalogue.Defaults.TopUp.MaxMultipleOfIncluded;

            if (included > 0 && included + (step * topUp.Steps) > cap)
            {
                return CheckoutFailures.CapExceeded;
            }
        }

        var units = step * topUp.Steps;
        var amount = unitPrice * topUp.Steps;

        // A counter's units are bought once and carry; a resource ceiling is rent, charged again
        // every period it is held. The word decides how the line behaves on later invoices.
        var billing = string.Equals(stepPrice.Billing, "recurringWhileHeld", StringComparison.Ordinal)
            ? "rent"
            : "once";

        lines.Add(new CheckoutLine
        {
            Kind = "topup",
            Label = meter.Label,
            Environment = topUp.Environment,
            Meter = topUp.Meter,
            Units = units,
            Amount = amount,
            Billing = billing,
        });

        orderLines.Add(new OrderLine
        {
            Kind = "topup",
            Environment = topUp.Environment,
            Meter = topUp.Meter,
            Steps = topUp.Steps,
            Units = units,
            Amount = amount,
            Billing = billing,
        });

        return null;
    }

    public async Task<OrderView?> GetAsync(string tenantGroupId, string orderId, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(tenantGroupId) || string.IsNullOrWhiteSpace(orderId))
        {
            return null;
        }

        var order = await _orders.GetAsync(tenantGroupId, orderId, cancellationToken).ConfigureAwait(false);

        return order is null ? null : ToView(order);
    }

    public async Task<OrderView?> GetActiveAsync(string tenantGroupId, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(tenantGroupId))
        {
            return null;
        }

        var orders = await _orders.ListAsync(tenantGroupId, cancellationToken).ConfigureAwait(false);
        var active = orders.FirstOrDefault(o => !OrderStates.IsTerminal(o.State) && o.State != OrderStates.Pending);

        return active is null ? null : ToView(active);
    }

    public async Task<IReadOnlyList<OrderView>> GetNeedingAttentionAsync(CancellationToken cancellationToken = default)
    {
        var utcNow = _time.GetUtcNow().UtcDateTime;

        var unresolved = await _orders
            .FindUnresolvedChargesAsync(utcNow - OrderSweeper.UnresolvedAfter, 100, cancellationToken)
            .ConfigureAwait(false);

        var stuck = await _orders
            .FindUnfinishedAsync(utcNow, 100, cancellationToken)
            .ConfigureAwait(false);

        return
        [
            .. unresolved.Select(ToView),
            .. stuck.Where(o => o.NeedsAttention).Select(ToView),
        ];
    }

    /// <summary>
    /// Shapes an order for the screen. Everything internal stays behind: the customer is never
    /// shown <c>NeedsAttention</c>, only that a step is taking another go.
    /// </summary>
    public static OrderView ToView(SubscriptionOrder order)
    {
        var running = order.Progress.FirstOrDefault(p => !p.IsComplete);

        return new OrderView
        {
            OrderId = order.ItemId,
            State = order.State,
            Total = order.Total,
            Market = order.Market,
            StepsDone = order.StepsDone,
            StepsTotal = order.StepsTotal,
            CurrentEnvironment = running?.Environment ?? string.Empty,
            CurrentStep = running is null ? string.Empty : ProvisioningSteps.FriendlyAt(running.StepsDone),
            // Only worth showing once a step has actually been retried; the first attempt is just
            // "in progress" and saying "attempt 1 of 5" would invent a problem.
            Attempt = running is { Attempt: > 1 } ? running.Attempt : 0,
            MaxAttempts = MaxAttempts,
            DeclineReason = order.DeclineReason,
            ChargedAtUtc = order.ChargedAtUtc,
            CompletedAtUtc = order.CompletedAtUtc,
            Environments = [.. order.Progress.Select(p => new EnvironmentProgressView
            {
                TenantId = p.TenantId,
                Environment = p.Environment,
                StepsDone = p.StepsDone,
                StepsTotal = ProvisioningSteps.All.Count,
                Step = p.IsComplete ? string.Empty : ProvisioningSteps.FriendlyAt(p.StepsDone),
                Status = p.IsComplete ? "ready"
                    : p.Attempt > 1 ? "retrying"
                    : p.StartedAtUtc is null ? "queued" : "building",
                Attempt = p.Attempt > 1 ? p.Attempt : 0,
            })],
        };
    }
}
