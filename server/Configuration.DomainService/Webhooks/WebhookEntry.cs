using MongoDB.Bson.Serialization.Attributes;

namespace Configuration.DomainService.Webhooks;

/// <summary>
/// One webhook in the tenant's <c>webhooks</c> KV list. The secret value is never here: <see cref="SecretRef"/> is the
/// id of the Blocks secret that holds it.
/// </summary>
[BsonNoId]
[BsonIgnoreExtraElements]
public sealed class WebhookEntry
{
    public string Id { get; set; } = string.Empty;

    public string Name { get; set; } = string.Empty;

    /// <summary>Upper-case trimmed name; makes the per-tenant name check case-insensitive inside one atomic update.</summary>
    public string NameKey { get; set; } = string.Empty;

    public string Url { get; set; } = string.Empty;

    public string SecretRef { get; set; } = string.Empty;

    public bool IsActive { get; set; }

    public List<string> Actions { get; set; } = [];

    public DateTime CreatedDate { get; set; }

    public string? CreatedBy { get; set; }

    public DateTime? SecretChangedDate { get; set; }

    public int ConsecutiveFailures { get; set; }

    public string? DisabledReason { get; set; }

    public static string KeyOf(string name) => name.Trim().ToUpperInvariant();
}
