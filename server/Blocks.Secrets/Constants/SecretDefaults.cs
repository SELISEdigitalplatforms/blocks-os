namespace Blocks.Secrets;

/// <summary>
/// Fixed limits and policy values for the secret domain.
/// </summary>
public static class SecretDefaults
{
    /// <summary>Azure Key Vault caps secret values at 25 KB.</summary>
    public const int MaxValueLengthBytes = 25 * 1024;

    /// <summary>Upper bound on items in a <c>SetManyAsync</c> or <c>GetValuesAsync</c> call.</summary>
    public const int MaxBatchSize = 50;

    /// <summary>Audit retention, enforced by a TTL index on the audit collection.</summary>
    public const int AuditRetentionDays = 365;

    /// <summary>Prefix for derived vault keys. Must satisfy Key Vault's [0-9a-zA-Z-] rule.</summary>
    public const string VaultKeyPrefix = "blocks-secret";

    /// <summary>Largest page any list endpoint will return.</summary>
    public const int MaxPageSize = 100;
}
