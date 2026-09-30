using System.Security.Cryptography;
using System.Text;
using DomainService.Billing.Entities;
using DomainService.Billing.Models;
using DomainService.Billing.Services;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using Xunit;

namespace XUnitTest.Billing;

/// <summary>
/// The notification endpoint is unauthenticated, so the signature is the only thing separating a
/// real payment event from anyone who can reach the URL.
/// </summary>
public class AdyenNotificationVerifierTests
{
    // Any valid hex key; the value is irrelevant, only that both sides use the same one.
    private const string Key = "A1B2C3D4E5F60718293A4B5C6D7E8F90A1B2C3D4E5F60718293A4B5C6D7E8F90";

    private readonly AdyenNotificationVerifier _verifier = new();

    private static AdyenNotificationItem Item() => new()
    {
        PspReference = "psp_1",
        OriginalReference = "",
        MerchantAccountCode = "BlocksCOM",
        MerchantReference = "ord_1",
        AmountValue = 103240,
        AmountCurrency = "CHF",
        EventCode = AdyenEventCodes.Authorisation,
        Success = true,
    };

    private static string Sign(AdyenNotificationItem item)
    {
        static string Escape(string v) =>
            v.Replace("\\", "\\\\", StringComparison.Ordinal).Replace(":", "\\:", StringComparison.Ordinal);

        var payload = string.Join(':', new[]
        {
            item.PspReference, item.OriginalReference, item.MerchantAccountCode, item.MerchantReference,
            item.AmountValue.ToString(), item.AmountCurrency, item.EventCode, item.Success ? "true" : "false",
        }.Select(Escape));

        using var hmac = new HMACSHA256(Convert.FromHexString(Key));
        return Convert.ToBase64String(hmac.ComputeHash(Encoding.UTF8.GetBytes(payload)));
    }

    [Fact]
    public void A_correctly_signed_item_is_accepted()
    {
        var item = Item();
        item.HmacSignature = Sign(item);

        Assert.True(_verifier.IsAuthentic(item, Key));
    }

    [Fact]
    public void An_item_whose_amount_was_altered_in_flight_is_rejected()
    {
        var item = Item();
        item.HmacSignature = Sign(item);
        item.AmountValue = 1;

        Assert.False(_verifier.IsAuthentic(item, Key));
    }

    [Fact]
    public void An_item_naming_a_different_order_is_rejected()
    {
        var item = Item();
        item.HmacSignature = Sign(item);
        item.MerchantReference = "ord_somebody_elses";

        Assert.False(_verifier.IsAuthentic(item, Key));
    }

    [Fact]
    public void A_refusal_cannot_be_replayed_as_a_success()
    {
        var item = Item();
        item.Success = false;
        item.HmacSignature = Sign(item);
        item.Success = true;

        Assert.False(_verifier.IsAuthentic(item, Key));
    }

    [Theory]
    [InlineData("")]
    [InlineData("not-hex")]
    public void A_missing_or_malformed_key_verifies_nothing(string key)
    {
        var item = Item();
        item.HmacSignature = Sign(item);

        Assert.False(_verifier.IsAuthentic(item, key));
    }

    [Fact]
    public void An_unsigned_item_is_rejected()
    {
        Assert.False(_verifier.IsAuthentic(Item(), Key));
    }

    [Fact]
    public void A_colon_in_a_field_cannot_shift_the_signed_fields()
    {
        // Without escaping, a reference containing a colon would move every later field along and
        // let two different notifications sign identically.
        var honest = Item();
        honest.MerchantReference = "ord_1:CHF";
        honest.HmacSignature = Sign(honest);

        var forged = Item();
        forged.MerchantReference = "ord_1";
        forged.HmacSignature = honest.HmacSignature;

        Assert.True(_verifier.IsAuthentic(honest, Key));
        Assert.False(_verifier.IsAuthentic(forged, Key));
    }
}

/// <summary>
/// The provider's notification is the authority on whether money moved — it resolves the orders
/// our own call could not.
/// </summary>
public class AdyenNotificationServiceTests
{
    private const string Group = "grp_1";

    private readonly Mock<ISubscriptionOrderStore> _orders = new();
    private readonly Mock<IPaymentMethodService> _cards = new();
    private readonly Mock<IProvisioningQueue> _queue = new();
    private readonly Mock<IProcessedNotificationStore> _processed = new();

    public AdyenNotificationServiceTests()
    {
        _processed
            .Setup(p => p.TryClaimAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(true);
    }

    private AdyenNotificationService Service() =>
        new(_orders.Object, _cards.Object, _queue.Object, _processed.Object,
            NullLogger<AdyenNotificationService>.Instance);

    private static SubscriptionOrder Pending() => new()
    {
        ItemId = "ord_1",
        TenantGroupId = Group,
        State = OrderStates.Pending,
        Progress = [new OrderEnvironmentProgress { Environment = "dev" }],
    };

    private static AdyenNotificationItem Authorisation(bool success) => new()
    {
        EventCode = AdyenEventCodes.Authorisation,
        PspReference = "psp_1",
        MerchantReference = "ord_1",
        Success = success,
        Reason = success ? "" : "card_declined",
    };

    [Fact]
    public async Task A_success_resolves_an_order_our_own_call_left_pending()
    {
        var order = Pending();
        _orders.Setup(o => o.FindByReferenceAsync("ord_1", It.IsAny<CancellationToken>())).ReturnsAsync(order);

        await Service().HandleAsync([Authorisation(true)]);

        // This is the timeout case from issue 3 finally getting its answer.
        Assert.Equal(OrderStates.Paid, order.State);
        Assert.Equal("psp_1", order.ProviderReference);
        _queue.Verify(q => q.EnqueueAsync(Group, "ord_1", It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task A_refusal_declines_the_order_and_queues_nothing()
    {
        var order = Pending();
        _orders.Setup(o => o.FindByReferenceAsync("ord_1", It.IsAny<CancellationToken>())).ReturnsAsync(order);

        await Service().HandleAsync([Authorisation(false)]);

        Assert.Equal(OrderStates.Declined, order.State);
        Assert.Equal("card_declined", order.DeclineReason);
        _queue.Verify(q => q.EnqueueAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task An_order_already_settled_by_our_own_call_is_left_alone()
    {
        var order = Pending();
        order.State = OrderStates.Creating;
        _orders.Setup(o => o.FindByReferenceAsync("ord_1", It.IsAny<CancellationToken>())).ReturnsAsync(order);

        await Service().HandleAsync([Authorisation(true)]);

        Assert.Equal(OrderStates.Creating, order.State);
        _queue.Verify(q => q.EnqueueAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task A_redelivered_event_does_nothing_at_all()
    {
        _processed
            .Setup(p => p.TryClaimAsync("psp_1", It.IsAny<CancellationToken>()))
            .ReturnsAsync(false);

        await Service().HandleAsync([Authorisation(true)]);

        _orders.Verify(o => o.FindByReferenceAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task A_stored_card_notification_is_what_files_a_card()
    {
        _cards
            .Setup(c => c.AttachAsync(Group, It.IsAny<string>(), It.IsAny<AttachPaymentMethodRequest>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(PaymentMethodResult.Success("pm_1"));

        await Service().HandleAsync(
        [
            new AdyenNotificationItem
            {
                EventCode = AdyenEventCodes.RecurringContract,
                PspReference = "psp_2",
                Success = true,
                AdditionalData = new Dictionary<string, string>(StringComparer.Ordinal)
                {
                    ["shopperReference"] = Group,
                    ["recurring.recurringDetailReference"] = "tok_live",
                    ["cardSummary"] = "4242",
                    ["paymentMethod"] = "visa",
                    ["expiryDate"] = "04/2029",
                },
            },
        ]);

        _cards.Verify(
            c => c.AttachAsync(
                Group,
                It.IsAny<string>(),
                It.Is<AttachPaymentMethodRequest>(r =>
                    r.ProviderToken == "tok_live"
                    && r.LastFour == "4242"
                    && r.ExpiryMonth == 4
                    && r.ExpiryYear == 2029),
                It.IsAny<CancellationToken>()),
            Times.Once);
    }

    [Fact]
    public async Task A_transient_failure_releases_the_claim_so_the_retry_can_work()
    {
        _orders
            .Setup(o => o.FindByReferenceAsync("ord_1", It.IsAny<CancellationToken>()))
            .ThrowsAsync(new InvalidOperationException("mongo down"));

        await Service().HandleAsync([Authorisation(true)]);

        // Keeping the claim would make one blip permanently lose a payment confirmation.
        _processed.Verify(p => p.ReleaseAsync("psp_1", It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task A_notification_for_an_unknown_order_is_ignored_rather_than_throwing()
    {
        _orders
            .Setup(o => o.FindByReferenceAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((SubscriptionOrder?)null);

        await Service().HandleAsync([Authorisation(true)]);

        _processed.Verify(p => p.ReleaseAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Never);
    }
}
