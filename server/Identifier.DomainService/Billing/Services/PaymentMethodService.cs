using DomainService.Billing.Entities;
using DomainService.Billing.Models;
using Microsoft.Extensions.Logging;

namespace DomainService.Billing.Services;

public interface IPaymentMethodService
{
    Task<IReadOnlyList<PaymentMethodView>> ListAsync(
        string tenantGroupId,
        CancellationToken cancellationToken = default);

    /// <summary>Files a tokenised card against the project. First card becomes the default.</summary>
    Task<PaymentMethodResult> AttachAsync(
        string tenantGroupId,
        string userId,
        AttachPaymentMethodRequest request,
        CancellationToken cancellationToken = default);

    Task<PaymentMethodResult> SetDefaultAsync(
        string tenantGroupId,
        string paymentMethodId,
        CancellationToken cancellationToken = default);

    Task<PaymentMethodResult> RemoveAsync(
        string tenantGroupId,
        string paymentMethodId,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// The secret needed to charge a project's default card. For the renewal path only; never
    /// reachable from an HTTP endpoint.
    /// </summary>
    Task<CardSecret?> GetDefaultChargeSecretAsync(
        string tenantGroupId,
        CancellationToken cancellationToken = default);
}

/// <summary>
/// Cards on file for a project's platform subscription.
/// </summary>
/// <remarks>
/// Splits a card in two along the only line that matters: what may be shown, and what could
/// raise a charge. The showable half is a row in the root database; the chargeable half is a
/// vault secret. No method returns both, and the one that returns the secret is not on the API
/// surface.
/// </remarks>
public sealed class PaymentMethodService : IPaymentMethodService
{
    private readonly ITenantPaymentMethodRepository _repository;
    private readonly IBillingSecretStore _secrets;
    private readonly ILogger<PaymentMethodService> _logger;
    private readonly TimeProvider _time;

    public PaymentMethodService(
        ITenantPaymentMethodRepository repository,
        IBillingSecretStore secrets,
        ILogger<PaymentMethodService> logger,
        TimeProvider? timeProvider = null)
    {
        _repository = repository;
        _secrets = secrets;
        _logger = logger;
        _time = timeProvider ?? TimeProvider.System;
    }

    public async Task<IReadOnlyList<PaymentMethodView>> ListAsync(
        string tenantGroupId,
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(tenantGroupId))
        {
            return [];
        }

        var utcNow = _time.GetUtcNow().UtcDateTime;

        var methods = await _repository
            .ListAsync(tenantGroupId, cancellationToken)
            .ConfigureAwait(false);

        return methods.Select(method => ToView(method, utcNow)).ToList();
    }

    public async Task<PaymentMethodResult> AttachAsync(
        string tenantGroupId,
        string userId,
        AttachPaymentMethodRequest request,
        CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(request);

        if (string.IsNullOrWhiteSpace(tenantGroupId) ||
            string.IsNullOrWhiteSpace(request.ProviderToken) ||
            string.IsNullOrWhiteSpace(request.ProviderName) ||
            !IsPlausibleExpiry(request.ExpiryMonth, request.ExpiryYear))
        {
            return PaymentMethodResult.Failed(PaymentMethodFailures.InvalidCard);
        }

        var utcNow = _time.GetUtcNow().UtcDateTime;
        var paymentMethodId = Guid.NewGuid().ToString("N");

        // The secret goes in first. If the row were written first and this failed, the tenant
        // would see a card that can never be charged; this way a failure leaves an orphaned
        // vault value, which is invisible and harmless.
        try
        {
            await _secrets
                .SaveAsync(
                    tenantGroupId,
                    paymentMethodId,
                    new CardSecret
                    {
                        ProviderToken = request.ProviderToken,
                        ProviderCustomerId = request.ProviderCustomerId,
                    },
                    cancellationToken)
                .ConfigureAwait(false);
        }
        catch (Exception exception) when (exception is not OperationCanceledException)
        {
            // Without the request: it holds the provider token.
            _logger.LogError(
                exception,
                "Could not store the card secret for project {TenantGroupId}.",
                tenantGroupId);
            return PaymentMethodResult.Failed(PaymentMethodFailures.SecretUnavailable);
        }

        var existing = await _repository
            .ListAsync(tenantGroupId, cancellationToken)
            .ConfigureAwait(false);

        await _repository
            .InsertAsync(
                new TenantPaymentMethod
                {
                    ItemId = paymentMethodId,
                    TenantGroupId = tenantGroupId,
                    AddedByUserId = userId ?? string.Empty,
                    ProviderName = request.ProviderName,
                    SecretId = BillingSecretStore.SecretIdFor(tenantGroupId, paymentMethodId),
                    Brand = request.Brand,
                    LastFour = request.LastFour,
                    ExpiryMonth = request.ExpiryMonth,
                    ExpiryYear = request.ExpiryYear,
                    // A project with one card has no meaningful choice to make, and a renewal
                    // needs a default to exist.
                    IsDefault = existing.Count == 0,
                    Status = PaymentMethodStatuses.Active,
                    CreatedAtUtc = utcNow,
                    UpdatedAtUtc = utcNow,
                },
                cancellationToken)
            .ConfigureAwait(false);

        return PaymentMethodResult.Success(paymentMethodId);
    }

    public async Task<PaymentMethodResult> SetDefaultAsync(
        string tenantGroupId,
        string paymentMethodId,
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(tenantGroupId) ||
            string.IsNullOrWhiteSpace(paymentMethodId))
        {
            return PaymentMethodResult.Failed(PaymentMethodFailures.NotFound);
        }

        var changed = await _repository
            .SetDefaultAsync(
                tenantGroupId,
                paymentMethodId,
                _time.GetUtcNow().UtcDateTime,
                cancellationToken)
            .ConfigureAwait(false);

        return changed
            ? PaymentMethodResult.Success(paymentMethodId)
            : PaymentMethodResult.Failed(PaymentMethodFailures.NotFound);
    }

    public async Task<PaymentMethodResult> RemoveAsync(
        string tenantGroupId,
        string paymentMethodId,
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(tenantGroupId) ||
            string.IsNullOrWhiteSpace(paymentMethodId))
        {
            return PaymentMethodResult.Failed(PaymentMethodFailures.NotFound);
        }

        var utcNow = _time.GetUtcNow().UtcDateTime;

        var wasDefault = await _repository
            .GetAsync(tenantGroupId, paymentMethodId, cancellationToken)
            .ConfigureAwait(false) is { IsDefault: true };

        var removed = await _repository
            .MarkRemovedAsync(tenantGroupId, paymentMethodId, utcNow, cancellationToken)
            .ConfigureAwait(false);

        if (!removed)
        {
            return PaymentMethodResult.Failed(PaymentMethodFailures.NotFound);
        }

        // The row is already gone from the tenant's view, so a vault failure here must not fail
        // the call. It leaves a secret nothing points at, which the next attach does not reuse.
        try
        {
            await _secrets
                .DeleteAsync(tenantGroupId, paymentMethodId, cancellationToken)
                .ConfigureAwait(false);
        }
        catch (Exception exception) when (exception is not OperationCanceledException)
        {
            _logger.LogError(
                exception,
                "Card {PaymentMethodId} was detached but its vault secret was not deleted.",
                paymentMethodId);
        }

        if (wasDefault)
        {
            // Leaving a tenant with cards but no default would silently break the next renewal.
            var remaining = await _repository
                .ListAsync(tenantGroupId, cancellationToken)
                .ConfigureAwait(false);

            var promoted = remaining.FirstOrDefault();

            if (promoted is not null)
            {
                await _repository
                    .SetDefaultAsync(tenantGroupId, promoted.ItemId, utcNow, cancellationToken)
                    .ConfigureAwait(false);
            }
        }

        return PaymentMethodResult.Success(paymentMethodId);
    }

    public async Task<CardSecret?> GetDefaultChargeSecretAsync(
        string tenantGroupId,
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(tenantGroupId))
        {
            return null;
        }

        var method = await _repository
            .GetDefaultAsync(tenantGroupId, cancellationToken)
            .ConfigureAwait(false);

        if (method is null)
        {
            return null;
        }

        return await _secrets
            .ReadAsync(tenantGroupId, method.ItemId, cancellationToken)
            .ConfigureAwait(false);
    }

    private static PaymentMethodView ToView(
        TenantPaymentMethod method,
        DateTime utcNow) =>
        new()
        {
            PaymentMethodId = method.ItemId,
            ProviderName = method.ProviderName,
            Brand = method.Brand,
            LastFour = method.LastFour,
            ExpiryMonth = method.ExpiryMonth,
            ExpiryYear = method.ExpiryYear,
            IsDefault = method.IsDefault,
            IsExpired = method.IsExpiredAt(utcNow),
            AddedByUserId = method.AddedByUserId,
            CreatedAtUtc = method.CreatedAtUtc,
            LastChargedAtUtc = method.LastChargedAtUtc,
        };

    /// <summary>
    /// Rejects a plainly impossible expiry. Whether the card is live is the provider's answer,
    /// not ours, so this only catches a malformed callback.
    /// </summary>
    private static bool IsPlausibleExpiry(int month, int year) =>
        month is >= 1 and <= 12 && year is >= 2000 and <= 2100;
}
