using Blocks.Genesis;
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

    /// <summary>The catalogue's <c>billing.onAdd</c> value that turns proration on.</summary>
    public const string ProrateOnAdd = "prorateAndChargeNow";

    private readonly ISubscriptionOrderStore _orders;
    private readonly ICatalogueProvider _catalogue;
    private readonly ILogger<CheckoutService> _logger;
    private readonly TimeProvider _time;
    private readonly IProjectInventory? _inventory;

    public CheckoutService(
        ISubscriptionOrderStore orders,
        ICatalogueProvider catalogue,
        ILogger<CheckoutService> logger,
        TimeProvider? timeProvider = null,
        IProjectInventory? inventory = null)
    {
        _orders = orders;
        _catalogue = catalogue;
        _logger = logger;
        _time = timeProvider ?? TimeProvider.System;
        _inventory = inventory;
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

        // A blank project is a brand-new one, and only a quote may price that: there is nothing
        // to write an order against until the project exists.
        var isNewProject = string.IsNullOrWhiteSpace(request.TenantGroupId);

        if (isNewProject && userId is not null)
        {
            return StartCheckoutResult.Failed(CheckoutFailures.NothingSelected);
        }

        request.Environments ??= [];
        request.TopUps ??= [];

        if (request.Environments.Count == 0 && request.TopUps.Count == 0 && !request.UpgradeFreeTier)
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

        var utcNow = _time.GetUtcNow().UtcDateTime;

        // A new project holds nothing, so there is nothing to read. An existing one is read once,
        // and every rule below — already held, free tier taken, proration — answers from it.
        var inventory = isNewProject || _inventory is null
            ? new ProjectInventorySnapshot()
            : await _inventory.GetAsync(request.TenantGroupId, request.OrderId, cancellationToken).ConfigureAwait(false);

        var proration = Proration.For(inventory.Subscription, catalogue, utcNow);

        var lines = new List<CheckoutLine>();
        var orderLines = new List<OrderLine>();
        var selected = request.Environments
            .Where(e => !string.IsNullOrWhiteSpace(e))
            .Distinct(StringComparer.Ordinal)
            .ToList();

        // Which environments in this selection are taken free. Only one that offers a free tier
        // can be; asking for it with none in the selection is a mistake worth saying out loud
        // rather than silently charging full price.
        var freeSelected = new HashSet<string>(StringComparer.Ordinal);

        if (request.FreeTier)
        {
            foreach (var environmentKey in selected)
            {
                if (catalogue.Environments.TryGetValue(environmentKey, out var candidate) && candidate.FreeTierAvailable)
                {
                    freeSelected.Add(environmentKey);
                }
            }

            if (freeSelected.Count == 0)
            {
                return StartCheckoutResult.Failed(CheckoutFailures.FreeTierUnavailable);
            }
        }

        foreach (var environmentKey in selected)
        {
            if (!catalogue.Environments.TryGetValue(environmentKey, out var definition))
            {
                return StartCheckoutResult.Failed(CheckoutFailures.UnknownEnvironment);
            }

            var free = freeSelected.Contains(environmentKey);

            if (free && inventory.FreeHeld(environmentKey) + 1 > Math.Max(0, definition.MaxFreePerProject))
            {
                return StartCheckoutResult.Failed(CheckoutFailures.FreeTierTaken);
            }

            // One tenant per environment per project: the tenant id is the environment letter
            // plus the group, so a second one cannot exist — and must not be charged for.
            if (inventory.HasOrIsCreating(environmentKey))
            {
                return StartCheckoutResult.Failed(CheckoutFailures.EnvironmentExists);
            }

            var price = prices.PriceFor(environmentKey, market, free);

            if (price is null)
            {
                return StartCheckoutResult.Failed(CheckoutFailures.NoPrice);
            }

            // An environment is rent: it is on every invoice while it exists. Added mid-period it
            // is charged today only for the days left, and in full from the next period on.
            var (dueToday, label) = free
                ? (0m, $"{definition.Label} (free)")
                : proration.Apply(price.Value, definition.Label);

            lines.Add(new CheckoutLine
            {
                Kind = "environment",
                Label = label,
                Environment = environmentKey,
                Amount = dueToday,
                Billing = "rent",
            });

            orderLines.Add(new OrderLine
            {
                Kind = "environment",
                Environment = environmentKey,
                Label = label,
                Amount = dueToday,
                RecurringAmount = free ? 0m : price.Value,
                FreeTier = free,
                Billing = "rent",
            });
        }

        // Free environments moving to the paid tier in this order. Priced like adding them —
        // prorated the same way, recurring in full — but nothing is created: the tenant exists.
        var upgrading = new HashSet<string>(StringComparer.Ordinal);

        if (request.UpgradeFreeTier)
        {
            var targets = inventory.FreeEnvironments
                .Where(e => catalogue.Environments.TryGetValue(e, out var d) && d.FreeTierAvailable)
                .OrderBy(e => catalogue.Environments[e].Rank)
                .ToList();

            if (targets.Count == 0)
            {
                return StartCheckoutResult.Failed(CheckoutFailures.NothingToUpgrade);
            }

            foreach (var environmentKey in targets)
            {
                // One upgrade at a time: a second would charge again for limits already rising.
                if (inventory.UpgradesInFlight.Contains(environmentKey))
                {
                    return StartCheckoutResult.Failed(CheckoutFailures.EnvironmentExists);
                }

                var definition = catalogue.Environments[environmentKey];
                var price = prices.PriceFor(environmentKey, market);

                if (price is null)
                {
                    return StartCheckoutResult.Failed(CheckoutFailures.NoPrice);
                }

                var (dueToday, label) = proration.Apply(price.Value, $"{definition.Label} (paid tier)");

                lines.Add(new CheckoutLine
                {
                    Kind = "upgrade",
                    Label = label,
                    Environment = environmentKey,
                    Amount = dueToday,
                    Billing = "rent",
                });

                orderLines.Add(new OrderLine
                {
                    Kind = "upgrade",
                    Environment = environmentKey,
                    Label = label,
                    Amount = dueToday,
                    RecurringAmount = price.Value,
                    TenantId = inventory.TenantIds.GetValueOrDefault(environmentKey) ?? string.Empty,
                    Billing = "rent",
                });

                upgrading.Add(environmentKey);
            }
        }

        foreach (var topUp in request.TopUps)
        {
            if (topUp is null)
            {
                return StartCheckoutResult.Failed(CheckoutFailures.NothingSelected);
            }

            // A top-up raises a ceiling the project holds. One for an environment it neither has
            // nor is buying here would be charged and land on nothing.
            var heldOrBuying = inventory.HasOrIsCreating(topUp.Environment)
                || selected.Contains(topUp.Environment, StringComparer.Ordinal);

            if (catalogue.Environments.ContainsKey(topUp.Environment ?? string.Empty) && !heldOrBuying)
            {
                return StartCheckoutResult.Failed(CheckoutFailures.EnvironmentNotHeld);
            }

            // An environment being upgraded in this same order is paid by the time the top-up
            // lands, so it may be topped up.
            var onFreeTier = freeSelected.Contains(topUp.Environment ?? string.Empty)
                || (inventory.FreeEnvironments.Contains(topUp.Environment ?? string.Empty)
                    && !upgrading.Contains(topUp.Environment ?? string.Empty));

            if (onFreeTier && catalogue.Defaults.TopUp.RequiresPaidEnvironment)
            {
                return StartCheckoutResult.Failed(CheckoutFailures.FreeTierCannotTopUp);
            }

            var failure = PriceTopUp(topUp, catalogue, prices, market, proration, lines, orderLines);

            if (failure is not null)
            {
                return StartCheckoutResult.Failed(failure);
            }
        }

        var subtotal = lines.Sum(l => l.Amount);
        var vat = Math.Round(subtotal * VatRate, 2, MidpointRounding.AwayFromZero);

        // What the subscription will charge each period from now on: the full price of every
        // rent line, however little of it is due today.
        var recurringMonthly = orderLines
            .Where(l => l.Billing == "rent")
            .Sum(l => l.RecurringAmount ?? l.Amount);

        if (userId is null)
        {
            return new StartCheckoutResult
            {
                Market = market,
                Subtotal = subtotal,
                Vat = vat,
                Total = subtotal + vat,
                RecurringMonthly = recurringMonthly,
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
                reuse.Progress = Progress(selected, upgrading, inventory);
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
                    RecurringMonthly = recurringMonthly,
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
            NotifyTenantId = BlocksContext.GetContext()?.TenantId ?? string.Empty,
            State = OrderStates.Pending,
            Market = market,
            Subtotal = subtotal,
            Vat = vat,
            Total = subtotal + vat,
            Lines = orderLines,
            Progress = Progress(selected, upgrading, inventory),
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
            RecurringMonthly = recurringMonthly,
            Lines = lines,
        };
    }

    /// <summary>
    /// One progress entry per environment the order works on: those it creates, and those it
    /// upgrades — which already have their tenant, and only one step to go through.
    /// </summary>
    private static List<OrderEnvironmentProgress> Progress(
        IEnumerable<string> created,
        IEnumerable<string> upgraded,
        ProjectInventorySnapshot inventory) =>
    [
        .. created.Select(e => new OrderEnvironmentProgress { Environment = e }),
        .. upgraded.Select(e => new OrderEnvironmentProgress
        {
            Environment = e,
            TenantId = inventory.TenantIds.GetValueOrDefault(e) ?? string.Empty,
            Upgrade = true,
        }),
    ];

    /// <summary>Prices one top-up, or names why it cannot be bought. Null means it is fine.</summary>
    private static string? PriceTopUp(
        TopUpSelection topUp,
        PlanCatalogue catalogue,
        PriceBook prices,
        string market,
        Proration proration,
        List<CheckoutLine> lines,
        List<OrderLine> orderLines)
    {
        if (topUp.Steps <= 0)
        {
            return CheckoutFailures.NothingSelected;
        }

        if (!catalogue.Environments.TryGetValue(topUp.Environment ?? string.Empty, out var environment))
        {
            return CheckoutFailures.UnknownEnvironment;
        }

        var meter = catalogue.FindMeter(topUp.Meter ?? string.Empty);

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

        // Rent is prorated like an environment; a one-off counter step is never — its units are
        // bought outright and carry until spent, so there is no period to divide.
        var (dueToday, label) = billing == "rent"
            ? proration.Apply(amount, meter.Label)
            : (amount, meter.Label);

        lines.Add(new CheckoutLine
        {
            Kind = "topup",
            Label = label,
            Environment = topUp.Environment,
            Meter = topUp.Meter,
            Units = units,
            Amount = dueToday,
            Billing = billing,
        });

        orderLines.Add(new OrderLine
        {
            Kind = "topup",
            Environment = topUp.Environment,
            Meter = topUp.Meter,
            Label = label,
            Steps = topUp.Steps,
            Units = units,
            Amount = dueToday,
            RecurringAmount = billing == "rent" ? amount : null,
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
            TenantGroupId = order.TenantGroupId,
            NotifyTenantId = order.NotifyTenantId,
            State = order.State,
            Total = order.Total,
            Market = order.Market,
            StepsDone = order.StepsDone,
            StepsTotal = order.StepsTotal,
            CurrentEnvironment = running?.Environment ?? string.Empty,
            CurrentStep = running is null ? string.Empty : ProvisioningSteps.FriendlyAt(running),
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
                StepsTotal = ProvisioningSteps.For(p).Count,
                Step = p.IsComplete ? string.Empty : ProvisioningSteps.FriendlyAt(p),
                Status = p.IsComplete ? "ready"
                    : p.Attempt > 1 ? "retrying"
                    : p.StartedAtUtc is null ? "queued" : "building",
                Attempt = p.Attempt > 1 ? p.Attempt : 0,
            })],
        };
    }
}

/// <summary>
/// How much of a rent line is due today, when it joins a subscription part-way through a period.
/// </summary>
/// <remarks>
/// Driven by the catalogue's <c>billing.onAdd</c>: only <c>prorateAndChargeNow</c> divides the
/// price, anything else charges it in full. Days are counted up — a period with half a day left
/// charges that day — and capped at the catalogue's usage period, so a stale anchor can never
/// charge more than the full price.
/// </remarks>
public readonly record struct Proration(int RemainingDays, int PeriodDays)
{
    public static Proration None => new(0, 0);

    public bool Applies => PeriodDays > 0 && RemainingDays > 0 && RemainingDays < PeriodDays;

    public static Proration For(ProjectSubscription? subscription, PlanCatalogue catalogue, DateTime utcNow)
    {
        if (subscription is null
            || subscription.State == SubscriptionStates.Cancelled
            || !string.Equals(catalogue.Billing.OnAdd, CheckoutService.ProrateOnAdd, StringComparison.Ordinal))
        {
            return None;
        }

        var periodDays = catalogue.UsagePeriod.Days > 0 ? catalogue.UsagePeriod.Days : 30;

        // A boundary already passed and not yet renewed: the renewal is about to charge a whole
        // period, so this one is charged whole too rather than for a negative remainder.
        if (subscription.NextChargeAtUtc <= utcNow)
        {
            return None;
        }

        var remaining = (int)Math.Ceiling((subscription.NextChargeAtUtc - utcNow).TotalDays);

        return new Proration(Math.Clamp(remaining, 0, periodDays), periodDays);
    }

    /// <summary>The amount due today and the label that says why it is less than the price.</summary>
    public (decimal Amount, string Label) Apply(decimal price, string label)
    {
        if (!Applies)
        {
            return (price, label);
        }

        var amount = Math.Round(price * RemainingDays / PeriodDays, 2, MidpointRounding.AwayFromZero);

        return (amount, $"{label} (prorated, {RemainingDays} days)");
    }
}
