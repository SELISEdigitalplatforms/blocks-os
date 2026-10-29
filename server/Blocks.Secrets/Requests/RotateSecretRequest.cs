namespace Blocks.Secrets;

public sealed class RotateSecretRequest
{
    /// <summary>The new plaintext value.</summary>
    public string Value { get; set; } = string.Empty;
}
