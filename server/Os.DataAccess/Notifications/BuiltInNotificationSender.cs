using System.Text.Json;
using System.Text.Json.Serialization;
using Blocks.Genesis;
using Microsoft.Extensions.Configuration;
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
    public const string ProjectDisabledOrDeleted = "os-project-disabled-or-deleted";
    public const string LmtRestoreProgress = "os-lmt-restore-progress";
    public const string SecretChanged = "os-secret-changed";
    public const string CertificateChanged = "os-certificate-changed";
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

    public string? ConnectionId { get; init; }
}

/// <summary>Sends a built-in notification to the Notifier. Best effort: never throws.</summary>
public interface IBuiltInNotificationSender
{
    /// <returns>True only when the Notifier accepted the notification.</returns>
    Task<bool> SendAsync(BuiltInNotification notification, CancellationToken cancellationToken = default);
}

/// <inheritdoc />
public sealed class BuiltInNotificationSender : IBuiltInNotificationSender
{
    /// <summary>Config key holding the Notifier send URL (the same key the migration notifications read).</summary>
    public const string UrlConfigKey = "NotificationServiceUrl";

    /// <summary>Longest time an action waits for the Notifier.</summary>
    public static readonly TimeSpan Timeout = TimeSpan.FromSeconds(5);

    private static readonly JsonSerializerOptions PayloadJson = new() { DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull };

    private readonly IHttpService _httpService;
    private readonly ICryptoService _cryptoService;
    private readonly ITenants _tenants;
    private readonly IConfiguration _configuration;
    private readonly ILogger<BuiltInNotificationSender> _logger;

    public BuiltInNotificationSender(
        IHttpService httpService,
        ICryptoService cryptoService,
        ITenants tenants,
        IConfiguration configuration,
        ILogger<BuiltInNotificationSender> logger)
    {
        _httpService = httpService;
        _cryptoService = cryptoService;
        _tenants = tenants;
        _configuration = configuration;
        _logger = logger;
    }

    public async Task<bool> SendAsync(BuiltInNotification notification, CancellationToken cancellationToken = default)
    {
        var name = notification?.ConfigurationName ?? string.Empty;
        var tenantId = string.Empty;

        try
        {
            ArgumentNullException.ThrowIfNull(notification);
            tenantId = ResolveTenantId(notification.TenantId);

            var userIds = notification.UserIds
                .Where(id => !string.IsNullOrWhiteSpace(id))
                .Select(id => id!)
                .Distinct(StringComparer.Ordinal)
                .ToList();

            if (userIds.Count == 0)
            {
                _logger.LogDebug("Built-in notification {ConfigurationName} for tenant {TenantId} skipped: no recipient", name, tenantId);
                return false;
            }

            if (string.IsNullOrWhiteSpace(tenantId))
            {
                _logger.LogDebug("Built-in notification {ConfigurationName} skipped: no tenant", name);
                return false;
            }

            var url = _configuration[UrlConfigKey];
            if (string.IsNullOrWhiteSpace(url))
            {
                _logger.LogWarning("Built-in notification {ConfigurationName} for tenant {TenantId} not sent: {Status}", name, tenantId, "url-not-configured");
                return false;
            }

            var tenant = _tenants.GetTenantByID(tenantId);
            if (tenant is null)
            {
                _logger.LogWarning("Built-in notification {ConfigurationName} for tenant {TenantId} not sent: {Status}", name, tenantId, "unknown-tenant");
                return false;
            }

            var request = new NotifierRequest
            {
                ConnectionId = notification.ConnectionId ?? string.Empty,
                UserIds = userIds,
                DenormalizedPayload = BuildPayload(notification),
                ConfigurationName = name,
                ResponseKey = name,
                ResponseValue = notification.Event
            };

            var headers = new Dictionary<string, string>
            {
                { "x-blocks-key", tenantId },
                { "Secret", _cryptoService.Hash(tenantId, tenant.TenantSalt) }
            };

            using var timeout = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
            timeout.CancelAfter(Timeout);

            var sendTask = _httpService.Post<NotifierResponse>(
                request, url, "application/json", headers, timeout.Token, (int)Timeout.TotalSeconds);

            // Also bounds an HTTP layer that ignores the token.
            var finished = await Task.WhenAny(sendTask, Task.Delay(Timeout, timeout.Token)).ConfigureAwait(false);
            if (finished != sendTask)
            {
                ObserveLater(sendTask);
                _logger.LogWarning("Built-in notification {ConfigurationName} for tenant {TenantId} not sent: {Status}", name, tenantId, "timeout");
                return false;
            }

            var (response, _) = await sendTask.ConfigureAwait(false);
            if (response is { isSuccess: true })
            {
                _logger.LogInformation("Built-in notification {ConfigurationName} sent for tenant {TenantId}", name, tenantId);
                return true;
            }

            _logger.LogWarning("Built-in notification {ConfigurationName} for tenant {TenantId} not sent: {Status}", name, tenantId, "rejected");
            return false;
        }
        catch (OperationCanceledException)
        {
            _logger.LogWarning("Built-in notification {ConfigurationName} for tenant {TenantId} not sent: {Status}", name, tenantId, "timeout");
            return false;
        }
        catch (Exception ex)
        {
            // Type only: a message could carry request details.
            _logger.LogWarning("Built-in notification {ConfigurationName} for tenant {TenantId} not sent: {Status}", name, tenantId, ex.GetType().Name);
            return false;
        }
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

    private static string ResolveTenantId(string? explicitTenantId)
    {
        if (!string.IsNullOrWhiteSpace(explicitTenantId))
        {
            return explicitTenantId;
        }

        var context = BlocksContext.GetContext();
        if (!string.IsNullOrWhiteSpace(context?.OriginalTenantId))
        {
            return context.OriginalTenantId;
        }

        return context?.TenantId ?? string.Empty;
    }

    private static void ObserveLater(Task task) =>
        _ = task.ContinueWith(t => _ = t.Exception, TaskScheduler.Default);

    /// <summary>Body of the Notifier send endpoint. Typed so a misspelled field cannot compile.</summary>
    public sealed class NotifierRequest
    {
        public string ConnectionId { get; set; } = string.Empty;
        public List<string> Roles { get; set; } = [];
        public List<string> UserIds { get; set; } = [];
        public string DenormalizedPayload { get; set; } = string.Empty;
        public bool SaveDenormalizedPayloadAsAnObject { get; set; }
        public string ConfigurationName { get; set; } = string.Empty;
        public bool ContentAvailable { get; set; } = true;
        public string ResponseKey { get; set; } = string.Empty;
        public string ResponseValue { get; set; } = string.Empty;
    }

    /// <summary>Notifier answer; property names match its JSON.</summary>
    [System.Diagnostics.CodeAnalysis.SuppressMessage("Style", "IDE1006:Naming Styles", Justification = "Matches the Notifier JSON.")]
    public sealed class NotifierResponse
    {
        public bool isSuccess { get; set; }
    }
}
