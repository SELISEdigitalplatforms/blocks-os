using System.Text.Json;
using Blocks.Secrets;
using Microsoft.Extensions.Logging;

namespace DomainService.Billing.Services;

/// <summary>The platform's own Adyen merchant account, read from the vault.</summary>
public sealed class AdyenSettings
{
    public string MerchantAccount { get; set; } = string.Empty;
    public string ApiKey { get; set; } = string.Empty;

    /// <summary>Adyen's checkout endpoint. The live one is account-specific, so it is configured.</summary>
    public string ApiBaseUrl { get; set; } = string.Empty;

    /// <summary>Verifies the signature on every notification. Without it, webhooks are refused.</summary>
    public string HmacKey { get; set; } = string.Empty;

    /// <summary>
    /// Public by design — it goes to the browser so the card component can talk to Adyen directly.
    /// Not a secret, but it lives with them because it is configured with them.
    /// </summary>
    public string ClientKey { get; set; } = string.Empty;

    /// <summary>True for a real merchant account that moves real money.</summary>
    public bool IsLive { get; set; }

    public bool IsUsable =>
        !string.IsNullOrWhiteSpace(MerchantAccount)
        && !string.IsNullOrWhiteSpace(ApiKey)
        && !string.IsNullOrWhiteSpace(ApiBaseUrl);
}

public interface IAdyenConfiguration
{
    Task<AdyenSettings> GetAsync(CancellationToken cancellationToken = default);
}

/// <summary>
/// Reads the Adyen settings from the platform secret store and caches them.
/// </summary>
/// <remarks>
/// One secret, one merchant account, per environment. A non-production deployment points at
/// Adyen's test account; only production holds live credentials.
/// <para>
/// Startup refuses live credentials outside production. It is the one mistake worth being
/// pedantic about: a staging deployment pointed at the live account charges real cards, and
/// nothing about that failure is obvious until a customer complains.
/// </para>
/// </remarks>
public sealed class AdyenConfiguration : IAdyenConfiguration
{
    public const string SecretId = "billing-adyen";

    private static readonly JsonSerializerOptions SerializerOptions = new() { PropertyNameCaseInsensitive = true };

    private readonly ISecretValueStore _secrets;
    private readonly ILogger<AdyenConfiguration> _logger;
    private readonly bool _isProduction;
    private readonly SemaphoreSlim _gate = new(1, 1);

    private AdyenSettings? _cached;

    public AdyenConfiguration(ISecretValueStore secrets, ILogger<AdyenConfiguration> logger, bool isProduction)
    {
        _secrets = secrets;
        _logger = logger;
        _isProduction = isProduction;
    }

    public async Task<AdyenSettings> GetAsync(CancellationToken cancellationToken = default)
    {
        if (_cached is not null)
        {
            return _cached;
        }

        await _gate.WaitAsync(cancellationToken).ConfigureAwait(false);

        try
        {
            return _cached ??= await LoadAsync(cancellationToken).ConfigureAwait(false);
        }
        finally
        {
            _gate.Release();
        }
    }

    private async Task<AdyenSettings> LoadAsync(CancellationToken cancellationToken)
    {
        string? stored;

        try
        {
            stored = await _secrets.GetAsync(SecretId, cancellationToken).ConfigureAwait(false);
        }
        catch (Exception exception)
        {
            // Unreachable vault is not "no Adyen": it is "we do not know", and the gateway turns
            // an unusable configuration into an Unknown charge outcome rather than a decline.
            _logger.LogError(exception, "The Adyen configuration could not be read from the vault.");
            return new AdyenSettings();
        }

        if (string.IsNullOrWhiteSpace(stored))
        {
            _logger.LogWarning("No Adyen configuration at {SecretId}; billing is inert.", SecretId);
            return new AdyenSettings();
        }

        AdyenSettings? settings;

        try
        {
            settings = JsonSerializer.Deserialize<AdyenSettings>(stored, SerializerOptions);
        }
        catch (JsonException)
        {
            // Without the exception: its message can quote the payload, which holds the API key.
            _logger.LogError("The Adyen configuration at {SecretId} is not valid JSON.", SecretId);
            return new AdyenSettings();
        }

        if (settings is null)
        {
            return new AdyenSettings();
        }

        if (settings.IsLive && !_isProduction)
        {
            _logger.LogCritical(
                "Live Adyen credentials found outside production. Billing is disabled rather than charging real cards.");
            return new AdyenSettings();
        }

        _logger.LogInformation(
            "Adyen ready: merchant {MerchantAccount}, {Mode}.",
            settings.MerchantAccount,
            settings.IsLive ? "live" : "test");

        return settings;
    }
}
