using Blocks.Genesis;
using DomainService.Access;
using DomainService.Access.Services;
using DomainService.Billing.Entities;
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
    /// <para>
    /// A blank <c>TenantGroupId</c> prices a brand-new project: nothing held, nothing prorated,
    /// nothing saved. The project filter lets a blank group through by design, so the only check
    /// on that path is the endpoint permission — which is all a price list needs.
    /// </para>
    /// </remarks>
    [HttpPost("quote")]
    [ProtectedEndPoint("blocks-os::billing::read")]
    [ProjectPolicy("subscription::view")]
    public async Task<StartCheckoutResponse> Quote(
        [FromBody] StartCheckoutRequest request,
        CancellationToken cancellationToken)
    {
        if (request is null)
        {
            return Missing<StartCheckoutResponse>();
        }

        if (!string.IsNullOrWhiteSpace(request.TenantGroupId))
        {
            await _access.ResolveAsync(request.TenantGroupId, cancellationToken);
        }

        var result = await _checkout.QuoteAsync(request, cancellationToken);

        return result.IsSuccess
            ? new StartCheckoutResponse { IsSuccess = true, Checkout = result }
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
            ? new StartCheckoutResponse { IsSuccess = true, Checkout = result }
            : Failed<StartCheckoutResponse>("checkout", result.Reason);
    }

    /// <summary>
    /// Charges the card on file. Returns the order, not a project — provisioning has only just
    /// begun.
    /// </summary>
    /// <remarks>
    /// Safe to call twice with the same key: the second call returns the first order rather than
    /// charging again.
    /// <para>
    /// A refusal is <c>IsSuccess = false</c> with the reason in <c>Errors["checkout"]</c> — the same
    /// key start and quote use, and the one the console reads. The
    /// reason is also left in <c>Order.State</c>, where earlier clients read it. A decline returns
    /// the order itself (state <c>declined</c>, with its <c>DeclineReason</c>) and the reason
    /// <c>checkout_declined</c>; an expired order returns <c>checkout_order_expired</c>. A charge
    /// with no answer yet is not a failure: the order stays <c>pending</c> and is watched.
    /// </para>
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

        var order = await _payments.PayAsync(request, cancellationToken);
        var failure = PayFailure(order);

        return failure is null
            ? new OrderResponse { IsSuccess = true, Order = order }
            : new OrderResponse
            {
                IsSuccess = false,
                Errors = new Dictionary<string, string> { { "checkout", failure } },
                Order = order,
            };
    }

    /// <summary>
    /// Why a payment did not go through, or null when it did — or may still. A refusal before
    /// any charge comes back as a bare reason in <c>State</c>; the rest are real order states.
    /// </summary>
    public static string? PayFailure(OrderView? order) => order?.State switch
    {
        null => CheckoutFailures.OrderNotFound,
        OrderStates.Declined => CheckoutFailures.Declined,
        OrderStates.Expired => CheckoutFailures.OrderExpired,
        var state when state.StartsWith("checkout_", StringComparison.Ordinal) => state,
        _ => null,
    };

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
            : new OrderResponse { IsSuccess = true, Order = order };
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

        return new OrderResponse { IsSuccess = true, Order = await _checkout.GetActiveAsync(tenantGroupId, cancellationToken) };
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
