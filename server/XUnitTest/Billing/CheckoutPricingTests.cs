using DomainService.Billing.Entities;
using DomainService.Billing.Models;
using DomainService.Billing.Services;
using DomainService.Catalogue.Models;
using DomainService.Catalogue.Services;
using Microsoft.Extensions.Logging.Abstractions;
using XUnitTest.TestSupport;
using Moq;
using Xunit;

namespace XUnitTest.Billing;

/// <summary>
/// Free tier, environments already held, and proration: what checkout refuses or prices before
/// any money moves.
/// </summary>
public class CheckoutPricingTests
{
    private const string Group = "grp_1";
    private const string User = "usr_1";

    private static readonly DateTime Now = new(2026, 10, 11, 12, 0, 0, DateTimeKind.Utc);

    private readonly Mock<ISubscriptionOrderStore> _orders = new();
    private readonly Mock<ICatalogueProvider> _catalogue = new();
    private readonly Mock<IProjectInventory> _inventory = new();
    private readonly PlanCatalogue _plan;
    private ProjectInventorySnapshot _held = new();

    public CheckoutPricingTests()
    {
        _plan = new PlanCatalogue
        {
            CatalogueVersion = "test",
            UsagePeriod = new UsagePeriodDefinition { Days = 30 },
            Billing = new BillingDefinition { OnAdd = "prorateAndChargeNow" },
            Services = new Dictionary<string, ServiceDefinition>(StringComparer.Ordinal)
            {
                ["api"] = new() { Meters = new(StringComparer.Ordinal) { ["calls"] = new() { Label = "API calls", Kind = "counter" } } },
                ["ai"] = new() { Meters = new(StringComparer.Ordinal) { ["agents"] = new() { Label = "Agents", Kind = "resource" } } },
            },
            LimitSets = new Dictionary<string, Dictionary<string, Dictionary<string, long>>>(StringComparer.Ordinal)
            {
                ["dev"] = new(StringComparer.Ordinal)
                {
                    ["api"] = new(StringComparer.Ordinal) { ["calls"] = 100000 },
                    ["ai"] = new(StringComparer.Ordinal) { ["agents"] = 7 },
                },
            },
            Environments = new Dictionary<string, EnvironmentDefinition>(StringComparer.Ordinal)
            {
                ["dev"] = new() { Label = "Development", Rank = 1, LimitSet = "dev", FreeLimitSet = "free-dev", FreeTierAvailable = true, MaxFreePerProject = 1 },
                ["stg"] = new() { Label = "Staging", Rank = 3, LimitSet = "dev" },
                ["prod"] = new() { Label = "Production", Rank = 7, LimitSet = "dev", TopUpUncapped = true },
            },
            TopUpSteps = new Dictionary<string, Dictionary<string, long>>(StringComparer.Ordinal)
            {
                ["api"] = new(StringComparer.Ordinal) { ["calls"] = 100000 },
                ["ai"] = new(StringComparer.Ordinal) { ["agents"] = 5 },
            },
        };

        var prices = new PriceBook
        {
            Markets = ["CHF", "USD"],
            DefaultMarket = "CHF",
            Environments = new Dictionary<string, Dictionary<string, Dictionary<string, decimal>>>(StringComparer.Ordinal)
            {
                ["dev"] = new(StringComparer.Ordinal)
                {
                    ["free"] = new(StringComparer.Ordinal) { ["CHF"] = 0m },
                    ["paid"] = new(StringComparer.Ordinal) { ["CHF"] = 50m },
                },
                ["stg"] = new(StringComparer.Ordinal) { ["paid"] = new(StringComparer.Ordinal) { ["CHF"] = 100m } },
                ["prod"] = new(StringComparer.Ordinal) { ["paid"] = new(StringComparer.Ordinal) { ["CHF"] = 300m } },
            },
            TopUpSteps = new Dictionary<string, Dictionary<string, TopUpStepPrice>>(StringComparer.Ordinal)
            {
                ["api"] = new(StringComparer.Ordinal) { ["calls"] = new() { Kind = "counter", Step = 100000, Billing = "oneOffCarries", Price = new(StringComparer.Ordinal) { ["CHF"] = 20m } } },
                ["ai"] = new(StringComparer.Ordinal) { ["agents"] = new() { Kind = "resource", Step = 5, Billing = "recurringWhileHeld", Price = new(StringComparer.Ordinal) { ["CHF"] = 30m } } },
            },
        };

        _catalogue.SetupGet(c => c.Catalogue).Returns(_plan);
        _catalogue.SetupGet(c => c.PriceBook).Returns(prices);

        _orders
            .Setup(o => o.ClaimAsync(It.IsAny<SubscriptionOrder>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((SubscriptionOrder o, CancellationToken _) => new OrderClaim(true, o));

        _inventory
            .Setup(i => i.GetAsync(It.IsAny<string>(), It.IsAny<string?>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(() => _held);
    }

    private CheckoutService Service() =>
        new(_orders.Object, _catalogue.Object, NullLogger<CheckoutService>.Instance, new FixedTime(Now), _inventory.Object);

    private static StartCheckoutRequest Request(params string[] environments) =>
        new() { TenantGroupId = Group, Environments = [.. environments], Market = "CHF" };

    private void HoldSubscription(DateTime nextChargeAtUtc) =>
        _held.Subscription = new ProjectSubscription
        {
            TenantGroupId = Group,
            State = SubscriptionStates.Active,
            NextChargeAtUtc = nextChargeAtUtc,
            Lines = [new RecurringLine { Kind = "environment", Environment = "prod", Amount = 300m }],
        };

    // ── B1 free tier ────────────────────────────────────────────────────────

    [Fact]
    public async Task Free_dev_is_priced_at_zero_as_rent()
    {
        var request = Request("dev");
        request.FreeTier = true;

        var result = await Service().StartAsync(request, User);

        Assert.True(result.IsSuccess);
        Assert.Equal(0m, result.Total);
        var line = Assert.Single(result.Lines);
        Assert.Equal(0m, line.Amount);
        Assert.Equal("rent", line.Billing);
        Assert.Contains("(free)", line.Label);
    }

    [Fact]
    public async Task Free_tier_applies_only_to_dev_and_the_rest_is_charged()
    {
        var request = Request("dev", "prod");
        request.FreeTier = true;

        SubscriptionOrder? written = null;
        _orders
            .Setup(o => o.ClaimAsync(It.IsAny<SubscriptionOrder>(), It.IsAny<CancellationToken>()))
            .Callback<SubscriptionOrder, CancellationToken>((o, _) => written = o)
            .ReturnsAsync((SubscriptionOrder o, CancellationToken _) => new OrderClaim(true, o));

        var result = await Service().StartAsync(request, User);

        Assert.Equal(300m, result.Subtotal);
        Assert.True(written!.Lines.Single(l => l.Environment == "dev").FreeTier);
        Assert.False(written.Lines.Single(l => l.Environment == "prod").FreeTier);
    }

    [Fact]
    public async Task A_second_free_dev_is_refused()
    {
        _held.AddFreeForTest("dev");
        var request = Request("dev");
        request.FreeTier = true;

        var result = await Service().QuoteAsync(request);

        Assert.False(result.IsSuccess);
        Assert.Equal(CheckoutFailures.FreeTierTaken, result.Reason);
    }

    [Fact]
    public async Task Free_tier_with_no_free_environment_selected_is_refused_not_charged()
    {
        var request = Request("prod");
        request.FreeTier = true;

        var result = await Service().QuoteAsync(request);

        Assert.Equal(CheckoutFailures.FreeTierUnavailable, result.Reason);
    }

    [Fact]
    public async Task A_top_up_on_a_free_dev_in_the_same_order_is_refused()
    {
        var request = Request("dev");
        request.FreeTier = true;
        request.TopUps = [new TopUpSelection { Environment = "dev", Meter = "api.calls", Steps = 1 }];

        var result = await Service().QuoteAsync(request);

        Assert.Equal(CheckoutFailures.FreeTierCannotTopUp, result.Reason);
    }

    [Fact]
    public async Task A_top_up_on_an_existing_free_dev_is_refused()
    {
        _held.Existing.Add("dev");
        _held.FreeEnvironments.Add("dev");
        var request = new StartCheckoutRequest
        {
            TenantGroupId = Group,
            TopUps = [new TopUpSelection { Environment = "dev", Meter = "api.calls", Steps = 1 }],
        };

        var result = await Service().QuoteAsync(request);

        Assert.Equal(CheckoutFailures.FreeTierCannotTopUp, result.Reason);
    }

    // ── B2 already held ─────────────────────────────────────────────────────

    [Fact]
    public async Task An_environment_the_project_has_is_refused()
    {
        _held.Existing.Add("stg");

        var result = await Service().StartAsync(Request("stg"), User);

        Assert.Equal(CheckoutFailures.EnvironmentExists, result.Reason);
        _orders.Verify(o => o.ClaimAsync(It.IsAny<SubscriptionOrder>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task An_environment_an_order_is_already_creating_is_refused()
    {
        _held.InFlight.Add("prod");

        var result = await Service().QuoteAsync(Request("prod"));

        Assert.Equal(CheckoutFailures.EnvironmentExists, result.Reason);
    }

    [Fact]
    public async Task A_top_up_for_an_environment_not_held_is_refused()
    {
        var request = new StartCheckoutRequest
        {
            TenantGroupId = Group,
            TopUps = [new TopUpSelection { Environment = "stg", Meter = "api.calls", Steps = 1 }],
        };

        var result = await Service().QuoteAsync(request);

        Assert.Equal(CheckoutFailures.EnvironmentNotHeld, result.Reason);
    }

    [Fact]
    public async Task A_top_up_for_an_environment_bought_in_the_same_order_is_fine()
    {
        var request = Request("stg");
        request.TopUps = [new TopUpSelection { Environment = "stg", Meter = "api.calls", Steps = 1 }];

        var result = await Service().QuoteAsync(request);

        Assert.True(result.IsSuccess);
        Assert.Equal(120m, result.Subtotal);
    }

    // ── B3 proration ────────────────────────────────────────────────────────

    [Fact]
    public async Task An_environment_added_mid_period_is_prorated_and_recurs_in_full()
    {
        HoldSubscription(Now.AddDays(15));

        var result = await Service().QuoteAsync(Request("stg"));

        var line = Assert.Single(result.Lines);
        Assert.Equal(50m, line.Amount); // 100 × 15 / 30
        Assert.Equal("Staging (prorated, 15 days)", line.Label);
        Assert.Equal(100m, result.RecurringMonthly);
    }

    [Fact]
    public async Task Proration_rounds_to_two_decimals_away_from_zero()
    {
        HoldSubscription(Now.AddDays(7));

        var result = await Service().QuoteAsync(Request("stg"));

        Assert.Equal(23.33m, Assert.Single(result.Lines).Amount); // 100 × 7 / 30 = 23.333…
    }

    [Fact]
    public async Task A_part_day_left_counts_as_a_day()
    {
        HoldSubscription(Now.AddHours(1));

        var result = await Service().QuoteAsync(Request("stg"));

        Assert.Equal(3.33m, Assert.Single(result.Lines).Amount);
        Assert.Contains("1 days", result.Lines[0].Label);
    }

    [Fact]
    public async Task A_recurring_top_up_is_prorated_but_a_counter_top_up_is_not()
    {
        _held.Existing.Add("prod");
        HoldSubscription(Now.AddDays(10));
        var request = new StartCheckoutRequest
        {
            TenantGroupId = Group,
            TopUps =
            [
                new TopUpSelection { Environment = "prod", Meter = "ai.agents", Steps = 1 },
                new TopUpSelection { Environment = "prod", Meter = "api.calls", Steps = 1 },
            ],
        };

        var result = await Service().QuoteAsync(request);

        var rent = result.Lines.Single(l => l.Meter == "ai.agents");
        var once = result.Lines.Single(l => l.Meter == "api.calls");
        Assert.Equal(10m, rent.Amount); // 30 × 10 / 30
        Assert.Contains("prorated, 10 days", rent.Label);
        Assert.Equal(20m, once.Amount);
        Assert.DoesNotContain("prorated", once.Label);
        Assert.Equal(30m, result.RecurringMonthly);
    }

    [Fact]
    public async Task The_order_keeps_the_full_recurring_price_for_the_subscription()
    {
        HoldSubscription(Now.AddDays(15));
        SubscriptionOrder? written = null;
        _orders
            .Setup(o => o.ClaimAsync(It.IsAny<SubscriptionOrder>(), It.IsAny<CancellationToken>()))
            .Callback<SubscriptionOrder, CancellationToken>((o, _) => written = o)
            .ReturnsAsync((SubscriptionOrder o, CancellationToken _) => new OrderClaim(true, o));

        await Service().StartAsync(Request("stg"), User);

        var line = Assert.Single(written!.Lines);
        Assert.Equal(50m, line.Amount);
        Assert.Equal(100m, line.RecurringAmount);
    }

    [Fact]
    public async Task No_subscription_means_no_proration()
    {
        var result = await Service().QuoteAsync(Request("stg"));

        Assert.Equal(100m, Assert.Single(result.Lines).Amount);
    }

    [Fact]
    public async Task A_catalogue_that_does_not_prorate_charges_in_full()
    {
        _plan.Billing.OnAdd = "chargeFullNow";
        HoldSubscription(Now.AddDays(15));

        var result = await Service().QuoteAsync(Request("stg"));

        Assert.Equal(100m, Assert.Single(result.Lines).Amount);
    }

    [Fact]
    public async Task An_overdue_boundary_charges_in_full_rather_than_a_negative_remainder()
    {
        HoldSubscription(Now.AddDays(-2));

        var result = await Service().QuoteAsync(Request("stg"));

        Assert.Equal(100m, Assert.Single(result.Lines).Amount);
    }

    // ── B12 new project quote ───────────────────────────────────────────────

    [Fact]
    public async Task A_quote_for_a_new_project_prices_without_reading_anything()
    {
        var request = new StartCheckoutRequest { Environments = ["dev", "prod"], FreeTier = true, Market = "CHF" };

        var result = await Service().QuoteAsync(request);

        Assert.True(result.IsSuccess);
        Assert.Equal(300m, result.Subtotal);
        Assert.Equal(string.Empty, result.OrderId);
        Assert.Equal(string.Empty, result.IdempotencyKey);
        _inventory.Verify(i => i.GetAsync(It.IsAny<string>(), It.IsAny<string?>(), It.IsAny<CancellationToken>()), Times.Never);
        _orders.Verify(o => o.ClaimAsync(It.IsAny<SubscriptionOrder>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task A_new_project_quote_still_applies_the_top_up_cap()
    {
        var request = new StartCheckoutRequest
        {
            Environments = ["stg"],
            TopUps = [new TopUpSelection { Environment = "stg", Meter = "ai.agents", Steps = 2 }],
        };

        var result = await Service().QuoteAsync(request);

        // 7 included + 10 bought > 14 (2 × included).
        Assert.Equal(CheckoutFailures.CapExceeded, result.Reason);
    }

    [Fact]
    public async Task Starting_an_order_needs_a_project()
    {
        var request = new StartCheckoutRequest { Environments = ["prod"] };

        var result = await Service().StartAsync(request, User);

        Assert.False(result.IsSuccess);
        _orders.Verify(o => o.ClaimAsync(It.IsAny<SubscriptionOrder>(), It.IsAny<CancellationToken>()), Times.Never);
    }
}

internal static class ProjectInventorySnapshotTestExtensions
{
    public static void AddFreeForTest(this ProjectInventorySnapshot snapshot, string environment) =>
        snapshot.FreeCount[environment] = snapshot.FreeHeld(environment) + 1;
}
