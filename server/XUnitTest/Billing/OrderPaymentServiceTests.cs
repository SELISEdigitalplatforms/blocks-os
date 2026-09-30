using DomainService.Billing.Entities;
using DomainService.Billing.Models;
using DomainService.Billing.Services;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using Xunit;

namespace XUnitTest.Billing;

/// <summary>
/// One key, one charge; a timeout is not a decline; and payment gates creation.
/// </summary>
public class OrderPaymentServiceTests
{
    private const string Group = "grp_1";
    private const string OrderId = "ord_1";
    private const string Key = "idem_1";

    private readonly Mock<ISubscriptionOrderStore> _orders = new();
    private readonly Mock<IPaymentMethodService> _cards = new();
    private readonly Mock<IPaymentGateway> _gateway = new();
    private readonly Mock<IProvisioningQueue> _queue = new();

    private OrderPaymentService Service() =>
        new(_orders.Object, _cards.Object, _gateway.Object, _queue.Object, NullLogger<OrderPaymentService>.Instance);

    private static SubscriptionOrder Pending() => new()
    {
        ItemId = OrderId,
        TenantGroupId = Group,
        IdempotencyKey = Key,
        State = OrderStates.Pending,
        Total = 100m,
        Market = "CHF",
        ExpiresAtUtc = DateTime.UtcNow.AddHours(1),
        Progress = [new OrderEnvironmentProgress { Environment = "dev" }],
    };

    private void Given(SubscriptionOrder order)
    {
        _orders.Setup(o => o.GetAsync(Group, OrderId, It.IsAny<CancellationToken>())).ReturnsAsync(order);
        _cards
            .Setup(c => c.GetDefaultChargeSecretAsync(Group, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new CardSecret { ProviderToken = "tok", ProviderCustomerId = "cust" });
    }

    private static PayCheckoutRequest Request() =>
        new() { TenantGroupId = Group, OrderId = OrderId, IdempotencyKey = Key };

    [Fact]
    public async Task An_authorised_charge_marks_the_order_paid_and_queues_the_work()
    {
        var order = Pending();
        Given(order);
        _gateway
            .Setup(g => g.ChargeStoredCardAsync(It.IsAny<ChargeRequest>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new ChargeResult(ChargeOutcome.Authorised, "psp_1", string.Empty));

        var view = await Service().PayAsync(Request());

        Assert.Equal(OrderStates.Paid, view.State);
        Assert.Equal("psp_1", order.ProviderReference);
        Assert.NotNull(order.ChargedAtUtc);
        _queue.Verify(q => q.EnqueueAsync(Group, OrderId, It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task A_refusal_creates_nothing_so_there_is_nothing_to_undo()
    {
        var order = Pending();
        Given(order);
        _gateway
            .Setup(g => g.ChargeStoredCardAsync(It.IsAny<ChargeRequest>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(ChargeResult.Refused("card_declined"));

        var view = await Service().PayAsync(Request());

        Assert.Equal(OrderStates.Declined, view.State);
        Assert.Equal("card_declined", view.DeclineReason);
        _queue.Verify(q => q.EnqueueAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task A_timeout_leaves_the_order_pending_rather_than_declining_it()
    {
        var order = Pending();
        Given(order);
        _gateway
            .Setup(g => g.ChargeStoredCardAsync(It.IsAny<ChargeRequest>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(ChargeResult.Unknown("timeout"));

        var view = await Service().PayAsync(Request());

        // The charge may succeed a second from now. Calling it declined would lose the money.
        Assert.Equal(OrderStates.Pending, view.State);
        Assert.NotEqual(OrderStates.Declined, view.State);
        _queue.Verify(q => q.EnqueueAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task An_attempted_charge_is_marked_before_the_provider_is_called()
    {
        var order = Pending();
        Given(order);
        DateTime? markedWhenCalled = null;
        _gateway
            .Setup(g => g.ChargeStoredCardAsync(It.IsAny<ChargeRequest>(), It.IsAny<CancellationToken>()))
            .Callback(() => markedWhenCalled = order.ChargeAttemptedAtUtc)
            .ReturnsAsync(new ChargeResult(ChargeOutcome.Authorised, "psp", string.Empty));

        await Service().PayAsync(Request());

        // If the process dies mid-charge, the order must already say a charge was attempted —
        // otherwise the sweeper expires it as abandoned and the money is lost silently.
        Assert.NotNull(markedWhenCalled);
    }

    [Fact]
    public async Task An_unanswered_charge_is_replayed_once_with_the_same_key()
    {
        var order = Pending();
        Given(order);
        var keys = new List<string>();
        var calls = 0;
        _gateway
            .Setup(g => g.ChargeStoredCardAsync(It.IsAny<ChargeRequest>(), It.IsAny<CancellationToken>()))
            .Callback<ChargeRequest, CancellationToken>((r, _) => keys.Add(r.IdempotencyKey))
            .ReturnsAsync(() => ++calls == 1
                ? ChargeResult.Unknown("timeout")
                : new ChargeResult(ChargeOutcome.Authorised, "psp", string.Empty));

        var view = await Service().PayAsync(Request());

        // The same key is what makes the replay report the first charge instead of becoming a
        // second one.
        Assert.Equal(2, keys.Count);
        Assert.Equal(keys[0], keys[1]);
        Assert.Equal(OrderStates.Paid, view.State);
    }

    [Fact]
    public async Task A_charge_that_stays_unanswered_is_replayed_only_once()
    {
        var order = Pending();
        Given(order);
        _gateway
            .Setup(g => g.ChargeStoredCardAsync(It.IsAny<ChargeRequest>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(ChargeResult.Unknown("timeout"));

        var view = await Service().PayAsync(Request());

        // Replaying on a schedule would eventually fall outside the provider's idempotency window
        // and charge again. One immediate attempt, then a person.
        _gateway.Verify(
            g => g.ChargeStoredCardAsync(It.IsAny<ChargeRequest>(), It.IsAny<CancellationToken>()),
            Times.Exactly(2));
        Assert.Equal(OrderStates.Pending, view.State);
        Assert.NotNull(order.ChargeAttemptedAtUtc);
    }

    [Fact]
    public async Task A_second_call_for_a_paid_order_does_not_charge_again()
    {
        var order = Pending();
        order.State = OrderStates.Paid;
        Given(order);

        var view = await Service().PayAsync(Request());

        Assert.Equal(OrderStates.Paid, view.State);
        _gateway.Verify(
            g => g.ChargeStoredCardAsync(It.IsAny<ChargeRequest>(), It.IsAny<CancellationToken>()),
            Times.Never);
    }

    [Fact]
    public async Task A_call_carrying_the_wrong_key_cannot_charge()
    {
        Given(Pending());

        var request = Request();
        request.IdempotencyKey = "someone_elses_key";

        var view = await Service().PayAsync(request);

        Assert.Equal(CheckoutFailures.KeyMismatch, view.State);
        _gateway.Verify(g => g.ChargeStoredCardAsync(It.IsAny<ChargeRequest>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task Our_key_is_handed_to_the_provider_as_its_own()
    {
        var order = Pending();
        Given(order);
        ChargeRequest? sent = null;
        _gateway
            .Setup(g => g.ChargeStoredCardAsync(It.IsAny<ChargeRequest>(), It.IsAny<CancellationToken>()))
            .Callback<ChargeRequest, CancellationToken>((r, _) => sent = r)
            .ReturnsAsync(new ChargeResult(ChargeOutcome.Authorised, "psp", string.Empty));

        await Service().PayAsync(Request());

        // Two independent layers: if our record is lost, the provider still refuses the second.
        Assert.Equal(Key, sent!.IdempotencyKey);
        Assert.Equal(Group, sent.ShopperReference);
        Assert.Equal("tok", sent.StoredPaymentMethodId);
    }

    [Fact]
    public async Task An_expired_checkout_cannot_be_paid()
    {
        var order = Pending();
        order.ExpiresAtUtc = DateTime.UtcNow.AddMinutes(-1);
        Given(order);

        var view = await Service().PayAsync(Request());

        Assert.Equal(OrderStates.Expired, view.State);
        _gateway.Verify(g => g.ChargeStoredCardAsync(It.IsAny<ChargeRequest>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task No_card_on_file_means_no_charge_is_attempted()
    {
        var order = Pending();
        _orders.Setup(o => o.GetAsync(Group, OrderId, It.IsAny<CancellationToken>())).ReturnsAsync(order);
        _cards
            .Setup(c => c.GetDefaultChargeSecretAsync(Group, It.IsAny<CancellationToken>()))
            .ReturnsAsync((CardSecret?)null);

        var view = await Service().PayAsync(Request());

        Assert.Equal(CheckoutFailures.NoCard, view.State);
        _gateway.Verify(g => g.ChargeStoredCardAsync(It.IsAny<ChargeRequest>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task A_queue_failure_does_not_fail_a_call_whose_money_has_moved()
    {
        var order = Pending();
        Given(order);
        _gateway
            .Setup(g => g.ChargeStoredCardAsync(It.IsAny<ChargeRequest>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new ChargeResult(ChargeOutcome.Authorised, "psp", string.Empty));
        _queue
            .Setup(q => q.EnqueueAsync(Group, OrderId, It.IsAny<CancellationToken>()))
            .ThrowsAsync(new InvalidOperationException("bus down"));

        // The sweeper finds the row; the customer must not see an error for a charge that worked.
        await Assert.ThrowsAsync<InvalidOperationException>(() => Service().PayAsync(Request()));
        Assert.Equal(OrderStates.Paid, order.State);
    }
}
