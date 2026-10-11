using Blocks.Genesis;
using DomainService.Access;
using DomainService.Access.Services;
using DomainService.Billing.Models;
using DomainService.Billing.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace BlocksOs.Api.Controllers;

/// <summary>
/// Cards a project has on file for its Blocks subscription.
/// </summary>
/// <remarks>
/// Every action is scoped to a project group and every write is owner-only. Money is the case
/// <see cref="ProjectPolicyAttribute.OwnerOnly"/> exists for: it is a flag rather than a grant
/// string precisely so nothing typed into a hand-edited policy list can satisfy it.
/// <para>
/// There is deliberately no endpoint that attaches a card from a request body. A caller who could
/// post a provider token could file someone else's card against their own project; attaching is
/// done in-process from a verified provider callback.
/// </para>
/// </remarks>
[ApiController]
[Route("[controller]")]
public class BillingController : ControllerBase
{
    private readonly IPaymentMethodService _paymentMethods;
    private readonly IProjectAccessService _access;
    private readonly IPaymentGateway _gateway;
    private readonly ISubscriptionStore _subscriptions;
    private readonly IInvoiceStore _invoices;
    private readonly IInvoicePdfWriter _pdf;
    private readonly IRenewalService _renewals;
    private readonly IEnvironmentRemovalService _removals;

    public BillingController(
        IPaymentMethodService paymentMethods,
        IProjectAccessService access,
        IPaymentGateway gateway,
        ISubscriptionStore subscriptions,
        IInvoiceStore invoices,
        IInvoicePdfWriter pdf,
        IRenewalService renewals,
        IEnvironmentRemovalService removals)
    {
        _removals = removals;
        _paymentMethods = paymentMethods;
        _access = access;
        _gateway = gateway;
        _subscriptions = subscriptions;
        _invoices = invoices;
        _pdf = pdf;
        _renewals = renewals;
    }

    /// <summary>The cards on file. Contains nothing secret — brand, last four, expiry.</summary>
    [HttpGet("cards")]
    [ProtectedEndPoint("blocks-os::billing::read")]
    [ProjectPolicy("subscription::view")]
    public async Task<PaymentMethodListResponse> GetCards(
        [FromQuery] string tenantGroupId,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(tenantGroupId))
        {
            return Missing<PaymentMethodListResponse>();
        }

        // Resolving here as well as in the filter costs nothing — it is cached per request — and
        // it keeps the endpoint correct if the attribute is ever removed by accident.
        await _access.ResolveAsync(tenantGroupId, cancellationToken);

        return new PaymentMethodListResponse
        {
            IsSuccess = true,
            Cards = await _paymentMethods.ListAsync(tenantGroupId, cancellationToken)
        };
    }

    /// <summary>
    /// Opens a session in which the browser can add a card.
    /// </summary>
    /// <remarks>
    /// Returns only what the card component needs. The card itself goes from the browser straight
    /// to Adyen; this service never sees a number, and the card is filed later from a signed
    /// notification rather than from anything the browser sends back.
    /// </remarks>
    [HttpPost("cards/session")]
    [ProtectedEndPoint("blocks-os::billing::manage")]
    [ProjectPolicy(OwnerOnly = true)]
    public async Task<CardSessionResponse> CreateCardSession(
        [FromBody] CardSessionRequest request,
        CancellationToken cancellationToken)
    {
        if (request is null || string.IsNullOrWhiteSpace(request.TenantGroupId))
        {
            return Missing<CardSessionResponse>();
        }

        await _access.ResolveAsync(request.TenantGroupId, cancellationToken);

        var session = await _gateway.CreateCardSessionAsync(
            request.TenantGroupId,
            string.IsNullOrWhiteSpace(request.Market) ? "CHF" : request.Market,
            request.ReturnUrl ?? string.Empty,
            cancellationToken);

        return session.IsSuccess
            ? new CardSessionResponse { IsSuccess = true, Session = session }
            : new CardSessionResponse
            {
                IsSuccess = false,
                Errors = new Dictionary<string, string> { { "card_session", session.Reason } },
            };
    }

    /// <summary>Makes one card the one a renewal charges. Owner only.</summary>
    [HttpPost("cards/default")]
    [ProtectedEndPoint("blocks-os::billing::manage")]
    [ProjectPolicy(OwnerOnly = true)]
    public async Task<PaymentMethodResponse> SetDefault(
        [FromBody] PaymentMethodRequest request,
        CancellationToken cancellationToken)
    {
        if (request is null || string.IsNullOrWhiteSpace(request.TenantGroupId))
        {
            return Missing<PaymentMethodResponse>();
        }

        return Respond(await _paymentMethods.SetDefaultAsync(
            request.TenantGroupId,
            request.PaymentMethodId,
            cancellationToken));
    }

    /// <summary>
    /// Detaches a card. Another is promoted if this was the default, because a renewal needs one
    /// to exist.
    /// </summary>
    [HttpPost("cards/remove")]
    [ProtectedEndPoint("blocks-os::billing::manage")]
    [ProjectPolicy(OwnerOnly = true)]
    public async Task<PaymentMethodResponse> RemoveCard(
        [FromBody] PaymentMethodRequest request,
        CancellationToken cancellationToken)
    {
        if (request is null || string.IsNullOrWhiteSpace(request.TenantGroupId))
        {
            return Missing<PaymentMethodResponse>();
        }

        return Respond(await _paymentMethods.RemoveAsync(
            request.TenantGroupId,
            request.PaymentMethodId,
            cancellationToken));
    }

    /// <summary>What this project pays each month, and when it is next charged.</summary>
    [HttpGet("subscription")]
    [ProtectedEndPoint("blocks-os::billing::read")]
    [ProjectPolicy("subscription::view")]
    public async Task<SubscriptionResponse> GetSubscription(
        [FromQuery] string tenantGroupId,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(tenantGroupId))
        {
            return Missing<SubscriptionResponse>();
        }

        await _access.ResolveAsync(tenantGroupId, cancellationToken);

        var subscription = await _subscriptions.GetAsync(tenantGroupId, cancellationToken);

        if (subscription is null)
        {
            return new SubscriptionResponse { IsSuccess = true };
        }

        var beforeTax = subscription.MonthlyBeforeTax;

        return new SubscriptionResponse
        {
            IsSuccess = true,
            Subscription = new SubscriptionView
            {
                TenantGroupId = subscription.TenantGroupId,
                Market = subscription.Market,
                State = subscription.State,
                MonthlyBeforeTax = beforeTax,
                MonthlyTotal = beforeTax + Math.Round(beforeTax * 0.081m, 2, MidpointRounding.AwayFromZero),
                // Shown plainly rather than hidden: it is owed, and nothing was cut off over it.
                CarriedBalance = subscription.CarriedBalance,
                NextChargeAtUtc = subscription.NextChargeAtUtc,
                LastChargedAtUtc = subscription.LastChargedAtUtc,
                Lines = [.. subscription.Lines.Select(l => new SubscriptionLineView
                {
                    Kind = l.Kind,
                    Environment = l.Environment,
                    Label = l.Label,
                    Meter = l.Meter,
                    Units = l.Units,
                    Amount = l.Amount,
                    // Everything on a subscription recurs; one-off units never reach it.
                    Billing = "rent",
                    EndsAtUtc = l.EndsAtUtc,
                    PendingRemoval = l.EndsAtUtc is not null,
                })],
            },
        };
    }

    /// <summary>Past invoices, newest first.</summary>
    [HttpGet("invoices")]
    [ProtectedEndPoint("blocks-os::billing::read")]
    [ProjectPolicy("subscription::view")]
    public async Task<InvoiceListResponse> GetInvoices(
        [FromQuery] string tenantGroupId,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(tenantGroupId))
        {
            return Missing<InvoiceListResponse>();
        }

        await _access.ResolveAsync(tenantGroupId, cancellationToken);

        var invoices = await _invoices.ListAsync(tenantGroupId, 24, cancellationToken);

        return new InvoiceListResponse
        {
            IsSuccess = true,
            Invoices = [.. invoices.Select(ToView)],
        };
    }

    /// <summary>One invoice, for its detail screen.</summary>
    /// <remarks>
    /// Scoped by project: an invoice id from another project answers exactly like one that does
    /// not exist, so an id alone reveals nothing.
    /// </remarks>
    [HttpGet("invoices/{invoiceId}")]
    [Authorize] // LOCAL-TEST: restore [ProtectedEndPoint("blocks-os::billing::read")] before push
    [ProjectPolicy("subscription::view")]
    public async Task<InvoiceResponse> GetInvoice(
        [FromQuery] string tenantGroupId,
        [FromRoute] string invoiceId,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(tenantGroupId))
        {
            return Missing<InvoiceResponse>();
        }

        await _access.ResolveAsync(tenantGroupId, cancellationToken);

        var invoice = string.IsNullOrWhiteSpace(invoiceId)
            ? null
            : await _invoices.GetAsync(tenantGroupId, invoiceId, cancellationToken);

        return invoice is null
            ? new InvoiceResponse
            {
                IsSuccess = false,
                Errors = new Dictionary<string, string> { { "invoice", BillingFailures.InvoiceNotFound } },
            }
            : new InvoiceResponse { IsSuccess = true, Invoice = ToView(invoice) };
    }

    private static InvoiceView ToView(DomainService.Billing.Entities.Invoice i) => new()
    {
        InvoiceId = i.ItemId,
        Number = i.Number,
        Market = i.Market,
        Subtotal = i.Subtotal,
        Vat = i.Vat,
        Total = i.Total,
        CarriedIn = i.CarriedIn,
        State = i.State,
        IssuedAtUtc = i.IssuedAtUtc,
        PaidAtUtc = i.PaidAtUtc,
        PeriodStartUtc = i.PeriodStartUtc,
        PeriodEndUtc = i.PeriodEndUtc,
        OrderId = string.IsNullOrWhiteSpace(i.OrderId) ? null : i.OrderId,
        PaymentMethodBrand = string.IsNullOrWhiteSpace(i.PaymentMethodBrand) ? null : i.PaymentMethodBrand,
        PaymentMethodLastFour = string.IsNullOrWhiteSpace(i.PaymentMethodLastFour) ? null : i.PaymentMethodLastFour,
        DeclinedAtUtc = i.DeclinedAtUtc,
        // Only an invoice still owed has a next attempt.
        NextRetryUtc = i.State == DomainService.Billing.Entities.InvoiceStates.Unpaid ? i.NextRetryUtc : null,
        Lines = [.. i.Lines.Select(l => new InvoiceLineView
        {
            Label = l.Label,
            Environment = l.Environment,
            Units = l.Units,
            Amount = l.Amount,
            Billing = l.Billing,
        })],
    };

    /// <summary>
    /// Stops paying for one environment at the end of the current period.
    /// </summary>
    /// <remarks>
    /// Nothing stops now and nothing is refunded: the environment runs to the end of the period
    /// already paid for, and the renewal at that boundary drops it and switches it off. Taken
    /// back with <c>environments/keep</c> any time before then.
    /// </remarks>
    [HttpPost("environments/remove")]
    [Authorize] // LOCAL-TEST: restore [ProtectedEndPoint("blocks-os::billing::manage")] before push
    [ProjectPolicy(OwnerOnly = true)]
    public async Task<EnvironmentRemovalResponse> RemoveEnvironment(
        [FromBody] EnvironmentRemovalRequest request,
        CancellationToken cancellationToken)
    {
        if (request is null || string.IsNullOrWhiteSpace(request.TenantGroupId))
        {
            return Missing<EnvironmentRemovalResponse>();
        }

        await _access.ResolveAsync(request.TenantGroupId, cancellationToken);

        return Respond(await _removals.RemoveAsync(request.TenantGroupId, request.Environment ?? string.Empty, cancellationToken));
    }

    /// <summary>Takes back a pending removal.</summary>
    [HttpPost("environments/keep")]
    [Authorize] // LOCAL-TEST: restore [ProtectedEndPoint("blocks-os::billing::manage")] before push
    [ProjectPolicy(OwnerOnly = true)]
    public async Task<EnvironmentRemovalResponse> KeepEnvironment(
        [FromBody] EnvironmentRemovalRequest request,
        CancellationToken cancellationToken)
    {
        if (request is null || string.IsNullOrWhiteSpace(request.TenantGroupId))
        {
            return Missing<EnvironmentRemovalResponse>();
        }

        await _access.ResolveAsync(request.TenantGroupId, cancellationToken);

        return Respond(await _removals.KeepAsync(request.TenantGroupId, request.Environment ?? string.Empty, cancellationToken));
    }

    /// <summary>
    /// Charges what a past-due project owes now, rather than at the next renewal.
    /// </summary>
    /// <remarks>
    /// Same card and same amount the renewal would use: the carried balance plus VAT. On success
    /// the newest unpaid invoice is marked paid and the project is no longer past due.
    /// </remarks>
    [HttpPost("retry-payment")]
    [Authorize] // LOCAL-TEST: restore [ProtectedEndPoint("blocks-os::billing::manage")] before push
    [ProjectPolicy(OwnerOnly = true)]
    public async Task<RetryPaymentResponse> RetryPayment(
        [FromBody] RetryPaymentRequest request,
        CancellationToken cancellationToken)
    {
        if (request is null || string.IsNullOrWhiteSpace(request.TenantGroupId))
        {
            return Missing<RetryPaymentResponse>();
        }

        await _access.ResolveAsync(request.TenantGroupId, cancellationToken);

        var result = await _renewals.RetryPaymentAsync(request.TenantGroupId, cancellationToken);

        return new RetryPaymentResponse
        {
            IsSuccess = result.IsSuccess,
            Errors = result.IsSuccess
                ? new Dictionary<string, string>()
                : new Dictionary<string, string> { { "billing", result.Reason } },
            State = result.State,
            CarriedBalance = result.CarriedBalance,
        };
    }

    private static EnvironmentRemovalResponse Respond(EnvironmentRemovalResult result) =>
        result.IsSuccess
            ? new EnvironmentRemovalResponse { IsSuccess = true, EffectiveUtc = result.EffectiveUtc }
            : new EnvironmentRemovalResponse
            {
                IsSuccess = false,
                Errors = new Dictionary<string, string> { { "billing", result.Reason } },
            };

    /// <summary>The invoice as a PDF, for keeping or forwarding.</summary>
    [HttpGet("invoices/{invoiceId}/pdf")]
    [ProtectedEndPoint("blocks-os::billing::read")]
    [ProjectPolicy("subscription::view")]
    public async Task<IActionResult> GetInvoicePdf(
        [FromQuery] string tenantGroupId,
        [FromRoute] string invoiceId,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(tenantGroupId) || string.IsNullOrWhiteSpace(invoiceId))
        {
            return BadRequest();
        }

        await _access.ResolveAsync(tenantGroupId, cancellationToken);

        // Scoped by project, so an invoice id guessed from another project resolves to nothing.
        var invoice = await _invoices.GetAsync(tenantGroupId, invoiceId, cancellationToken);

        if (invoice is null)
        {
            return NotFound();
        }

        var pdf = _pdf.Write(invoice, tenantGroupId);

        return File(pdf, "application/pdf", $"{invoice.Number}.pdf");
    }

    /// <summary>
    /// Stops the monthly charge.
    /// </summary>
    /// <remarks>
    /// Ends the billing relationship only. Environments keep running and their data is untouched —
    /// tearing them down is a separate, destructive decision, and not one to make by pressing a
    /// button labelled "unsubscribe".
    /// </remarks>
    [HttpPost("unsubscribe")]
    [ProtectedEndPoint("blocks-os::billing::manage")]
    [ProjectPolicy(OwnerOnly = true)]
    public async Task<UnsubscribeResponse> Unsubscribe(
        [FromBody] UnsubscribeRequest request,
        CancellationToken cancellationToken)
    {
        if (request is null || string.IsNullOrWhiteSpace(request.TenantGroupId))
        {
            return Missing<UnsubscribeResponse>();
        }

        await _access.ResolveAsync(request.TenantGroupId, cancellationToken);

        var result = await _renewals.UnsubscribeAsync(request.TenantGroupId, cancellationToken);

        return result.IsSuccess
            ? new UnsubscribeResponse
            {
                IsSuccess = true,
                OutstandingBalance = result.OutstandingBalance,
                EffectiveUtc = result.EffectiveUtc,
            }
            : new UnsubscribeResponse
            {
                IsSuccess = false,
                Errors = new Dictionary<string, string> { { "unsubscribe", result.Reason } },
            };
    }

    private static PaymentMethodResponse Respond(PaymentMethodResult result) =>
        result.IsSuccess
            ? new PaymentMethodResponse { IsSuccess = true, PaymentMethodId = result.PaymentMethodId }
            : new PaymentMethodResponse
            {
                IsSuccess = false,
                Errors = new Dictionary<string, string> { { "payment_method", result.Reason } }
            };

    private static T Missing<T>() where T : BaseResponse, new() =>
        new() { IsSuccess = false, Errors = new Dictionary<string, string> { { "TenantGroupId", "TenantGroupId is required." } } };
}

public sealed class PaymentMethodListResponse : BaseResponse
{
    public IReadOnlyList<PaymentMethodView> Cards { get; set; } = [];
}

public sealed class PaymentMethodRequest
{
    public string TenantGroupId { get; set; } = string.Empty;
    public string PaymentMethodId { get; set; } = string.Empty;
}

public sealed class PaymentMethodResponse : BaseResponse
{
    public string PaymentMethodId { get; set; } = string.Empty;
}

public sealed class CardSessionRequest
{
    public string TenantGroupId { get; set; } = string.Empty;
    public string Market { get; set; } = "CHF";

    /// <summary>Where the provider sends the browser back after a challenge.</summary>
    public string? ReturnUrl { get; set; }
}

public sealed class CardSessionResponse : BaseResponse
{
    public CardSessionResult Session { get; set; } = new();
}


public sealed class SubscriptionResponse : BaseResponse
{
    public SubscriptionView? Subscription { get; set; }
}

public sealed class SubscriptionView
{
    public string TenantGroupId { get; set; } = string.Empty;
    public string Market { get; set; } = "CHF";
    public string State { get; set; } = string.Empty;
    public decimal MonthlyBeforeTax { get; set; }
    public decimal MonthlyTotal { get; set; }
    public decimal CarriedBalance { get; set; }
    public DateTime NextChargeAtUtc { get; set; }
    public DateTime? LastChargedAtUtc { get; set; }
    public List<SubscriptionLineView> Lines { get; set; } = [];
}

public sealed class SubscriptionLineView
{
    /// <summary>"environment" or "topup".</summary>
    public string Kind { get; set; } = string.Empty;
    public string Environment { get; set; } = string.Empty;
    public string Label { get; set; } = string.Empty;
    public string Meter { get; set; } = string.Empty;
    public long Units { get; set; }
    public decimal Amount { get; set; }

    /// <summary>"rent" or "once". Always "rent" today: only recurring lines are on a subscription.</summary>
    public string Billing { get; set; } = "rent";

    /// <summary>When billing for this line stops, after a removal. Null while it continues.</summary>
    public DateTime? EndsAtUtc { get; set; }

    public bool PendingRemoval { get; set; }
}

public sealed class InvoiceListResponse : BaseResponse
{
    public List<InvoiceView> Invoices { get; set; } = [];
}

public sealed class InvoiceView
{
    public string InvoiceId { get; set; } = string.Empty;
    public string Number { get; set; } = string.Empty;
    public string Market { get; set; } = "CHF";
    public decimal Subtotal { get; set; }
    public decimal Vat { get; set; }
    public decimal Total { get; set; }
    public decimal CarriedIn { get; set; }
    public string State { get; set; } = string.Empty;
    public DateTime IssuedAtUtc { get; set; }
    public DateTime? PaidAtUtc { get; set; }
    public DateTime? PeriodStartUtc { get; set; }
    public DateTime? PeriodEndUtc { get; set; }

    /// <summary>The order this bills; null for a renewal.</summary>
    public string? OrderId { get; set; }

    public string? PaymentMethodBrand { get; set; }
    public string? PaymentMethodLastFour { get; set; }
    public DateTime? DeclinedAtUtc { get; set; }

    /// <summary>Set on an unpaid invoice only: when the next renewal will try the amount again.</summary>
    public DateTime? NextRetryUtc { get; set; }

    public List<InvoiceLineView> Lines { get; set; } = [];
}

public sealed class InvoiceResponse : BaseResponse
{
    public InvoiceView? Invoice { get; set; }
}

public sealed class EnvironmentRemovalRequest
{
    public string TenantGroupId { get; set; } = string.Empty;

    /// <summary>Catalogue key: dev, test, stg, iat, uat, pre-prod, prod.</summary>
    public string Environment { get; set; } = string.Empty;
}

public sealed class EnvironmentRemovalResponse : BaseResponse
{
    /// <summary>When billing stops — the subscription's next charge. Null after a keep.</summary>
    public DateTime? EffectiveUtc { get; set; }
}

public sealed class RetryPaymentRequest
{
    public string TenantGroupId { get; set; } = string.Empty;
}

public sealed class RetryPaymentResponse : BaseResponse
{
    public string State { get; set; } = string.Empty;
    public decimal CarriedBalance { get; set; }
}

public sealed class InvoiceLineView
{
    public string Label { get; set; } = string.Empty;
    public string Environment { get; set; } = string.Empty;
    public long Units { get; set; }
    public decimal Amount { get; set; }
    public string Billing { get; set; } = "once";
}


public sealed class UnsubscribeRequest
{
    public string TenantGroupId { get; set; } = string.Empty;
}

public sealed class UnsubscribeResponse : BaseResponse
{
    /// <summary>Owed at the moment of cancelling. Cancelling does not forgive it.</summary>
    public decimal OutstandingBalance { get; set; }

    public DateTime? EffectiveUtc { get; set; }
}
