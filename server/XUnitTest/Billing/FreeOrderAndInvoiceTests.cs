using BlocksOs.Api.Controllers;
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
/// A free order is paid without a card or the provider; a paid one gets its invoice; Pay says
/// plainly when it did not go through.
/// </summary>
public class FreeOrderAndInvoiceTests
{
    private const string Group = "grp_1";
    private const string OrderId = "ord_1";
    private const string Key = "idem_1";

    private readonly Mock<ISubscriptionOrderStore> _orders = new();
    private readonly Mock<IPaymentMethodService> _cards = new();
    private readonly Mock<IPaymentGateway> _gateway = new();
    private readonly Mock<IProvisioningQueue> _queue = new();
    private readonly Mock<IProjectInventory> _inventory = new();
    private readonly Mock<IOrderInvoiceWriter> _invoiceWriter = new();
    private ProjectInventorySnapshot _held = new();

    public FreeOrderAndInvoiceTests()
    {
        _inventory
            .Setup(i => i.GetAsync(Group, It.IsAny<string?>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(() => _held);
    }

    private OrderPaymentService Service() =>
        new(_orders.Object, _cards.Object, _gateway.Object, _queue.Object, NullLogger<OrderPaymentService>.Instance,
            null, _inventory.Object, _invoiceWriter.Object);

    private SubscriptionOrder Given(decimal total, bool free = false)
    {
        var order = new SubscriptionOrder
        {
            ItemId = OrderId,
            TenantGroupId = Group,
            IdempotencyKey = Key,
            State = OrderStates.Pending,
            Total = total,
            Subtotal = total,
            Market = "CHF",
            ExpiresAtUtc = DateTime.UtcNow.AddHours(1),
            Lines = [new OrderLine { Kind = "environment", Environment = "dev", Amount = total, FreeTier = free, Billing = "rent" }],
            Progress = [new OrderEnvironmentProgress { Environment = "dev" }],
        };
        _orders.Setup(o => o.GetAsync(Group, OrderId, It.IsAny<CancellationToken>())).ReturnsAsync(order);
        return order;
    }

    private static PayCheckoutRequest Request() => new() { TenantGroupId = Group, OrderId = OrderId, IdempotencyKey = Key };

    [Fact]
    public async Task A_free_order_is_paid_without_a_card_or_the_provider_and_is_provisioned()
    {
        var order = Given(0m, free: true);

        var view = await Service().PayAsync(Request());

        Assert.Equal(OrderStates.Paid, view.State);
        Assert.NotNull(order.ChargedAtUtc);
        _cards.Verify(c => c.GetDefaultChargeSecretAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Never);
        _gateway.Verify(g => g.ChargeStoredCardAsync(It.IsAny<ChargeRequest>(), It.IsAny<CancellationToken>()), Times.Never);
        _queue.Verify(q => q.EnqueueAsync(Group, OrderId, It.IsAny<CancellationToken>()), Times.Once);
        // Nothing charged, nothing billed.
        _invoiceWriter.Verify(w => w.WriteAsync(It.IsAny<SubscriptionOrder>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task A_paid_order_gets_its_invoice()
    {
        Given(54.05m);
        _cards.Setup(c => c.GetDefaultChargeSecretAsync(Group, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new CardSecret { ProviderToken = "tok" });
        _gateway.Setup(g => g.ChargeStoredCardAsync(It.IsAny<ChargeRequest>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new ChargeResult(ChargeOutcome.Authorised, "psp_1", string.Empty));

        var view = await Service().PayAsync(Request());

        Assert.Equal(OrderStates.Paid, view.State);
        _invoiceWriter.Verify(w => w.WriteAsync(It.Is<SubscriptionOrder>(o => o.ItemId == OrderId), It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task A_declined_order_gets_no_invoice()
    {
        Given(54.05m);
        _cards.Setup(c => c.GetDefaultChargeSecretAsync(Group, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new CardSecret { ProviderToken = "tok" });
        _gateway.Setup(g => g.ChargeStoredCardAsync(It.IsAny<ChargeRequest>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(ChargeResult.Refused("card_declined"));

        await Service().PayAsync(Request());

        _invoiceWriter.Verify(w => w.WriteAsync(It.IsAny<SubscriptionOrder>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task Paying_for_an_environment_another_order_got_first_is_refused_before_charging()
    {
        Given(54.05m);
        _held.InFlight.Add("dev");

        var view = await Service().PayAsync(Request());

        Assert.Equal(CheckoutFailures.EnvironmentExists, view.State);
        _gateway.Verify(g => g.ChargeStoredCardAsync(It.IsAny<ChargeRequest>(), It.IsAny<CancellationToken>()), Times.Never);
        _queue.Verify(q => q.EnqueueAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task A_free_order_is_refused_once_the_free_tier_is_taken()
    {
        Given(0m, free: true);
        _held.FreeCount["dev"] = 1;

        var view = await Service().PayAsync(Request());

        Assert.Equal(CheckoutFailures.FreeTierTaken, view.State);
        _queue.Verify(q => q.EnqueueAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    // ── B8 Pay failures ─────────────────────────────────────────────────────

    [Theory]
    [InlineData(CheckoutFailures.NoCard, CheckoutFailures.NoCard)]
    [InlineData(CheckoutFailures.KeyMismatch, CheckoutFailures.KeyMismatch)]
    [InlineData(OrderStates.Declined, CheckoutFailures.Declined)]
    [InlineData(OrderStates.Expired, CheckoutFailures.OrderExpired)]
    [InlineData(OrderStates.Pending, null)]
    [InlineData(OrderStates.Paid, null)]
    [InlineData(OrderStates.Creating, null)]
    [InlineData(OrderStates.Created, null)]
    public void Pay_reports_a_failure_only_when_the_payment_did_not_go_through(string state, string? expected)
    {
        Assert.Equal(expected, CheckoutController.PayFailure(new OrderView { State = state }));
    }

    [Fact]
    public async Task The_pay_endpoint_answers_false_with_the_reason_and_keeps_it_in_the_state()
    {
        var payments = new Mock<IOrderPaymentService>();
        payments.Setup(p => p.PayAsync(It.IsAny<PayCheckoutRequest>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new OrderView { State = CheckoutFailures.NoCard });
        var access = new Mock<DomainService.Access.Services.IProjectAccessService>();
        var controller = new CheckoutController(new Mock<ICheckoutService>().Object, payments.Object, access.Object);

        var response = await controller.Pay(Request(), CancellationToken.None);

        Assert.False(response.IsSuccess);
        Assert.Equal(CheckoutFailures.NoCard, response.Errors!["checkout"]);
        Assert.Equal(CheckoutFailures.NoCard, response.Order!.State);
    }

    [Fact]
    public async Task The_pay_endpoint_answers_true_while_the_order_proceeds()
    {
        var payments = new Mock<IOrderPaymentService>();
        payments.Setup(p => p.PayAsync(It.IsAny<PayCheckoutRequest>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new OrderView { OrderId = OrderId, State = OrderStates.Paid });
        var controller = new CheckoutController(
            new Mock<ICheckoutService>().Object, payments.Object, new Mock<DomainService.Access.Services.IProjectAccessService>().Object);

        var response = await controller.Pay(Request(), CancellationToken.None);

        Assert.True(response.IsSuccess);
    }

    [Fact]
    public async Task The_quote_endpoint_prices_a_new_project_without_resolving_access()
    {
        var checkout = new Mock<ICheckoutService>();
        checkout.Setup(c => c.QuoteAsync(It.IsAny<StartCheckoutRequest>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new StartCheckoutResult { Total = 0m });
        var access = new Mock<DomainService.Access.Services.IProjectAccessService>();
        var controller = new CheckoutController(checkout.Object, new Mock<IOrderPaymentService>().Object, access.Object);

        var response = await controller.Quote(new StartCheckoutRequest { Environments = ["dev"], FreeTier = true }, CancellationToken.None);

        Assert.True(response.IsSuccess);
        access.Verify(a => a.ResolveAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task The_start_endpoint_still_needs_a_project()
    {
        var checkout = new Mock<ICheckoutService>();
        var controller = new CheckoutController(
            checkout.Object, new Mock<IOrderPaymentService>().Object, new Mock<DomainService.Access.Services.IProjectAccessService>().Object);

        var response = await controller.Start(new StartCheckoutRequest { Environments = ["dev"] }, CancellationToken.None);

        Assert.False(response.IsSuccess);
        Assert.True(response.Errors!.ContainsKey("TenantGroupId"));
        checkout.Verify(c => c.StartAsync(It.IsAny<StartCheckoutRequest>(), It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Never);
    }
}

/// <summary>B5: the invoice a paid order leaves behind.</summary>
public class OrderInvoiceWriterTests
{
    private const string Group = "grp_1";

    private readonly Mock<IInvoiceStore> _invoices = new();
    private readonly Mock<IPaymentMethodService> _cards = new();
    private readonly Mock<ISubscriptionStore> _subscriptions = new();
    private readonly Mock<ICatalogueProvider> _catalogue = new();
    private readonly List<Invoice> _written = [];

    public OrderInvoiceWriterTests()
    {
        _catalogue.SetupGet(c => c.Catalogue).Returns(new PlanCatalogue { UsagePeriod = new UsagePeriodDefinition { Days = 30 } });
        _invoices.Setup(i => i.NextNumberAsync(It.IsAny<DateTime>(), It.IsAny<CancellationToken>())).ReturnsAsync("INV-2026-10-0001");
        _invoices.Setup(i => i.InsertAsync(It.IsAny<Invoice>(), It.IsAny<CancellationToken>()))
            .Callback<Invoice, CancellationToken>((i, _) => _written.Add(i))
            .Returns(Task.CompletedTask);
        _cards.Setup(c => c.ListAsync(Group, It.IsAny<CancellationToken>()))
            .ReturnsAsync([new PaymentMethodView { PaymentMethodId = "pm_1", Brand = "visa", LastFour = "4242", IsDefault = true }]);
    }

    private OrderInvoiceWriter Writer() =>
        new(_invoices.Object, _cards.Object, _subscriptions.Object, _catalogue.Object, NullLogger<OrderInvoiceWriter>.Instance);

    private static SubscriptionOrder Paid(decimal total) => new()
    {
        ItemId = "ord_1",
        TenantGroupId = Group,
        State = OrderStates.Paid,
        Market = "CHF",
        Subtotal = 50m,
        Vat = 4.05m,
        Total = total,
        ProviderReference = "psp_1",
        ChargedAtUtc = new DateTime(2026, 10, 11, 0, 0, 0, DateTimeKind.Utc),
        Lines =
        [
            new OrderLine { Kind = "environment", Environment = "stg", Label = "Staging (prorated, 15 days)", Amount = 50m, Billing = "rent" },
            new OrderLine { Kind = "topup", Environment = "stg", Meter = "api.calls", Units = 100000, Amount = 0m, Billing = "once" },
        ],
    };

    [Fact]
    public async Task A_paid_order_is_billed_with_its_lines_and_card()
    {
        await Writer().WriteAsync(Paid(54.05m));

        var invoice = Assert.Single(_written);
        Assert.Equal("ord_1", invoice.OrderId);
        Assert.Equal(InvoiceStates.Paid, invoice.State);
        Assert.Equal(54.05m, invoice.Total);
        Assert.NotNull(invoice.PaidAtUtc);
        Assert.Equal("visa", invoice.PaymentMethodBrand);
        Assert.Equal("4242", invoice.PaymentMethodLastFour);
        Assert.Equal("Staging (prorated, 15 days)", invoice.Lines[0].Label);
        Assert.Equal("rent", invoice.Lines[0].Billing);
        Assert.Equal("api.calls", invoice.Lines[1].Label);
        Assert.Equal("once", invoice.Lines[1].Billing);
    }

    [Fact]
    public async Task The_period_runs_to_the_subscriptions_next_charge()
    {
        var next = new DateTime(2026, 10, 26, 0, 0, 0, DateTimeKind.Utc);
        _subscriptions.Setup(s => s.GetAsync(Group, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new ProjectSubscription { TenantGroupId = Group, NextChargeAtUtc = next });

        await Writer().WriteAsync(Paid(54.05m));

        Assert.Equal(next, _written[0].PeriodEndUtc);
    }

    [Fact]
    public async Task A_free_order_is_not_billed()
    {
        await Writer().WriteAsync(Paid(0m));

        Assert.Empty(_written);
    }

    [Fact]
    public async Task An_order_already_billed_is_not_billed_twice()
    {
        _invoices.Setup(i => i.FindByOrderAsync(Group, "ord_1", It.IsAny<CancellationToken>())).ReturnsAsync(new Invoice());

        await Writer().WriteAsync(Paid(54.05m));

        Assert.Empty(_written);
    }

    [Fact]
    public async Task A_store_failure_never_turns_a_payment_into_an_error()
    {
        _invoices.Setup(i => i.InsertAsync(It.IsAny<Invoice>(), It.IsAny<CancellationToken>())).ThrowsAsync(new TimeoutException());

        var exception = await Record.ExceptionAsync(() => Writer().WriteAsync(Paid(54.05m)));

        Assert.Null(exception);
    }
}
