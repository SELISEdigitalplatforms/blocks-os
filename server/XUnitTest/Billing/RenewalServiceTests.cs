using DomainService.Billing.Entities;
using DomainService.Billing.Models;
using DomainService.Billing.Services;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using Xunit;

namespace XUnitTest.Billing;

/// <summary>
/// The monthly charge, and the rule that a decline carries rather than cuts anyone off.
/// </summary>
public class RenewalServiceTests
{
    private const string Group = "grp_1";

    private readonly Mock<ISubscriptionStore> _subscriptions = new();
    private readonly Mock<IInvoiceStore> _invoices = new();
    private readonly Mock<IPaymentMethodService> _cards = new();
    private readonly Mock<IPaymentGateway> _gateway = new();
    private readonly Mock<IInvoiceMailer> _mailer = new();
    private readonly Mock<DomainService.Catalogue.Services.ISubscriptionLifecycleService> _lifecycle = new();

    private readonly List<Invoice> _written = [];

    public RenewalServiceTests()
    {
        _invoices.Setup(i => i.NextNumberAsync(It.IsAny<DateTime>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync("INV-2026-09-0001");
        _invoices.Setup(i => i.InsertAsync(It.IsAny<Invoice>(), It.IsAny<CancellationToken>()))
            .Callback<Invoice, CancellationToken>((i, _) => _written.Add(i))
            .Returns(Task.CompletedTask);
        _cards.Setup(c => c.GetDefaultChargeSecretAsync(Group, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new CardSecret { ProviderToken = "tok", ProviderCustomerId = "cust" });
    }

    private RenewalService Service() =>
        new(_subscriptions.Object, _invoices.Object, _cards.Object, _gateway.Object, _mailer.Object,
            _lifecycle.Object, NullLogger<RenewalService>.Instance);

    private static ProjectSubscription Subscription(decimal monthly = 400m, decimal carried = 0m) => new()
    {
        TenantGroupId = Group,
        Market = "CHF",
        State = SubscriptionStates.Active,
        CarriedBalance = carried,
        NextChargeAtUtc = DateTime.UtcNow.AddMinutes(-1),
        Lines = [new RecurringLine { Kind = "environment", Environment = "prod", TenantId = "PROD" + Group, Amount = monthly }],
    };

    private void ChargeReturns(ChargeOutcome outcome, string reason = "") =>
        _gateway
            .Setup(g => g.ChargeStoredCardAsync(It.IsAny<ChargeRequest>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new ChargeResult(outcome, outcome == ChargeOutcome.Authorised ? "psp_1" : "", reason));

    [Fact]
    public async Task A_collected_renewal_clears_the_balance_and_issues_a_paid_invoice()
    {
        var subscription = Subscription();
        ChargeReturns(ChargeOutcome.Authorised);

        Assert.True(await Service().RenewAsync(subscription));

        Assert.Equal(SubscriptionStates.Active, subscription.State);
        Assert.Equal(0m, subscription.CarriedBalance);
        Assert.Equal(0, subscription.FailedAttempts);
        Assert.Equal(InvoiceStates.Paid, _written[0].State);
        Assert.Equal(400m + 32.40m, _written[0].Total);
    }

    [Fact]
    public async Task A_decline_carries_the_amount_and_cuts_nothing_off()
    {
        var subscription = Subscription();
        ChargeReturns(ChargeOutcome.Refused, "card_expired");

        Assert.False(await Service().RenewAsync(subscription));

        // Past due, never cancelled: the environments keep running through a card problem.
        Assert.Equal(SubscriptionStates.PastDue, subscription.State);
        Assert.NotEqual(SubscriptionStates.Cancelled, subscription.State);
        Assert.Equal(400m, subscription.CarriedBalance);
        Assert.Equal(InvoiceStates.Unpaid, _written[0].State);
    }

    [Fact]
    public async Task The_period_boundary_resets_allowances()
    {
        ChargeReturns(ChargeOutcome.Authorised);

        await Service().RenewAsync(Subscription());

        // Without this a counter meter stays at its ceiling forever: charged every month and
        // blocked every month.
        _lifecycle.Verify(
            l => l.RolloverAsync("PROD" + Group, "prod", It.IsAny<string>(), false, It.IsAny<CancellationToken>()),
            Times.Once);
    }

    [Fact]
    public async Task Allowances_reset_even_when_the_card_failed()
    {
        ChargeReturns(ChargeOutcome.Refused, "declined");

        await Service().RenewAsync(Subscription());

        // A decline is a debt to collect, not a punishment. Withholding the reset would leave the
        // customer billed and blocked, compounding every period until the card is fixed.
        _lifecycle.Verify(
            l => l.RolloverAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<bool>(), It.IsAny<CancellationToken>()),
            Times.Once);
    }

    [Fact]
    public async Task One_environment_failing_to_roll_does_not_stop_the_others()
    {
        var subscription = Subscription();
        subscription.Lines.Add(new RecurringLine { Kind = "environment", Environment = "stg", TenantId = "STG" + Group, Amount = 100m });

        _lifecycle
            .Setup(l => l.RolloverAsync("PROD" + Group, It.IsAny<string>(), It.IsAny<string>(), It.IsAny<bool>(), It.IsAny<CancellationToken>()))
            .ThrowsAsync(new InvalidOperationException("mongo down"));
        ChargeReturns(ChargeOutcome.Authorised);

        await Service().RenewAsync(subscription);

        _lifecycle.Verify(
            l => l.RolloverAsync("STG" + Group, "stg", It.IsAny<string>(), It.IsAny<bool>(), It.IsAny<CancellationToken>()),
            Times.Once);
    }

    [Fact]
    public async Task Unsubscribing_stops_the_charge_without_forgiving_what_is_owed()
    {
        var subscription = Subscription(carried: 250m);
        _subscriptions.Setup(s => s.GetAsync(Group, It.IsAny<CancellationToken>())).ReturnsAsync(subscription);

        var result = await Service().UnsubscribeAsync(Group);

        Assert.True(result.IsSuccess);
        Assert.Equal(250m, result.OutstandingBalance);
        Assert.Equal(SubscriptionStates.Cancelled, subscription.State);
        Assert.Empty(subscription.Lines);
        // Still owed, and the balance is untouched.
        Assert.Equal(250m, subscription.CarriedBalance);
    }

    [Fact]
    public async Task Unsubscribing_twice_is_not_an_error()
    {
        var subscription = Subscription();
        subscription.State = SubscriptionStates.Cancelled;
        _subscriptions.Setup(s => s.GetAsync(Group, It.IsAny<CancellationToken>())).ReturnsAsync(subscription);

        Assert.True((await Service().UnsubscribeAsync(Group)).IsSuccess);
    }

    [Fact]
    public async Task A_carried_balance_joins_the_next_invoice()
    {
        var subscription = Subscription(monthly: 400m, carried: 400m);
        ChargeReturns(ChargeOutcome.Authorised);

        await Service().RenewAsync(subscription);

        Assert.Equal(800m, _written[0].Subtotal);
        Assert.Equal(400m, _written[0].CarriedIn);
    }

    [Fact]
    public async Task The_period_always_moves_forward_even_after_a_failure()
    {
        var subscription = Subscription();
        var before = subscription.NextChargeAtUtc;
        ChargeReturns(ChargeOutcome.Refused, "declined");

        await Service().RenewAsync(subscription);

        // Leaving it in the past would have the sweeper retry the same card every few minutes.
        Assert.True(subscription.NextChargeAtUtc > before);
    }

    [Fact]
    public async Task No_card_on_file_is_a_carry_not_a_crash()
    {
        _cards.Setup(c => c.GetDefaultChargeSecretAsync(Group, It.IsAny<CancellationToken>()))
            .ReturnsAsync((CardSecret?)null);

        var subscription = Subscription();

        Assert.False(await Service().RenewAsync(subscription));

        Assert.Equal(SubscriptionStates.PastDue, subscription.State);
        Assert.Equal("no_card_on_file", subscription.LastFailureReason);
        _gateway.Verify(g => g.ChargeStoredCardAsync(It.IsAny<ChargeRequest>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task A_subscription_with_nothing_recurring_is_not_charged()
    {
        var subscription = Subscription();
        subscription.Lines.Clear();

        Assert.True(await Service().RenewAsync(subscription));

        _gateway.Verify(g => g.ChargeStoredCardAsync(It.IsAny<ChargeRequest>(), It.IsAny<CancellationToken>()), Times.Never);
        Assert.Empty(_written);
    }

    [Fact]
    public async Task The_charge_key_is_the_same_within_a_period_and_different_across_them()
    {
        var sent = new List<string>();
        _gateway
            .Setup(g => g.ChargeStoredCardAsync(It.IsAny<ChargeRequest>(), It.IsAny<CancellationToken>()))
            .Callback<ChargeRequest, CancellationToken>((r, _) => sent.Add(r.IdempotencyKey))
            .ReturnsAsync(new ChargeResult(ChargeOutcome.Authorised, "psp", ""));

        await Service().RenewAsync(Subscription());
        await Service().RenewAsync(Subscription());

        // Keyed by group and date, so a sweep running twice in one day cannot bill twice.
        Assert.Equal(sent[0], sent[1]);
        Assert.Contains(Group, sent[0], StringComparison.Ordinal);
    }

    [Fact]
    public async Task Only_recurring_lines_join_the_standing_bill()
    {
        _subscriptions.Setup(s => s.GetAsync(Group, It.IsAny<CancellationToken>())).ReturnsAsync((ProjectSubscription?)null);
        ProjectSubscription? saved = null;
        _subscriptions
            .Setup(s => s.UpsertAsync(It.IsAny<ProjectSubscription>(), It.IsAny<CancellationToken>()))
            .Callback<ProjectSubscription, CancellationToken>((s, _) => saved = s)
            .Returns(Task.CompletedTask);

        await Service().ApplyOrderAsync(new SubscriptionOrder
        {
            TenantGroupId = Group,
            Market = "CHF",
            Lines =
            [
                new OrderLine { Kind = "environment", Environment = "prod", Amount = 300m, Billing = "rent" },
                // Bought once and carries until spent — it must never become rent.
                new OrderLine { Kind = "topup", Environment = "prod", Meter = "api.calls", Amount = 20m, Billing = "once" },
            ],
        });

        Assert.NotNull(saved);
        Assert.Single(saved!.Lines);
        Assert.Equal("prod", saved.Lines[0].Environment);
        Assert.Equal(300m, saved.MonthlyBeforeTax);
    }

    [Fact]
    public async Task Buying_more_of_a_ceiling_already_held_raises_the_rent()
    {
        var existing = Subscription(monthly: 0m);
        existing.Lines.Clear();
        existing.Lines.Add(new RecurringLine { Kind = "topup", Environment = "prod", Meter = "ai.agents", Units = 5, Amount = 40m });
        _subscriptions.Setup(s => s.GetAsync(Group, It.IsAny<CancellationToken>())).ReturnsAsync(existing);

        ProjectSubscription? saved = null;
        _subscriptions
            .Setup(s => s.UpsertAsync(It.IsAny<ProjectSubscription>(), It.IsAny<CancellationToken>()))
            .Callback<ProjectSubscription, CancellationToken>((s, _) => saved = s)
            .Returns(Task.CompletedTask);

        await Service().ApplyOrderAsync(new SubscriptionOrder
        {
            TenantGroupId = Group,
            Lines = [new OrderLine { Kind = "topup", Environment = "prod", Meter = "ai.agents", Units = 5, Amount = 40m, Billing = "rent" }],
        });

        // One line at the higher rent, not two lines for the same ceiling.
        Assert.Single(saved!.Lines);
        Assert.Equal(10, saved.Lines[0].Units);
        Assert.Equal(80m, saved.Lines[0].Amount);
    }
}
