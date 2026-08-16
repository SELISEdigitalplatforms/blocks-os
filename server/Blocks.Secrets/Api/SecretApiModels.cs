namespace Blocks.Secrets;

/// <summary>Identifies a single secret. Used by the lifecycle endpoints.</summary>
public sealed class SecretIdRequest
{
    public string SecretId { get; set; } = string.Empty;
}

public sealed class UpdateSecretApiRequest
{
    public string SecretId { get; set; } = string.Empty;

    public string? Name { get; set; }

    public string? Description { get; set; }
}

public sealed class RotateSecretApiRequest
{
    public string SecretId { get; set; } = string.Empty;

    public string Value { get; set; } = string.Empty;
}

public sealed class UpdateSecretAccessApiRequest
{
    public string SecretId { get; set; } = string.Empty;

    public SecretAccess Access { get; set; } = new();
}

public sealed class GetSecretValuesApiRequest
{
    public IReadOnlyCollection<string> SecretIds { get; set; } = Array.Empty<string>();
}

/// <summary>Envelope for a newly created secret. Carries the id, never the value.</summary>
public sealed class SetSecretApiResponse
{
    public string SecretId { get; set; } = string.Empty;
}

/// <summary>Envelope for a batch create: name to secret id.</summary>
public sealed class SetManySecretsApiResponse
{
    public IReadOnlyDictionary<string, string> SecretIds { get; set; } =
        new Dictionary<string, string>(StringComparer.Ordinal);
}

/// <summary>
/// Envelope for a plaintext read.
/// </summary>
/// <remarks>
/// The only response type in the API that carries a secret value. Its endpoint sets
/// <c>Cache-Control: no-store</c>.
/// </remarks>
public sealed class SecretValueApiResponse
{
    public string SecretId { get; set; } = string.Empty;

    public string Value { get; set; } = string.Empty;
}

/// <summary>Envelope for a batch plaintext read.</summary>
public sealed class SecretValuesApiResponse
{
    public IReadOnlyDictionary<string, string> Values { get; set; } =
        new Dictionary<string, string>(StringComparer.Ordinal);
}
