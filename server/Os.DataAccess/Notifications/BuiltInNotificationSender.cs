using System.Text.Json;
using System.Text.Json.Serialization;
using Blocks.Genesis;
using Blocks.Genesis.Notifications;
using Microsoft.Extensions.Logging;

namespace Os.DataAccess.Notifications;

/// <summary>Names of the built-in notification configurations blocks-os sends. Must match the seed exactly.</summary>
public static class BuiltInNotificationNames
{
    public const string DataMigrationFailed = "os-data-migration-failed";
    public const string ProjectSetupFailed = "os-project-setup-failed";
    public const string ProjectMemberRemoved = "os-project-member-removed";
    public const string ProjectOwnershipTransferred = "os-project-ownership-transferred";
    public const string ProjectAccessChanged = "os-project-access-changed";
    public const string CustomDomainStatus = "os-custom-domain-status";
}

/// <summary>
/// One built-in notification. The payload carries ids and short text only — never values, passwords,
/// tokens, certificate content, error messages or other people's emails.
/// </summary>
public sealed class BuiltInNotification
{
    public required string ConfigurationName { get; init; }
    public required string Event { get; init; }
    public required string Title { get; init; }
    public string Description { get; init; } = string.Empty;
    public bool? IsSuccess { get; init; }

    /// <summary>Entity ids added to the payload under their own key. Null values are left out.</summary>
    public IReadOnlyDictionary<string, string?> Ids { get; init; } = new Dictionary<string, string?>();

    /// <summary>Recipients. Blank ids and duplicates are dropped; none left means nothing is sent.</summary>
    public IEnumerable<string?> UserIds { get; init; } = [];

    /// <summary>
    /// Tenant to send in. Null: the caller's tenant (<c>OriginalTenantId</c>, else <c>TenantId</c>) from the context.
    /// </summary>
    public string? TenantId { get; init; }

    /// <summary>Organization of the send. Null: the organization of the caller's token when the send is in the token's tenant.</summary>
    public string? OrganizationId { get; init; }
}

/// <summary>Queues a built-in notification with the Genesis notification publisher. Best effort: never throws.</summary>
public interface IBuiltInNotificationSender
{
    /// <returns>True when the notification was queued (the publisher decides receivers and channels from the saved config).</returns>
    Task<bool> SendAsync(BuiltInNotification notification, CancellationToken cancellationToken = default);
}

/// <inheritdoc />
public sealed class BuiltInNotificationSender : IBuiltInNotificationSender
{
    private static readonly JsonSerializerOptions PayloadJson = new() { DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull };

    private readonly INotificationPublisher _publisher;
    private readonly ILogger<BuiltInNotificationSender> _logger;

    public BuiltInNotificationSender(INotificationPublisher publisher, ILogger<BuiltInNotificationSender> logger)
    {
        _publisher = publisher;
        _logger = logger;
    }

    public Task<bool> SendAsync(BuiltInNotification notification, CancellationToken cancellationToken = default)
    {
        var name = notification?.ConfigurationName ?? string.Empty;

        try
        {
            ArgumentNullException.ThrowIfNull(notification);
            var context = BlocksContext.GetContext();

            var tenantId = ResolveTenantId(notification.TenantId, context);
            if (string.IsNullOrWhiteSpace(tenantId))
            {
                _logger.LogDebug("Built-in notification {ConfigurationName} skipped: no tenant", name);
                return Task.FromResult(false);
            }

            // Publish returns at once and never throws; the receivers and channels come from the saved configuration.
            _publisher.Publish(new NotificationRequest
            {
                Name = name,
                TenantId = tenantId,
                OrganizationId = notification.OrganizationId ?? ContextOrganization(context, tenantId),
                NamedUserIds = NamedUsers(notification, context),
                Payload = BuildPayload(notification),
                ResponseKey = name,
                ResponseValue = notification.Event
            });

            return Task.FromResult(true);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Built-in notification {ConfigurationName} not sent: {Status}", name, ex.GetType().Name);
            return Task.FromResult(false);
        }
    }

    /// <summary>
    /// The recipients the code names, plus the acting root user when a console user is impersonating a project:
    /// that user is not a member of the project's own user list, so only a named id reaches them.
    /// </summary>
    private static List<string> NamedUsers(BuiltInNotification notification, BlocksContext? context)
    {
        IEnumerable<string?> ids = notification.UserIds;
        if (context is { Impersonated: true })
        {
            ids = ids.Append(context.UserId);
        }

        return ids
            .Where(id => !string.IsNullOrWhiteSpace(id))
            .Select(id => id!)
            .Distinct(StringComparer.Ordinal)
            .ToList();
    }

    /// <summary>The JSON string the Notifier stores and pushes: <c>{event, title, description, isSuccess?, ids…, occurredAt}</c>.</summary>
    public static string BuildPayload(BuiltInNotification notification)
    {
        var payload = new Dictionary<string, object?>
        {
            ["event"] = notification.Event,
            ["title"] = notification.Title,
            ["description"] = notification.Description
        };

        if (notification.IsSuccess.HasValue)
        {
            payload["isSuccess"] = notification.IsSuccess.Value;
        }

        foreach (var (key, value) in notification.Ids)
        {
            if (value is not null && !payload.ContainsKey(key))
            {
                payload[key] = value;
            }
        }

        payload["occurredAt"] = DateTime.UtcNow;
        return JsonSerializer.Serialize(payload, PayloadJson);
    }

    /// <summary>
    /// The token's organization, only when the send stays in the token's tenant. A console user acting in a project
    /// sends in the root tenant; the project's organization there would filter out every root user.
    /// </summary>
    private static string? ContextOrganization(BlocksContext? context, string tenantId) =>
        context is not null && string.Equals(context.TenantId, tenantId, StringComparison.Ordinal) ? context.OrganizationId : null;

    private static string ResolveTenantId(string? explicitTenantId, BlocksContext? context)
    {
        if (!string.IsNullOrWhiteSpace(explicitTenantId))
        {
            return explicitTenantId;
        }

        if (!string.IsNullOrWhiteSpace(context?.OriginalTenantId))
        {
            return context.OriginalTenantId;
        }

        return context?.TenantId ?? string.Empty;
    }
}
