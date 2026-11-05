using Blocks.Genesis;

namespace Configuration.DomainService.Actions;

/// <summary>One action of the root catalog as the Actions page shows it, with the tenant's flags.</summary>
public sealed record ActionView(
    string Name,
    string Label,
    string Service,
    IReadOnlyDictionary<string, string> Payload,
    bool Workflow,
    bool Function,
    bool Webhook)
{
    public static ActionView From(ActionDefinition definition)
    {
        ArgumentNullException.ThrowIfNull(definition);
        return new ActionView(
            definition.Name,
            definition.Label,
            definition.Service,
            definition.Payload ?? [],
            definition.Workflow,
            definition.Function,
            definition.Webhook);
    }
}

/// <summary>Turns one target of one action on or off.</summary>
public sealed class UpdateActionRequest
{
    public string Name { get; set; } = string.Empty;

    /// <summary><c>workflow</c>, <c>function</c> or <c>webhook</c> (any case).</summary>
    public string Target { get; set; } = string.Empty;

    public bool Enabled { get; set; }
}

/// <summary>Error codes the Actions API returns.</summary>
public static class ActionErrorCodes
{
    public const string ActionNotFound = "ACTION_NOT_FOUND";
    public const string ActionsNotSeeded = "ACTIONS_NOT_SEEDED";
    public const string InvalidTarget = "INVALID_TARGET";
    public const string UpdateConflict = "ACTION_UPDATE_CONFLICT";
}

/// <summary>Maps a request target to the stored flag field. One entry per target.</summary>
public static class ActionTargets
{
    private static readonly Dictionary<string, string> FlagFields = new(StringComparer.OrdinalIgnoreCase)
    {
        ["workflow"] = nameof(ActionDefinition.Workflow),
        ["function"] = nameof(ActionDefinition.Function),
        ["webhook"] = nameof(ActionDefinition.Webhook)
    };

    public static string? FlagField(string? target) =>
        target is not null && FlagFields.TryGetValue(target.Trim(), out var field) ? field : null;
}
