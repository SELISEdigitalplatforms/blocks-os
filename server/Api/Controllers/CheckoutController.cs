using Blocks.Genesis;
using DomainService.Access;
using DomainService.Access.Services;
using DomainService.Billing.Models;
using DomainService.Billing.Services;
using Microsoft.AspNetCore.Mvc;

namespace BlocksOs.Api.Controllers;

/// <summary>
/// Buying environments and top-ups for a project.
/// </summary>
/// <remarks>
/// Two calls, in this order and no other.
/// <list type="number">
/// <item><description><c>start</c> prices and validates the purchase, writes it as a pending
/// order, and returns the idempotency key. Everything knowable is checked here, while refusing
/// still costs nothing.</description></item>
/// <item><description><c>pay</c> charges the card and hands provisioning to the worker. It returns
/// as soon as the money clears — building seven environments takes minutes, and no HTTP call waits
/// for that.</description></item>
/// </list>
/// Both are owner-only. Money is the case <see cref="ProjectPolicyAttribute.OwnerOnly"/> exists
/// for: it is a flag rather than a grant string so that nothing typed into a hand-edited policy
/// list can satisfy it.
/// </remarks>
[ApiController]
[Route("[controller]")]
public class CheckoutController : ControllerBase
{
    private readonly ICheckoutService _checkout;
    private readonly IOrderPaymentService _payments;
    private readonly IProjectAccessService _access;

    public CheckoutController(
        ICheckoutService checkout,
        IOrderPaymentService payments,
        IProjectAccessService access)
    {
        _checkout = checkout;
        _payments = payments;
        _access = access;
    }

    /// <summary>
    /// Prices a selection without writing anything.
    /// </summary>
    /// <remarks>
    /// What the screen calls while someone is still choosing. Pricing through <c>start</c> on every
    /// change would leave an abandoned order behind every tick of a checkbox.
    /// </remarks>
    [HttpPost("quote")]
    [ProtectedEndPoint("blocks-os::billing::read")]
    [ProjectPolicy("subscription::view")]
    public async Task<StartCheckoutResponse> Quote(
        [FromBody] StartCheckoutRequest request,
        CancellationToken cancellationToken)
    {
        if (request is null || string.IsNullOrWhiteSpace(request.TenantGroupId))
        {
            return Missing<StartCheckoutResponse>();
        }

        await _access.ResolveAsync(request.TenantGroupId, cancellationToken);

        var result = await _checkout.QuoteAsync(request, cancellationToken);

        return result.IsSuccess
            ? new StartCheckoutResponse { Checkout = result }
            : Failed<StartCheckoutResponse>("checkout", result.Reason);
    }

    /// <summary>Prices the purchase and mints the key that makes paying for it safe to retry.</summary>
    [HttpPost("start")]
    [ProtectedEndPoint("blocks-os::billing::manage")]
    [ProjectPolicy(OwnerOnly = true)]
    public async Task<StartCheckoutResponse> Start(
        [FromBody] StartCheckoutRequest request,
        CancellationToken cancellationToken)
    {
        if (request is null || string.IsNullOrWhiteSpace(request.TenantGroupId))
        {
            return Missing<StartCheckoutResponse>();
        }

        await _access.ResolveAsync(request.TenantGroupId, cancellationToken);

        var userId = BlocksContext.GetContext()?.UserId ?? string.Empty;
        var result = await _checkout.StartAsync(request, userId, cancellationToken);

        return result.IsSuccess
            ? new StartCheckoutResponse { Checkout = result }
            : Failed<StartCheckoutResponse>("checkout", result.Reason);
    }

    /// <summary>
    /// Charges the card on file. Returns the order, not a project — provisioning has only just
    /// begun.
    /// </summary>
    /// <remarks>
    /// Safe to call twice with the same key: the second call returns the first order rather than
    /// charging again.
    /// </remarks>
    [HttpPost("pay")]
    [ProtectedEndPoint("blocks-os::billing::manage")]
    [ProjectPolicy(OwnerOnly = true)]
    public async Task<OrderResponse> Pay(
        [FromBody] PayCheckoutRequest request,
        CancellationToken cancellationToken)
    {
        if (request is null || string.IsNullOrWhiteSpace(request.TenantGroupId))
        {
            return Missing<OrderResponse>();
        }

        await _access.ResolveAsync(request.TenantGroupId, cancellationToken);

        return new OrderResponse { Order = await _payments.PayAsync(request, cancellationToken) };
    }

    /// <summary>One order, for the screen that watches it.</summary>
    [HttpGet("order")]
    [ProtectedEndPoint("blocks-os::billing::read")]
    [ProjectPolicy("subscription::view")]
    public async Task<OrderResponse> GetOrder(
        [FromQuery] string tenantGroupId,
        [FromQuery] string orderId,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(tenantGroupId))
        {
            return Missing<OrderResponse>();
        }

        await _access.ResolveAsync(tenantGroupId, cancellationToken);

        var order = await _checkout.GetAsync(tenantGroupId, orderId, cancellationToken);

        return order is null
            ? Failed<OrderResponse>("order", CheckoutFailures.OrderNotFound)
            : new OrderResponse { Order = order };
    }

    /// <summary>
    /// The order still being worked on, if any.
    /// </summary>
    /// <remarks>
    /// What the console calls once on load to rebuild its progress bar. Live progress arrives by
    /// push and is not persisted, so after a refresh there is nothing to render from until this
    /// answers. One request, not a poll.
    /// </remarks>
    [HttpGet("active")]
    [ProtectedEndPoint("blocks-os::billing::read")]
    [ProjectPolicy("subscription::view")]
    public async Task<OrderResponse> GetActive(
        [FromQuery] string tenantGroupId,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(tenantGroupId))
        {
            return Missing<OrderResponse>();
        }

        await _access.ResolveAsync(tenantGroupId, cancellationToken);

        return new OrderResponse { Order = await _checkout.GetActiveAsync(tenantGroupId, cancellationToken) };
    }

    private static T Missing<T>() where T : BaseResponse, new() =>
        Failed<T>("TenantGroupId", "TenantGroupId is required.");

    private static T Failed<T>(string key, string message) where T : BaseResponse, new() =>
        new() { IsSuccess = false, Errors = new Dictionary<string, string> { { key, message } } };
}

public sealed class StartCheckoutResponse : BaseResponse
{
    public StartCheckoutResult Checkout { get; set; } = new();
}

public sealed class OrderResponse : BaseResponse
{
    public OrderView? Order { get; set; }
}
