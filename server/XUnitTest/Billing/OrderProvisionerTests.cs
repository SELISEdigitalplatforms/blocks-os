using DomainService.Billing.Entities;
using DomainService.Billing.Models;
using DomainService.Billing.Services;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using Xunit;

namespace XUnitTest.Billing;

/// <summary>
/// Retry, never refund: five attempts per step, resume from where it stopped, and never a failure
/// the customer can see.
/// </summary>
public class OrderProvisionerTests
{
    private const string Group = "grp_1";
    private const string OrderId = "ord_1";

    private readonly Mock<ISubscriptionOrderStore> _orders = new();
    private readonly Mock<IProvisioningStepRunner> _steps = new();
    private readonly Mock<IOrderNotifier> _notifier = new();
    private readonly Mock<IRenewalService> _renewals = new();

    private static SubscriptionOrder Order(params string[] environments) => new()
    {
        ItemId = OrderId,
        TenantGroupId = Group,
        CreatedByUserId = "usr_1",
        State = OrderStates.Paid,
        Progress = [.. environments.Select(e => new OrderEnvironmentProgress { Environment = e, TenantId = "tnt_" + e })],
    };

    /// <summary>
    /// The real ladder spans twenty-one minutes, which is right in production and useless in a
    /// test. Zero gaps here; the schedule itself is asserted separately.
    /// </summary>
    private static readonly IReadOnlyList<TimeSpan> NoWaiting =
        [TimeSpan.Zero, TimeSpan.Zero, TimeSpan.Zero, TimeSpan.Zero];

    private OrderProvisioner Provisioner() =>
        new(
            _orders.Object,
            _steps.Object,
            _notifier.Object,
            _renewals.Object,
            NullLogger<OrderProvisioner>.Instance,
            null,
            NoWaiting);

    private void Given(SubscriptionOrder order) =>
        _orders.Setup(o => o.GetAsync(Group, OrderId, It.IsAny<CancellationToken>())).ReturnsAsync(order);

    private void StepsAlwaysSucceed() =>
        _steps
            .Setup(s => s.RunAsync(It.IsAny<SubscriptionOrder>(), It.IsAny<OrderEnvironmentProgress>(), It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(StepOutcome.Ok("tnt_x"));

    [Fact]
    public async Task Every_step_of_every_environment_runs_and_the_order_is_created()
    {
        var order = Order("dev", "prod");
        Given(order);
        StepsAlwaysSucceed();

        Assert.True(await Provisioner().RunAsync(Group, OrderId));

        Assert.Equal(OrderStates.Created, order.State);
        Assert.Equal(2 * ProvisioningSteps.All.Count, order.StepsDone);
        Assert.All(order.Progress, p => Assert.True(p.IsComplete));
        _steps.Verify(
            s => s.RunAsync(It.IsAny<SubscriptionOrder>(), It.IsAny<OrderEnvironmentProgress>(), It.IsAny<string>(), It.IsAny<CancellationToken>()),
            Times.Exactly(2 * ProvisioningSteps.All.Count));
    }

    [Fact]
    public async Task A_step_that_keeps_failing_stops_at_five_attempts_and_keeps_the_money()
    {
        var order = Order("dev");
        Given(order);

        _steps
            .Setup(s => s.RunAsync(It.IsAny<SubscriptionOrder>(), It.IsAny<OrderEnvironmentProgress>(), ProvisioningSteps.CreateTenant, It.IsAny<CancellationToken>()))
            .ReturnsAsync(StepOutcome.Failed("boom"));

        Assert.False(await Provisioner().RunAsync(Group, OrderId));

        // Flagged for a human, still paid, and emphatically not refunded or cancelled.
        Assert.True(order.NeedsAttention);
        Assert.Equal(OrderStates.Creating, order.State);
        Assert.NotEqual(OrderStates.Declined, order.State);
        _steps.Verify(
            s => s.RunAsync(It.IsAny<SubscriptionOrder>(), It.IsAny<OrderEnvironmentProgress>(), ProvisioningSteps.CreateTenant, It.IsAny<CancellationToken>()),
            Times.Exactly(CheckoutService.MaxAttempts));
    }

    [Fact]
    public async Task A_rerun_resumes_from_the_recorded_step_rather_than_starting_over()
    {
        var order = Order("dev");
        // Four of six already done by an earlier run that died.
        order.Progress[0].StepsDone = 4;
        order.State = OrderStates.Creating;
        Given(order);
        StepsAlwaysSucceed();

        await Provisioner().RunAsync(Group, OrderId);

        _steps.Verify(
            s => s.RunAsync(It.IsAny<SubscriptionOrder>(), It.IsAny<OrderEnvironmentProgress>(), It.IsAny<string>(), It.IsAny<CancellationToken>()),
            Times.Exactly(2));
        _steps.Verify(
            s => s.RunAsync(It.IsAny<SubscriptionOrder>(), It.IsAny<OrderEnvironmentProgress>(), ProvisioningSteps.CreateTenant, It.IsAny<CancellationToken>()),
            Times.Never);
    }

    [Fact]
    public async Task The_attempt_budget_belongs_to_the_step_not_the_environment()
    {
        var order = Order("dev");
        Given(order);

        var calls = 0;
        _steps
            .Setup(s => s.RunAsync(It.IsAny<SubscriptionOrder>(), It.IsAny<OrderEnvironmentProgress>(), It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(() =>
            {
                calls++;
                // Fail the first two attempts of the first step, then behave.
                return calls <= 2 ? StepOutcome.Failed("flaky") : StepOutcome.Ok("tnt_dev");
            });

        Assert.True(await Provisioner().RunAsync(Group, OrderId));

        // Two wasted attempts did not eat the budget of the five later steps.
        Assert.Equal(OrderStates.Created, order.State);
        Assert.Equal(ProvisioningSteps.All.Count, order.Progress[0].StepsDone);
    }

    [Fact]
    public async Task What_was_bought_joins_the_monthly_bill_only_once_it_exists()
    {
        var order = Order("dev");
        Given(order);
        StepsAlwaysSucceed();

        await Provisioner().RunAsync(Group, OrderId);

        _renewals.Verify(r => r.ApplyOrderAsync(order, It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task An_order_that_never_finished_does_not_start_charging_rent()
    {
        var order = Order("dev");
        Given(order);
        _steps
            .Setup(s => s.RunAsync(It.IsAny<SubscriptionOrder>(), It.IsAny<OrderEnvironmentProgress>(), It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(StepOutcome.Failed("boom"));

        await Provisioner().RunAsync(Group, OrderId);

        // Rent for environments nobody got would be the worst kind of billing bug.
        _renewals.Verify(
            r => r.ApplyOrderAsync(It.IsAny<SubscriptionOrder>(), It.IsAny<CancellationToken>()),
            Times.Never);
    }

    [Fact]
    public async Task A_terminal_order_is_not_provisioned_again()
    {
        var order = Order("dev");
        order.State = OrderStates.Created;
        Given(order);

        Assert.True(await Provisioner().RunAsync(Group, OrderId));

        _steps.Verify(
            s => s.RunAsync(It.IsAny<SubscriptionOrder>(), It.IsAny<OrderEnvironmentProgress>(), It.IsAny<string>(), It.IsAny<CancellationToken>()),
            Times.Never);
    }

    [Fact]
    public async Task An_unpaid_order_is_never_provisioned()
    {
        var order = Order("dev");
        order.State = OrderStates.Pending;
        Given(order);

        Assert.False(await Provisioner().RunAsync(Group, OrderId));

        _steps.Verify(
            s => s.RunAsync(It.IsAny<SubscriptionOrder>(), It.IsAny<OrderEnvironmentProgress>(), It.IsAny<string>(), It.IsAny<CancellationToken>()),
            Times.Never);
    }

    [Fact]
    public async Task Progress_is_pushed_per_step_and_the_outcome_once()
    {
        var order = Order("dev");
        Given(order);
        StepsAlwaysSucceed();

        await Provisioner().RunAsync(Group, OrderId);

        _notifier.Verify(
            n => n.PushProgressAsync("usr_1", It.IsAny<OrderView>(), It.IsAny<CancellationToken>()),
            Times.Exactly(ProvisioningSteps.All.Count));
        _notifier.Verify(
            n => n.PushStatusAsync("usr_1", It.IsAny<OrderView>(), It.IsAny<string>(), It.IsAny<CancellationToken>()),
            Times.Once);
    }

    [Fact]
    public void The_first_attempt_waits_for_nothing_and_later_ones_back_off_with_jitter()
    {
        Assert.Equal(TimeSpan.Zero, OrderProvisioner.DelayBefore(1));

        // Jitter is ±20%, so assert the band rather than an exact figure — and that it is applied
        // at all, since a fixed schedule makes every order retry in lockstep after an outage.
        for (var attempt = 2; attempt <= CheckoutService.MaxAttempts; attempt++)
        {
            var expected = OrderProvisioner.Backoff[Math.Min(attempt - 2, OrderProvisioner.Backoff.Count - 1)];
            var actual = OrderProvisioner.DelayBefore(attempt);

            Assert.InRange(actual, expected * 0.8, expected * 1.2);
        }
    }

    [Fact]
    public void The_customer_view_never_exposes_needs_attention()
    {
        var order = Order("dev");
        order.NeedsAttention = true;
        order.Progress[0].Attempt = CheckoutService.MaxAttempts;
        order.State = OrderStates.Creating;

        var view = CheckoutService.ToView(order);

        Assert.Equal(OrderStates.Creating, view.State);
        Assert.DoesNotContain("attention", System.Text.Json.JsonSerializer.Serialize(view), StringComparison.OrdinalIgnoreCase);
        Assert.Equal(CheckoutService.MaxAttempts, view.Attempt);
        Assert.Equal("retrying", view.Environments[0].Status);
    }

    [Fact]
    public void A_first_attempt_is_not_reported_as_a_retry()
    {
        var order = Order("dev");
        order.Progress[0].Attempt = 1;
        order.Progress[0].StartedAtUtc = DateTime.UtcNow;

        var view = CheckoutService.ToView(order);

        // "Attempt 1 of 5" would invent a problem where there is none.
        Assert.Equal(0, view.Attempt);
        Assert.Equal("building", view.Environments[0].Status);
    }
}
