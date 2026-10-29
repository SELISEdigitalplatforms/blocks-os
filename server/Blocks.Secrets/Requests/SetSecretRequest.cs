namespace Blocks.Secrets;

public sealed class SetSecretRequest
{
    public string Name { get; set; } = string.Empty;

    public string? Description { get; set; }

    /// <summary>Labels for grouping and lookup. Normalized and de-duplicated on write.</summary>
    public IReadOnlyCollection<string>? Tags { get; set; }

    /// <summary>Plaintext. Goes to the vault and is never persisted to Mongo.</summary>
    public string Value { get; set; } = string.Empty;

    public string Type { get; set; } = SecretTypes.Api;

    /// <summary>Ignored for <see cref="SecretTypes.Service"/> secrets.</summary>
    public SecretAccess? Access { get; set; }

    /// <summary>Defaults to the calling context's organization.</summary>
    public string? OrganizationId { get; set; }
}
