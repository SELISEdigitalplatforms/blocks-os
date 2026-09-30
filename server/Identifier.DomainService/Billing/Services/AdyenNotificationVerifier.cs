using System.Globalization;
using System.Security.Cryptography;
using System.Text;

namespace DomainService.Billing.Services;

/// <summary>
/// One item from an Adyen notification batch, reduced to what we act on.
/// </summary>
public sealed class AdyenNotificationItem
{
    public string EventCode { get; set; } = string.Empty;

    /// <summary>Adyen's own id for the event. What makes redelivery safe to ignore.</summary>
    public string PspReference { get; set; } = string.Empty;

    public string OriginalReference { get; set; } = string.Empty;

    /// <summary>Our order id, sent as the reference on the charge.</summary>
    public string MerchantReference { get; set; } = string.Empty;

    public string MerchantAccountCode { get; set; } = string.Empty;
    public long AmountValue { get; set; }
    public string AmountCurrency { get; set; } = string.Empty;
    public bool Success { get; set; }
    public string Reason { get; set; } = string.Empty;
    public string HmacSignature { get; set; } = string.Empty;

    /// <summary>Everything else Adyen sent, for the events that carry card details.</summary>
    public Dictionary<string, string> AdditionalData { get; set; } = new(StringComparer.Ordinal);
}

public static class AdyenEventCodes
{
    public const string Authorisation = "AUTHORISATION";

    /// <summary>A card was stored. Carries the token a later charge uses.</summary>
    public const string RecurringContract = "RECURRING_CONTRACT";
}

public interface IAdyenNotificationVerifier
{
    /// <summary>
    /// True when the item's signature was produced by our HMAC key.
    /// </summary>
    /// <remarks>
    /// The notification endpoint is unauthenticated — Adyen calls it with no token of ours — so
    /// this signature is the <b>only</b> thing separating a real event from anyone who can reach
    /// the URL. An item that does not verify is discarded, never acted on.
    /// </remarks>
    bool IsAuthentic(AdyenNotificationItem item, string hmacKey);
}

public sealed class AdyenNotificationVerifier : IAdyenNotificationVerifier
{
    public bool IsAuthentic(AdyenNotificationItem item, string hmacKey)
    {
        if (item is null
            || string.IsNullOrWhiteSpace(hmacKey)
            || string.IsNullOrWhiteSpace(item.HmacSignature))
        {
            return false;
        }

        byte[] key;

        try
        {
            key = Convert.FromHexString(hmacKey);
        }
        catch (FormatException)
        {
            return false;
        }

        try
        {
            var payload = SigningString(item);
            using var hmac = new HMACSHA256(key);
            var computed = Convert.ToBase64String(hmac.ComputeHash(Encoding.UTF8.GetBytes(payload)));

            // Constant time: a length-or-content comparison leaks how much of a forged signature
            // was right, which is enough to build one byte by byte.
            return CryptographicOperations.FixedTimeEquals(
                Encoding.UTF8.GetBytes(computed),
                Encoding.UTF8.GetBytes(item.HmacSignature));
        }
        catch (CryptographicException)
        {
            return false;
        }
        finally
        {
            CryptographicOperations.ZeroMemory(key);
        }
    }

    /// <summary>
    /// The eight fields Adyen signs, in its order, colon-separated.
    /// </summary>
    /// <remarks>
    /// Backslashes and colons inside a value are escaped first. Without that, a merchant reference
    /// containing a colon would shift every later field and the signature would never match — or,
    /// worse, two different notifications would sign identically.
    /// </remarks>
    private static string SigningString(AdyenNotificationItem item) =>
        string.Join(':', new[]
        {
            item.PspReference,
            item.OriginalReference,
            item.MerchantAccountCode,
            item.MerchantReference,
            item.AmountValue.ToString(CultureInfo.InvariantCulture),
            item.AmountCurrency,
            item.EventCode,
            item.Success ? "true" : "false",
        }.Select(Escape));

    private static string Escape(string? value) =>
        (value ?? string.Empty).Replace("\\", "\\\\", StringComparison.Ordinal)
            .Replace(":", "\\:", StringComparison.Ordinal);
}
