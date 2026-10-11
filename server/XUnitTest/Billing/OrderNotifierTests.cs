using System.Net;
using System.Text.Json;
using DomainService.Billing.Entities;
using DomainService.Billing.Models;
using DomainService.Billing.Services;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace XUnitTest.Billing;

/// <summary>B13: an order push names its project, so the console can route it.</summary>
public class OrderNotifierTests
{
    private sealed class Capture : HttpMessageHandler
    {
        public string Body { get; private set; } = string.Empty;
        public string? BlocksKey { get; private set; }

        protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            Body = await request.Content!.ReadAsStringAsync(cancellationToken);
            BlocksKey = request.Headers.TryGetValues("X-Blocks-Key", out var values) ? values.Single() : null;
            return new HttpResponseMessage(HttpStatusCode.OK);
        }
    }

    [Fact]
    public async Task The_pushed_payload_carries_the_project()
    {
        var capture = new Capture();
        var notifier = new OrderNotifier(
            new HttpClient(capture) { BaseAddress = new Uri("http://logic.local/") },
            NullLogger<OrderNotifier>.Instance);

        var view = CheckoutService.ToView(new SubscriptionOrder { ItemId = "ord_1", TenantGroupId = "grp_1", State = OrderStates.Creating });
        await notifier.PushProgressAsync("usr_1", view);

        using var request = JsonDocument.Parse(capture.Body);
        using var payload = JsonDocument.Parse(request.RootElement.GetProperty("denormalizedPayload").GetString()!);

        Assert.Equal("grp_1", payload.RootElement.GetProperty("tenantGroupId").GetString());
        Assert.Equal("ord_1", payload.RootElement.GetProperty("orderId").GetString());
    }

    [Fact]
    public void The_order_view_names_its_project()
    {
        var view = CheckoutService.ToView(new SubscriptionOrder { ItemId = "ord_1", TenantGroupId = "grp_1" });

        Assert.Equal("grp_1", view.TenantGroupId);
    }

    [Fact]
    public async Task The_push_is_sent_under_the_tenant_the_console_listens_on()
    {
        var capture = new Capture();
        var notifier = new OrderNotifier(
            new HttpClient(capture) { BaseAddress = new Uri("http://logic.local/") },
            NullLogger<OrderNotifier>.Instance);

        var view = CheckoutService.ToView(new SubscriptionOrder { ItemId = "ord_1", TenantGroupId = "grp_1", NotifyTenantId = "ROOT_KEY" });
        await notifier.PushStatusAsync("usr_1", view, "Your project is ready");

        Assert.Equal("ROOT_KEY", capture.BlocksKey);
    }

    [Fact]
    public void The_notify_tenant_never_reaches_the_client()
    {
        var view = CheckoutService.ToView(new SubscriptionOrder { ItemId = "ord_1", NotifyTenantId = "ROOT_KEY" });

        Assert.DoesNotContain("ROOT_KEY", JsonSerializer.Serialize(view));
    }
}
