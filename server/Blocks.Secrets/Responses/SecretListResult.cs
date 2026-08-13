namespace Blocks.Secrets;

public sealed class SecretListResult
{
    public IReadOnlyList<SecretResult> Data { get; set; } = Array.Empty<SecretResult>();

    public long TotalCount { get; set; }
}
