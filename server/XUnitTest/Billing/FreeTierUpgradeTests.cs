using DomainService.Billing.Entities;
using DomainService.Billing.Models;
using DomainService.Billing.Services;
using DomainService.Catalogue.Models;
using DomainService.Catalogue.Services;
using DomainService.Projects;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using Xunit;
using XUnitTest.TestSupport;

namespace XUnitTest.Billing;

/// <summary>B14: a free dev moves to the paid tier in place — nothing is created, limits rise.</summary>
public class FreeTierUpgradeTests
{
    private const string Group = "grp_1";
    private const string DevTenant = "Dgrp_1";
    private static readonly DateTime Now = new(2026, 10, 11, 12, 0, 0, DateTimeKind.Utc);

    private readonly Mock<ISubscriptionOrderStore> _orders = new();
    private readonly Mock<ICatalogueProvider> _catalogue = new();
    private readonly Mock<IProjectInventory> _inventory = new();
    private readonly ProjectInventorySnapshot _held = new();

    public FreeTierUpgradeTests()
    {
        _catalogue.SetupGet(c => c.Catalogue).Returns(new PlanCatalogue
        {
            UsagePeriod = new UsagePeriodDefinition { Days = 30 },
            Billing = new BillingDefinition { OnAdd = "prorateAndChargeNow" },
            Services = new Dictionary<string, ServiceDefinition>(StringComparer.Ordinal)
            {
                ["api"] = new() { Meters = new(StringComparer.Ordinal) { ["calls"] = new() { Label = "API calls" } } },
            },
            LimitSets = new Dictionary<string, Dictionary<string, Dictionary<string, long>>>(StringComparer.Ordinal)
            {
                ["dev"] = new(StringComparer.Ordinal) { ["api"] = new(StringComparer.Ordinal) { ["calls"] = 100000 } },
            },
            Environments = new Dictionary<string, EnvironmentDefinition>(StringComparer.Ordinal)
            {
                ["dev"] = new() { Label = "Development", Rank = 1, LimitSet = "dev", FreeLimitSet = "free-dev", FreeTierAvailable = true, MaxFreePerProject = 1 },
            },
            TopUpSteps = new Dictionary<string, Dictionary<string, long>>(StringComparer.Ordinal)
            {
                ["api"] = new(StringComparer.Ordinal) { ["calls"] = 100000 },
            },
        });
        _catalogue.SetupGet(c => c.PriceBook).Returns(new PriceBook
        {
            Markets = ["CHF"],
            DefaultMarket = "CHF",
            Environments = new Dictionary<string, Dictionary<string, Dictionary<string, decimal>>>(StringComparer.Ordinal)
            {
                ["dev"] = new(StringComparer.Ordinal)
                {
                    ["free"] = new(StringComparer.Ordinal) { ["CHF"] = 0m },
                    ["paid"] = new(StringComparer.Ordinal) { ["CHF"] = 50m },
                },
            },
            TopUpSteps = new Dictionary<string, Dictionary<string, TopUpStepPrice>>(StringComparer.Ordinal)
            {
                ["api"] = new(StringComparer.Ordinal) { ["calls"] = new() { Step = 100000, Billing = "oneOffCarries", Price = new(StringComparer.Ordinal) { ["CHF"] = 20m } } },
            },
        });
        _orders.Setup(o => o.ClaimAsync(It.IsAny<SubscriptionOrder>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((SubscriptionOrder o, CancellationToken _) => new OrderClaim(true, o));
        _inventory.Setup(i => i.GetAsync(Group, It.IsAny<string?>(), It.IsAny<CancellationToken>())).ReturnsAsync(_held);
    }

    private void HoldFreeDev()
    {
        _held.Existing.Add("dev");
        _held.TenantIds["dev"] = DevTenant;
        _held.FreeEnvironments.Add("dev");
    }

    private CheckoutService Checkout() =>
        new(_orders.Object, _catalogue.Object, NullLogger<CheckoutService>.Instance, new FixedTime(Now), _inventory.Object);

    private static StartCheckoutRequest Upgrade() => new() { TenantGroupId = Group, UpgradeFreeTier = true, Market = "CHF" };

    [Fact]
    public async Task An_upgrade_is_priced_like_adding_the_environment()
    {
        HoldFreeDev();

        var result = await Checkout().QuoteAsync(Upgrade());

        Assert.True(result.IsSuccess);
        var line = Assert.Single(result.Lines);
        Assert.Equal("upgrade", line.Kind);
        Assert.Equal("Development (paid tier)", line.Label);
        Assert.Equal(50m, line.Amount);
        Assert.Equal("rent", line.Billing);
        Assert.Equal(50m, result.RecurringMonthly);
    }

    [Fact]
    public async Task An_upgrade_mid_period_is_prorated_and_recurs_in_full()
    {
        HoldFreeDev();
        _held.Subscription = new ProjectSubscription { State = SubscriptionStates.Active, NextChargeAtUtc = Now.AddDays(15) };

        var result = await Checkout().QuoteAsync(Upgrade());

        Assert.Equal(25m, result.Lines[0].Amount);
        Assert.Equal("Development (paid tier) (prorated, 15 days)", result.Lines[0].Label);
        Assert.Equal(50m, result.RecurringMonthly);
    }

    [Fact]
    public async Task The_order_carries_one_upgrade_step_for_the_existing_tenant()
    {
        HoldFreeDev();
        SubscriptionOrder? written = null;
        _orders.Setup(o => o.ClaimAsync(It.IsAny<SubscriptionOrder>(), It.IsAny<CancellationToken>()))
            .Callback<SubscriptionOrder, CancellationToken>((o, _) => written = o)
            .ReturnsAsync((SubscriptionOrder o, CancellationToken _) => new OrderClaim(true, o));

        await Checkout().StartAsync(Upgrade(), "usr_1");

        var progress = Assert.Single(written!.Progress);
        Assert.True(progress.Upgrade);
        Assert.Equal(DevTenant, progress.TenantId);
        Assert.Equal(1, written.StepsTotal);
        Assert.Equal(DevTenant, written.Lines[0].TenantId);
        Assert.Equal("Raising your limits", CheckoutService.ToView(written).CurrentStep);
    }

    [Fact]
    public async Task Nothing_free_means_nothing_to_upgrade()
    {
        _held.Existing.Add("dev");

        var result = await Checkout().QuoteAsync(Upgrade());

        Assert.Equal(CheckoutFailures.NothingToUpgrade, result.Reason);
    }

    [Fact]
    public async Task A_new_project_has_nothing_to_upgrade()
    {
        var result = await Checkout().QuoteAsync(new StartCheckoutRequest { UpgradeFreeTier = true });

        Assert.Equal(CheckoutFailures.NothingToUpgrade, result.Reason);
    }

    [Fact]
    public async Task An_upgrade_already_in_flight_is_refused()
    {
        HoldFreeDev();
        _held.UpgradesInFlight.Add("dev");

        var result = await Checkout().QuoteAsync(Upgrade());

        Assert.Equal(CheckoutFailures.EnvironmentExists, result.Reason);
    }

    [Fact]
    public async Task Topping_up_the_environment_being_upgraded_is_allowed_in_the_same_order()
    {
        HoldFreeDev();
        var request = Upgrade();
        request.TopUps = [new TopUpSelection { Environment = "dev", Meter = "api.calls", Steps = 1 }];

        var result = await Checkout().QuoteAsync(request);

        Assert.True(result.IsSuccess);
        Assert.Equal(70m, result.Subtotal);
    }

    [Fact]
    public async Task Without_the_upgrade_the_free_environment_still_cannot_be_topped_up()
    {
        HoldFreeDev();
        var request = new StartCheckoutRequest
        {
            TenantGroupId = Group,
            TopUps = [new TopUpSelection { Environment = "dev", Meter = "api.calls", Steps = 1 }],
        };

        var result = await Checkout().QuoteAsync(request);

        Assert.Equal(CheckoutFailures.FreeTierCannotTopUp, result.Reason);
    }

    // ── Pay, provisioning and the subscription ──────────────────────────────

    private static SubscriptionOrder UpgradeOrder() => new()
    {
        ItemId = "ord_1",
        TenantGroupId = Group,
        IdempotencyKey = "k",
        State = OrderStates.Pending,
        Total = 54.05m,
        ExpiresAtUtc = DateTime.UtcNow.AddHours(1),
        Lines = [new OrderLine { Kind = "upgrade", Environment = "dev", TenantId = DevTenant, Amount = 50m, RecurringAmount = 50m, Billing = "rent" }],
        Progress = [new OrderEnvironmentProgress { Environment = "dev", TenantId = DevTenant, Upgrade = true }],
    };

    [Fact]
    public async Task Paying_for_an_upgrade_another_order_got_first_is_refused()
    {
        HoldFreeDev();
        _held.UpgradesInFlight.Add("dev");
        _orders.Setup(o => o.GetAsync(Group, "ord_1", It.IsAny<CancellationToken>())).ReturnsAsync(UpgradeOrder());
        var gateway = new Mock<IPaymentGateway>();

        var view = await new OrderPaymentService(
                _orders.Object, new Mock<IPaymentMethodService>().Object, gateway.Object, new Mock<IProvisioningQueue>().Object,
                NullLogger<OrderPaymentService>.Instance, null, _inventory.Object)
            .PayAsync(new PayCheckoutRequest { TenantGroupId = Group, OrderId = "ord_1", IdempotencyKey = "k" });

        Assert.Equal(CheckoutFailures.EnvironmentExists, view.State);
        gateway.Verify(g => g.ChargeStoredCardAsync(It.IsAny<ChargeRequest>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task The_upgrade_step_raises_limits_in_place_and_creates_nothing()
    {
        var seeder = new Mock<IResourceLimitSeeder>();
        var projectManagement = new Mock<IProjectManagementService>();
        var runner = new ProvisioningStepRunner(
            new Mock<IProjectRepository>().Object, projectManagement.Object, seeder.Object, _catalogue.Object,
            NullLogger<ProvisioningStepRunner>.Instance);
        var order = UpgradeOrder();

        var outcome = await runner.RunAsync(order, order.Progress[0], ProvisioningSteps.RaiseLimits);

        Assert.True(outcome.Succeeded);
        seeder.Verify(s => s.ChangeTierAsync(DevTenant, "dev", false, It.IsAny<CancellationToken>()), Times.Once);
        // Never a period sync: a new period key would reset the counters.
        seeder.Verify(s => s.SyncAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<bool>(), It.IsAny<CancellationToken>()), Times.Never);
        projectManagement.Verify(m => m.SaveProjectAsync(It.IsAny<CreateProjectRequest>()), Times.Never);
    }

    [Fact]
    public async Task The_provisioner_runs_only_the_upgrade_step_and_finishes_the_order()
    {
        var steps = new Mock<IProvisioningStepRunner>();
        steps.Setup(s => s.RunAsync(It.IsAny<SubscriptionOrder>(), It.IsAny<OrderEnvironmentProgress>(), It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(StepOutcome.Ok(DevTenant));
        var renewals = new Mock<IRenewalService>();
        var order = UpgradeOrder();
        order.State = OrderStates.Paid;
        _orders.Setup(o => o.GetAsync(Group, "ord_1", It.IsAny<CancellationToken>())).ReturnsAsync(order);

        var finished = await new OrderProvisioner(
                _orders.Object, steps.Object, new Mock<IOrderNotifier>().Object, renewals.Object,
                NullLogger<OrderProvisioner>.Instance, null, [])
            .RunAsync(Group, "ord_1");

        Assert.True(finished);
        Assert.Equal(OrderStates.Created, order.State);
        steps.Verify(s => s.RunAsync(order, It.IsAny<OrderEnvironmentProgress>(), ProvisioningSteps.RaiseLimits, It.IsAny<CancellationToken>()), Times.Once);
        steps.Verify(s => s.RunAsync(order, It.IsAny<OrderEnvironmentProgress>(), ProvisioningSteps.CreateTenant, It.IsAny<CancellationToken>()), Times.Never);
        renewals.Verify(r => r.ApplyOrderAsync(order, It.IsAny<CancellationToken>()), Times.Once);
    }

    private static (RenewalService Service, Mock<ISubscriptionStore> Store) Renewals(ProjectSubscription? existing)
    {
        var store = new Mock<ISubscriptionStore>();
        store.Setup(s => s.GetAsync(Group, It.IsAny<CancellationToken>())).ReturnsAsync(existing);
        var service = new RenewalService(
            store.Object, new Mock<IInvoiceStore>().Object, new Mock<IPaymentMethodService>().Object, new Mock<IPaymentGateway>().Object,
            new Mock<IInvoiceMailer>().Object, new Mock<ISubscriptionLifecycleService>().Object, NullLogger<RenewalService>.Instance,
            new FixedTime(Now));
        return (service, store);
    }

    [Fact]
    public async Task Applying_flips_the_free_line_to_the_paid_price_and_keeps_the_anchor()
    {
        var anchor = Now.AddDays(15);
        var subscription = new ProjectSubscription
        {
            TenantGroupId = Group,
            NextChargeAtUtc = anchor,
            Lines = [new RecurringLine { Kind = "environment", Environment = "dev", TenantId = DevTenant, Amount = 0m }],
        };
        var (service, _) = Renewals(subscription);

        await service.ApplyOrderAsync(UpgradeOrder());

        var line = Assert.Single(subscription.Lines);
        Assert.Equal(50m, line.Amount);
        Assert.Equal(anchor, subscription.NextChargeAtUtc);
    }

    [Fact]
    public async Task A_free_dev_made_by_create_gets_its_first_line_on_upgrade()
    {
        ProjectSubscription? saved = null;
        var (service, store) = Renewals(null);
        store.Setup(s => s.UpsertAsync(It.IsAny<ProjectSubscription>(), It.IsAny<CancellationToken>()))
            .Callback<ProjectSubscription, CancellationToken>((s, _) => saved = s)
            .Returns(Task.CompletedTask);

        await service.ApplyOrderAsync(UpgradeOrder());

        var line = Assert.Single(saved!.Lines);
        Assert.Equal("environment", line.Kind);
        Assert.Equal(DevTenant, line.TenantId);
        Assert.Equal(50m, line.Amount);
    }
}
