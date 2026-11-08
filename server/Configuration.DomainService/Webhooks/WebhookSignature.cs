using System.Security.Cryptography;
using System.Text;

namespace Configuration.DomainService.Webhooks;

/// <summary>
/// Standard Webhooks signing (standardwebhooks.com): <c>v1,</c> + base64 HMAC-SHA256 of <c>{id}.{timestamp}.{body}</c>.
/// A secret starting with <c>whsec_</c> is base64 key material; any other secret is used as its UTF-8 bytes.
/// </summary>
public static class WebhookSignature
{
    public const string SecretPrefix = "whsec_";
    public const string IdHeader = "webhook-id";
    public const string TimestampHeader = "webhook-timestamp";
    public const string SignatureHeader = "webhook-signature";
    public const int MinSecretLength = 32;

    /// <exception cref="FormatException">A <c>whsec_</c> secret whose rest is not base64.</exception>
    public static string Sign(string secret, string id, long timestamp, string body)
    {
        ArgumentNullException.ThrowIfNull(secret);
        var key = KeyOf(secret);
        var content = Encoding.UTF8.GetBytes($"{id}.{timestamp}.{body}");
        return "v1," + Convert.ToBase64String(HMACSHA256.HashData(key, content));
    }

    /// <summary>True when the secret is long enough and, for a <c>whsec_</c> secret, its key is valid base64.</summary>
    public static bool IsUsable(string? secret)
    {
        if (secret is null || secret.Length < MinSecretLength)
        {
            return false;
        }

        if (!secret.StartsWith(SecretPrefix, StringComparison.Ordinal))
        {
            return true;
        }

        var buffer = new byte[secret.Length];
        return Convert.TryFromBase64String(secret[SecretPrefix.Length..], buffer, out var written) && written > 0;
    }

    private static byte[] KeyOf(string secret) =>
        secret.StartsWith(SecretPrefix, StringComparison.Ordinal)
            ? Convert.FromBase64String(secret[SecretPrefix.Length..])
            : Encoding.UTF8.GetBytes(secret);
}
