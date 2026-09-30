using DomainService.Billing.Entities;
using DomainService.Billing.Models;
using DomainService.Billing.Services;
using DomainService.Catalogue.Models;
using DomainService.Catalogue.Services;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using Xunit;

namespace XUnitTest.Billing;

/// <summary>
/// Checkout must not leave a row behind every time somebody changes their mind.
/// </summary>
public class CheckoutGrowthTests
{
    private const string Group = "grp_1";
    private const string User = "usr_1";

    private readonly Mock<ISubscriptionOrderStore> _orders = new();
    private readonly Mock<ICatalogueProvider> _catalogue = new();

    public CheckoutGrowthTests()
    {
        var catalogue = new PlanCatalogue
        {
            CatalogueVersion = "test",
            Environments = new Dictionary<string, EnvironmentDefinition>(StringComparer.Ordinal)
            {
                ["dev"] = new() { Label = "Development", Rank = 1 },
                ["prod"] = new() { Label = "Production", Rank = 7, TopUpUncapped = true },
            },
        };

        var prices = new PriceBook
        {
            Markets = ["CHF", "USD"],
            DefaultMarket = "CHF",
            Environments = new Dictionary<string, Dictionary<string, Dictionary<string, decimal>>>(StringComparer.Ordinal)
            {
                ["dev"] = new(StringComparer.Ordinal) { ["paid"] = new(StringComparer.Ordinal) { ["CHF"] = 50m } },
                ["prod"] = new(StringComparer.Ordinal) { ["paid"] = new(StringComparer.Ordinal) { ["CHF"] = 300m } },
            },
        };

        _catalogue.SetupGet(c => c.Catalogue).Returns(catalogue);
        _catalogue.SetupGet(c => c.PriceBook).Returns(prices);

        _orders
            .Setup(o => o.ClaimAsync(It.IsAny<SubscriptionOrder>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((SubscriptionOrder o, CancellationToken _) => new OrderClaim(true, o));
    }

    private CheckoutService Service() =>
        new(_orders.Object, _catalogue.Object, NullLogger<CheckoutService>.Instance);

    private static StartCheckoutRequest Request(params string[] environments) =>
        new() { TenantGroupId = Group, Environments = [.. environments], Market = "CHF" };

    [Fact]
    public async Task A_quote_writes_nothing()
    {
        var result = await Service().QuoteAsync(Request("prod"));

        Assert.True(result.IsSuccess);
        Assert.Equal(300m, result.Subtotal);
        // The whole point: someone clicking around the picker leaves no trace.
        _orders.Verify(o => o.ClaimAsync(It.IsAny<SubscriptionOrder>(), It.IsAny<CancellationToken>()), Times.Never);
        _orders.Verify(o => o.UpdateAsync(It.IsAny<SubscriptionOrder>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task A_quote_carries_no_order_or_key_to_pay_with()
    {
        var result = await Service().QuoteAsync(Request("prod"));

        Assert.Equal(string.Empty, result.OrderId);
        Assert.Equal(string.Empty, result.IdempotencyKey);
    }

    [Fact]
    public async Task Starting_writes_exactly_one_order()
    {
        var result = await Service().StartAsync(Request("prod"), User);

        Assert.NotEmpty(result.OrderId);
        Assert.NotEmpty(result.IdempotencyKey);
        _orders.Verify(o => o.ClaimAsync(It.IsAny<SubscriptionOrder>(), It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Changing_the_selection_reprices_the_same_order_rather_than_starting_another()
    {
        var service = Service();
        var first = await service.StartAsync(Request("prod"), User);

        var pending = new SubscriptionOrder
        {
            ItemId = first.OrderId,
            TenantGroupId = Group,
            IdempotencyKey = first.IdempotencyKey,
            State = OrderStates.Pending,
        };
        _orders.Setup(o => o.GetAsync(Group, first.OrderId, It.IsAny<CancellationToken>())).ReturnsAsync(pending);

        var second = Request("prod", "dev");
        second.OrderId = first.OrderId;
        var updated = await service.StartAsync(second, User);

        // One order, one key, whatever the picker did in between.
        Assert.Equal(first.OrderId, updated.OrderId);
        Assert.Equal(first.IdempotencyKey, updated.IdempotencyKey);
        Assert.Equal(350m, updated.Subtotal);
        _orders.Verify(o => o.ClaimAsync(It.IsAny<SubscriptionOrder>(), It.IsAny<CancellationToken>()), Times.Once);
        _orders.Verify(o => o.UpdateAsync(It.IsAny<SubscriptionOrder>(), It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task An_order_that_is_no_longer_pending_is_never_repriced()
    {
        var service = Service();
        var paid = new SubscriptionOrder
        {
            ItemId = "ord_paid",
            TenantGroupId = Group,
            IdempotencyKey = "key_paid",
            State = OrderStates.Paid,
        };
        _orders.Setup(o => o.GetAsync(Group, "ord_paid", It.IsAny<CancellationToken>())).ReturnsAsync(paid);

        var request = Request("dev");
        request.OrderId = "ord_paid";
        var result = await service.StartAsync(request, User);

        // Re-pricing something already charged would change what was bought after the fact.
        Assert.NotEqual("ord_paid", result.OrderId);
        _orders.Verify(o => o.UpdateAsync(It.IsAny<SubscriptionOrder>(), It.IsAny<CancellationToken>()), Times.Never);
        _orders.Verify(o => o.ClaimAsync(It.IsAny<SubscriptionOrder>(), It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task A_quote_and_the_order_it_becomes_agree_on_the_price()
    {
        var service = Service();
        var quoted = await service.QuoteAsync(Request("prod", "dev"));
        var started = await service.StartAsync(Request("prod", "dev"), User);

        Assert.Equal(quoted.Subtotal, started.Subtotal);
        Assert.Equal(quoted.Vat, started.Vat);
        Assert.Equal(quoted.Total, started.Total);
    }
}
