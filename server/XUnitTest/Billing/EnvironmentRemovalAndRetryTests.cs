using DomainService.Billing.Entities;
using DomainService.Billing.Models;
using DomainService.Billing.Services;
using DomainService.Catalogue.Models;
using DomainService.Catalogue.Services;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using Xunit;
using XUnitTest.TestSupport;

namespace XUnitTest.Billing;

/// <summary>B4: removing an environment ends its billing at the period end and nothing sooner.</summary>
public class EnvironmentRemovalServiceTests
{
    private const string Group = "grp_1";
    private static readonly DateTime Next = new(2026, 11, 1, 0, 0, 0, DateTimeKind.Utc);

    private readonly Mock<ISubscriptionStore> _subscriptions = new();
    private readonly Mock<ICatalogueProvider> _catalogue = new();

    public EnvironmentRemovalServiceTests()
    {
        _catalogue.SetupGet(c => c.Catalogue).Returns(new PlanCatalogue { Billing = new BillingDefinition { OnRemove = "atUsagePeriodEnd" } });
    }

    private EnvironmentRemovalService Service() =>
        new(_subscriptions.Object, _catalogue.Object, NullLogger<EnvironmentRemovalService>.Instance);

    private ProjectSubscription Given(string state = SubscriptionStates.Active)
    {
        var subscription = new ProjectSubscription
        {
            TenantGroupId = Group,
            State = state,
            NextChargeAtUtc = Next,
            Lines =
            [
                new RecurringLine { Kind = "environment", Environment = "stg", Amount = 100m },
                new RecurringLine { Kind = "topup", Environment = "stg", Meter = "ai.agents", Amount = 30m },
                new RecurringLine { Kind = "environment", Environment = "prod", Amount = 300m },
            ],
        };
        _subscriptions.Setup(s => s.GetAsync(Group, It.IsAny<CancellationToken>())).ReturnsAsync(subscription);
        return subscription;
    }

    [Fact]
    public async Task Removing_ends_the_environment_and_its_top_ups_at_the_next_charge()
    {
        var subscription = Given();

        var result = await Service().RemoveAsync(Group, "stg");

        Assert.True(result.IsSuccess);
        Assert.Equal(Next, result.EffectiveUtc);
        Assert.All(subscription.Lines.Where(l => l.Environment == "stg"), l => Assert.Equal(Next, l.EndsAtUtc));
        Assert.Null(subscription.Lines.Single(l => l.Environment == "prod").EndsAtUtc);
        _subscriptions.Verify(s => s.UpsertAsync(subscription, It.IsAny<CancellationToken>()), Times.Once);
    }

    [Theory]
    [InlineData("uat")]
    [InlineData("")]
    public async Task An_environment_not_in_the_subscription_is_not_found(string environment)
    {
        Given();

        var result = await Service().RemoveAsync(Group, environment);

        Assert.Equal(BillingFailures.EnvironmentNotFound, result.Reason);
        _subscriptions.Verify(s => s.UpsertAsync(It.IsAny<ProjectSubscription>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task Nothing_is_found_on_a_cancelled_subscription()
    {
        Given(SubscriptionStates.Cancelled);

        var result = await Service().RemoveAsync(Group, "stg");

        Assert.Equal(BillingFailures.EnvironmentNotFound, result.Reason);
    }

    [Fact]
    public async Task Keeping_takes_the_removal_back()
    {
        var subscription = Given();
        await Service().RemoveAsync(Group, "stg");

        var result = await Service().KeepAsync(Group, "stg");

        Assert.True(result.IsSuccess);
        Assert.Null(result.EffectiveUtc);
        Assert.All(subscription.Lines, l => Assert.Null(l.EndsAtUtc));
    }

    [Fact]
    public async Task Keeping_what_was_never_removed_is_fine_and_writes_nothing()
    {
        Given();

        var result = await Service().KeepAsync(Group, "stg");

        Assert.True(result.IsSuccess);
        _subscriptions.Verify(s => s.UpsertAsync(It.IsAny<ProjectSubscription>(), It.IsAny<CancellationToken>()), Times.Never);
    }
}

/// <summary>B4 at the boundary, B7 retry, and B3's full price reaching the subscription.</summary>
public class RenewalRemovalAndRetryTests
{
    private const string Group = "grp_1";
    private static readonly DateTime Now = new(2026, 11, 1, 0, 5, 0, DateTimeKind.Utc);

    private readonly Mock<ISubscriptionStore> _subscriptions = new();
    private readonly Mock<IInvoiceStore> _invoices = new();
    private readonly Mock<IPaymentMethodService> _cards = new();
    private readonly Mock<IPaymentGateway> _gateway = new();
    private readonly Mock<IInvoiceMailer> _mailer = new();
    private readonly Mock<ISubscriptionLifecycleService> _lifecycle = new();
    private readonly Mock<IEnvironmentDisabler> _disabler = new();
    private readonly List<Invoice> _written = [];
    private readonly List<ChargeRequest> _charges = [];

    public RenewalRemovalAndRetryTests()
    {
        _invoices.Setup(i => i.NextNumberAsync(It.IsAny<DateTime>(), It.IsAny<CancellationToken>())).ReturnsAsync("INV-2026-11-0001");
        _invoices.Setup(i => i.InsertAsync(It.IsAny<Invoice>(), It.IsAny<CancellationToken>()))
            .Callback<Invoice, CancellationToken>((i, _) => _written.Add(i))
            .Returns(Task.CompletedTask);
        _cards.Setup(c => c.GetDefaultChargeSecretAsync(Group, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new CardSecret { ProviderToken = "tok" });
        _lifecycle.Setup(l => l.RolloverAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<bool>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(default(RolloverResult));
    }

    private RenewalService Service() =>
        new(_subscriptions.Object, _invoices.Object, _cards.Object, _gateway.Object, _mailer.Object, _lifecycle.Object,
            NullLogger<RenewalService>.Instance, new FixedTime(Now), _disabler.Object);

    private void Charge(ChargeOutcome outcome, string reason = "") =>
        _gateway
            .Setup(g => g.ChargeStoredCardAsync(It.IsAny<ChargeRequest>(), It.IsAny<CancellationToken>()))
            .Callback<ChargeRequest, CancellationToken>((r, _) => _charges.Add(r))
            .ReturnsAsync(new ChargeResult(outcome, outcome == ChargeOutcome.Authorised ? "psp_9" : "", reason));

    private static ProjectSubscription WithRemoval(DateTime endsAtUtc) => new()
    {
        TenantGroupId = Group,
        Market = "CHF",
        State = SubscriptionStates.Active,
        NextChargeAtUtc = Now.AddMinutes(-5),
        Lines =
        [
            new RecurringLine { Kind = "environment", Environment = "stg", TenantId = "Sgrp_1", Amount = 100m, EndsAtUtc = endsAtUtc },
            new RecurringLine { Kind = "topup", Environment = "stg", Meter = "ai.agents", Amount = 30m, EndsAtUtc = endsAtUtc },
            new RecurringLine { Kind = "environment", Environment = "prod", TenantId = "Pgrp_1", Amount = 300m },
        ],
    };

    [Fact]
    public async Task A_removed_environment_is_dropped_at_the_boundary_and_not_charged()
    {
        var subscription = WithRemoval(Now.AddMinutes(-5));
        Charge(ChargeOutcome.Authorised);
        _disabler.Setup(d => d.DisableAsync(Group, "stg", "Sgrp_1", It.IsAny<CancellationToken>())).ReturnsAsync(true);

        await Service().RenewAsync(subscription);

        Assert.Equal(300m + 24.30m, _written[0].Total);
        Assert.DoesNotContain(subscription.Lines, l => l.Environment == "stg");
        _disabler.Verify(d => d.DisableAsync(Group, "stg", "Sgrp_1", It.IsAny<CancellationToken>()), Times.Once);
        var removed = Assert.Single(subscription.RemovedEnvironments);
        Assert.True(removed.Disabled);
        // The removed environment is not rolled into a new period either.
        _lifecycle.Verify(l => l.RolloverAsync("Sgrp_1", It.IsAny<string>(), It.IsAny<string>(), It.IsAny<bool>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task A_removal_still_ahead_is_charged_as_usual()
    {
        var subscription = WithRemoval(Now.AddDays(3));
        Charge(ChargeOutcome.Authorised);

        await Service().RenewAsync(subscription);

        Assert.Equal(430m + 34.83m, _written[0].Total);
        _disabler.Verify(d => d.DisableAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task Billing_stops_even_when_the_tenant_will_not_disable_and_the_failure_is_recorded()
    {
        var subscription = WithRemoval(Now.AddMinutes(-5));
        Charge(ChargeOutcome.Authorised);
        _disabler.Setup(d => d.DisableAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ThrowsAsync(new InvalidOperationException("tenant cache down"));

        await Service().RenewAsync(subscription);

        Assert.Equal(300m + 24.30m, _written[0].Total);
        Assert.False(Assert.Single(subscription.RemovedEnvironments).Disabled);
    }

    [Fact]
    public async Task An_uncollected_renewal_says_when_it_failed_and_when_it_is_tried_next()
    {
        var subscription = WithRemoval(Now.AddDays(3));
        Charge(ChargeOutcome.Refused, "card_expired");

        await Service().RenewAsync(subscription);

        Assert.Equal(Now, _written[0].DeclinedAtUtc);
        Assert.Equal(subscription.NextChargeAtUtc, _written[0].NextRetryUtc);
    }

    // ── B7 retry ────────────────────────────────────────────────────────────

    private ProjectSubscription PastDue(decimal owed)
    {
        var subscription = new ProjectSubscription
        {
            TenantGroupId = Group,
            Market = "CHF",
            State = SubscriptionStates.PastDue,
            CarriedBalance = owed,
            FailedAttempts = 1,
            NextChargeAtUtc = Now.AddDays(20),
        };
        _subscriptions.Setup(s => s.GetAsync(Group, It.IsAny<CancellationToken>())).ReturnsAsync(subscription);
        return subscription;
    }

    [Fact]
    public async Task A_retry_collects_the_balance_and_settles_the_invoice()
    {
        var subscription = PastDue(400m);
        Charge(ChargeOutcome.Authorised);
        _invoices.Setup(i => i.FindLatestUnpaidAsync(Group, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new Invoice { ItemId = "inv_1", TenantGroupId = Group, State = InvoiceStates.Unpaid });

        var result = await Service().RetryPaymentAsync(Group);

        Assert.True(result.IsSuccess);
        Assert.Equal(SubscriptionStates.Active, result.State);
        Assert.Equal(0m, result.CarriedBalance);
        Assert.Equal(0m, subscription.CarriedBalance);
        Assert.Equal(0, subscription.FailedAttempts);
        Assert.Equal(432.40m, Assert.Single(_charges).Amount);
        _invoices.Verify(i => i.MarkPaidAsync(Group, "inv_1", "psp_9", Now, It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task A_declined_retry_keeps_the_debt()
    {
        var subscription = PastDue(400m);
        Charge(ChargeOutcome.Refused, "card_expired");

        var result = await Service().RetryPaymentAsync(Group);

        Assert.False(result.IsSuccess);
        Assert.Equal(BillingFailures.PaymentDeclined, result.Reason);
        Assert.Equal(400m, result.CarriedBalance);
        Assert.Equal(SubscriptionStates.PastDue, subscription.State);
        _invoices.Verify(i => i.MarkPaidAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<DateTime>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task A_retry_with_no_answer_changes_nothing()
    {
        var subscription = PastDue(400m);
        Charge(ChargeOutcome.Unknown, "timeout");

        var result = await Service().RetryPaymentAsync(Group);

        Assert.Equal(BillingFailures.PaymentPending, result.Reason);
        Assert.Equal(400m, subscription.CarriedBalance);
        _subscriptions.Verify(s => s.UpsertAsync(It.IsAny<ProjectSubscription>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task A_retry_with_no_card_does_not_call_the_provider()
    {
        PastDue(400m);
        _cards.Setup(c => c.GetDefaultChargeSecretAsync(Group, It.IsAny<CancellationToken>())).ReturnsAsync((CardSecret?)null);

        var result = await Service().RetryPaymentAsync(Group);

        Assert.Equal(BillingFailures.NoCard, result.Reason);
        _gateway.Verify(g => g.ChargeStoredCardAsync(It.IsAny<ChargeRequest>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task Nothing_owed_is_refused()
    {
        var active = new ProjectSubscription { TenantGroupId = Group, State = SubscriptionStates.Active };
        _subscriptions.Setup(s => s.GetAsync(Group, It.IsAny<CancellationToken>())).ReturnsAsync(active);

        var result = await Service().RetryPaymentAsync(Group);

        Assert.Equal(BillingFailures.NothingOwed, result.Reason);
        _gateway.Verify(g => g.ChargeStoredCardAsync(It.IsAny<ChargeRequest>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task No_subscription_owes_nothing()
    {
        var result = await Service().RetryPaymentAsync(Group);

        Assert.Equal(BillingFailures.NothingOwed, result.Reason);
    }

    // ── B3 apply ────────────────────────────────────────────────────────────

    [Fact]
    public async Task A_prorated_order_adds_the_full_price_to_the_subscription()
    {
        ProjectSubscription? saved = null;
        _subscriptions.Setup(s => s.UpsertAsync(It.IsAny<ProjectSubscription>(), It.IsAny<CancellationToken>()))
            .Callback<ProjectSubscription, CancellationToken>((s, _) => saved = s)
            .Returns(Task.CompletedTask);

        await Service().ApplyOrderAsync(new SubscriptionOrder
        {
            TenantGroupId = Group,
            Lines =
            [
                new OrderLine { Kind = "environment", Environment = "stg", Amount = 50m, RecurringAmount = 100m, Billing = "rent" },
                new OrderLine { Kind = "topup", Environment = "stg", Meter = "ai.agents", Amount = 15m, RecurringAmount = 30m, Billing = "rent" },
                new OrderLine { Kind = "topup", Environment = "stg", Meter = "api.calls", Amount = 20m, Billing = "once" },
            ],
        });

        Assert.Equal(130m, saved!.MonthlyBeforeTax);
    }

    [Fact]
    public async Task A_legacy_order_without_a_recurring_price_still_adds_its_amount()
    {
        ProjectSubscription? saved = null;
        _subscriptions.Setup(s => s.UpsertAsync(It.IsAny<ProjectSubscription>(), It.IsAny<CancellationToken>()))
            .Callback<ProjectSubscription, CancellationToken>((s, _) => saved = s)
            .Returns(Task.CompletedTask);

        await Service().ApplyOrderAsync(new SubscriptionOrder
        {
            TenantGroupId = Group,
            Lines = [new OrderLine { Kind = "environment", Environment = "prod", Amount = 300m, Billing = "rent" }],
        });

        Assert.Equal(300m, saved!.MonthlyBeforeTax);
    }

    [Fact]
    public void A_prorated_paid_line_is_never_read_as_the_free_tier()
    {
        Assert.False(ProvisioningStepRunner.IsFreeTier(new OrderLine { Kind = "environment", Amount = 0m, RecurringAmount = 50m }));
        Assert.True(ProvisioningStepRunner.IsFreeTier(new OrderLine { Kind = "environment", Amount = 0m, FreeTier = true, RecurringAmount = 0m }));
        // Written before the flag existed: zero was the only way to say free.
        Assert.True(ProvisioningStepRunner.IsFreeTier(new OrderLine { Kind = "environment", Amount = 0m }));
    }
}
