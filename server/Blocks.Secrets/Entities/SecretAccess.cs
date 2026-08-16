namespace Blocks.Secrets;

/// <summary>
/// Per-secret access list. Applies to <see cref="SecretTypes.Api"/> secrets only.
/// </summary>
/// <remarks>
/// An empty access list does not mean "everyone" — it means nobody but the creator and root.
/// See <c>SecretAuthorizationService</c>.
/// </remarks>
public class SecretAccess
{
    public List<string> UserIds { get; set; } = new();
    public List<string> Roles { get; set; } = new();

    public bool IsEmpty => UserIds.Count == 0 && Roles.Count == 0;
}
