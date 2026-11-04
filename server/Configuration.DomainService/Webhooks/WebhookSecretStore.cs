using Blocks.Genesis;
using Blocks.Secrets;
using Configuration.DomainService.Shared.Secrets;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;

namespace Configuration.DomainService.Webhooks;

/// <summary>Webhook signing secrets in Blocks Secrets. The KV list keeps only the secret id. Never logs a value.</summary>
public interface IWebhookSecretStore
{
    /// <summary>Stores a new secret for the webhook and returns its id. Runs as the caller (audited as the admin).</summary>
    Task<string> CreateAsync(string webhookId, string value, CancellationToken cancellationToken);

    /// <summary>Best effort soft delete. Never throws.</summary>
    Task RetireQuietlyAsync(string secretId);

    /// <summary>The value, or null when the secret is gone, deleted or locked.</summary>
    Task<string?> GetValueAsync(string secretId, CancellationToken cancellationToken);
}

/// <inheritdoc cref="IWebhookSecretStore"/>
public sealed class WebhookSecretStore : IWebhookSecretStore
{
    public const string Tag = "webhooks";

    /// <summary>The service identity reads run under in a worker, where the message may carry no signed-in user.</summary>
    public const string ServiceUserId = "blocks-os-webhooks";

    private const string ServiceOrganizationId = "default";

    private readonly IServiceScopeFactory _scopeFactory;
    private readonly TimeProvider _timeProvider;
    private readonly ILogger<WebhookSecretStore> _logger;

    public WebhookSecretStore(IServiceScopeFactory scopeFactory, TimeProvider timeProvider, ILogger<WebhookSecretStore> logger)
    {
        _scopeFactory = scopeFactory;
        _timeProvider = timeProvider;
        _logger = logger;
    }

    public async Task<string> CreateAsync(string webhookId, string value, CancellationToken cancellationToken)
    {
        using var scope = _scopeFactory.CreateScope();
        var secrets = scope.ServiceProvider.GetRequiredService<ISecretService>();
        return await secrets.SetAsync(new SetSecretRequest
        {
            Name = "webhook-" + webhookId,
            Type = SecretTypes.Service,
            Value = value,
            Tags = [Tag],
            Description = "Webhook signing secret"
        }, cancellationToken);
    }

    public async Task RetireQuietlyAsync(string secretId)
    {
        if (string.IsNullOrEmpty(secretId))
        {
            return;
        }

        try
        {
            using var scope = _scopeFactory.CreateScope();
            await LinkedSecretRetirement.RetireAsync(scope.ServiceProvider.GetRequiredService<ISecretService>(), secretId, CancellationToken.None);
        }
        catch (Exception ex)
        {
            // Type only: a secret exception message can name the secret.
            _logger.LogError("Webhook secret could not be retired ({ErrorType})", ex.GetType().Name); // NOSONAR S6667 — type only
        }
    }

    public async Task<string?> GetValueAsync(string secretId, CancellationToken cancellationToken)
    {
        var tenantId = BlocksContext.GetContext()?.TenantId;
        if (string.IsNullOrEmpty(secretId) || string.IsNullOrWhiteSpace(tenantId))
        {
            return null;
        }

        using var scope = _scopeFactory.CreateScope();
        var secrets = scope.ServiceProvider.GetRequiredService<ISecretService>();
        try
        {
            // In the API the request's own user wins (Genesis reads the HTTP context first); in the worker this
            // service identity of the message's tenant reads the service secret.
            return await BlocksContext.ExecuteInContext(ServiceContext(tenantId), () => secrets.GetValueAsync(secretId, cancellationToken));
        }
        catch (SecretException ex) when (ex is SecretNotFoundException or SecretStateException)
        {
            return null;
        }
    }

    private BlocksContext ServiceContext(string tenantId) => BlocksContext.Create(
        tenantId: tenantId,
        roles: [],
        userId: ServiceUserId,
        isAuthenticated: true,
        requestUri: string.Empty,
        organizationId: ServiceOrganizationId,
        expireOn: _timeProvider.GetUtcNow().UtcDateTime.AddMinutes(5),
        email: string.Empty,
        permissions: [],
        userName: ServiceUserId,
        phoneNumber: string.Empty,
        displayName: ServiceUserId,
        oauthToken: string.Empty,
        originalTenantId: tenantId);
}
