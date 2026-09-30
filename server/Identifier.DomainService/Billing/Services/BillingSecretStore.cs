using System.Text;
using System.Text.Json;
using Blocks.Secrets;
using Microsoft.Extensions.Logging;

namespace DomainService.Billing.Services;

/// <summary>
/// The parts of a saved card that must not sit in a database.
/// </summary>
/// <remarks>
/// Not the card itself. The card number and security code never reach this service at all — the
/// browser sends them straight to the payment provider, which returns a token standing for the
/// card. That token, and the provider customer it hangs off, are what have to be protected: with
/// them a charge can be raised, so they live in Key Vault and nowhere else.
/// </remarks>
public sealed class CardSecret
{
    public string ProviderToken { get; set; } = string.Empty;

    public string ProviderCustomerId { get; set; } = string.Empty;
}

public interface IBillingSecretStore
{
    Task SaveAsync(
        string tenantGroupId,
        string paymentMethodId,
        CardSecret secret,
        CancellationToken cancellationToken = default);

    /// <summary>Null when the vault holds nothing under this id. Throws when the vault is unreachable.</summary>
    Task<CardSecret?> ReadAsync(
        string tenantGroupId,
        string paymentMethodId,
        CancellationToken cancellationToken = default);

    Task DeleteAsync(
        string tenantGroupId,
        string paymentMethodId,
        CancellationToken cancellationToken = default);
}

/// <summary>
/// Keeps card secrets in Key Vault, through the platform's existing secret store.
/// </summary>
/// <remarks>
/// <see cref="ISecretValueStore"/> is reused rather than reimplemented: it already owns the vault
/// client, the credential chain, soft-delete semantics and the rule that a failed read throws
/// instead of returning null. One secret per card, named from the tenant and the payment method,
/// so a project's secrets can be listed and revoked as a set.
/// </remarks>
public sealed class BillingSecretStore : IBillingSecretStore
{
    /// <summary>
    /// Distinguishes these from the configuration secrets that share the store's vault prefix,
    /// which are named after a repository rather than a project.
    /// </summary>
    public const string SecretIdPrefix = "billing-pm";

    private static readonly JsonSerializerOptions SerializerOptions =
        new() { PropertyNameCaseInsensitive = true };

    private readonly ISecretValueStore _values;
    private readonly ILogger<BillingSecretStore> _logger;

    public BillingSecretStore(
        ISecretValueStore values,
        ILogger<BillingSecretStore> logger)
    {
        _values = values;
        _logger = logger;
    }

    /// <summary>
    /// The vault name for one card. Deterministic, so a card can be found again from its row
    /// alone, and reduced to the characters Key Vault accepts in a name.
    /// </summary>
    public static string SecretIdFor(string tenantGroupId, string paymentMethodId) =>
        $"{SecretIdPrefix}-{Sanitise(tenantGroupId)}-{Sanitise(paymentMethodId)}";

    public async Task SaveAsync(
        string tenantGroupId,
        string paymentMethodId,
        CardSecret secret,
        CancellationToken cancellationToken = default)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(tenantGroupId);
        ArgumentException.ThrowIfNullOrWhiteSpace(paymentMethodId);
        ArgumentNullException.ThrowIfNull(secret);

        await _values
            .SetAsync(
                SecretIdFor(tenantGroupId, paymentMethodId),
                JsonSerializer.Serialize(secret),
                cancellationToken)
            .ConfigureAwait(false);
    }

    public async Task<CardSecret?> ReadAsync(
        string tenantGroupId,
        string paymentMethodId,
        CancellationToken cancellationToken = default)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(tenantGroupId);
        ArgumentException.ThrowIfNullOrWhiteSpace(paymentMethodId);

        var stored = await _values
            .GetAsync(SecretIdFor(tenantGroupId, paymentMethodId), cancellationToken)
            .ConfigureAwait(false);

        if (string.IsNullOrWhiteSpace(stored))
        {
            return null;
        }

        try
        {
            return JsonSerializer.Deserialize<CardSecret>(stored, SerializerOptions);
        }
        catch (JsonException)
        {
            // Without the exception object: its message quotes the payload it failed on.
            _logger.LogError(
                "Card secret for payment method {PaymentMethodId} is not valid JSON.",
                paymentMethodId);
            return null;
        }
    }

    public async Task DeleteAsync(
        string tenantGroupId,
        string paymentMethodId,
        CancellationToken cancellationToken = default)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(tenantGroupId);
        ArgumentException.ThrowIfNullOrWhiteSpace(paymentMethodId);

        await _values
            .DeleteAsync(SecretIdFor(tenantGroupId, paymentMethodId), cancellationToken)
            .ConfigureAwait(false);
    }

    /// <summary>
    /// Key Vault names admit only letters, digits and dashes. Anything else becomes a dash, which
    /// cannot collide in practice because the inputs are generated ids, not free text.
    /// </summary>
    private static string Sanitise(string value)
    {
        var builder = new StringBuilder(value.Length);

        foreach (var character in value)
        {
            builder.Append(char.IsAsciiLetterOrDigit(character) ? character : '-');
        }

        return builder.ToString();
    }
}
