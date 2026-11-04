using Blocks.Genesis;
using Configuration.DomainService.Shared.Services;

namespace Configuration.DomainService.Webhooks;

/// <summary>Sends one signed sample event (<c>webhook.test</c>) to a webhook now. Nothing is stored.</summary>
public interface IWebhookTestService
{
    Task<ServiceOutcome<WebhookTestResult>> TestAsync(string id, CancellationToken cancellationToken);
}

/// <inheritdoc cref="IWebhookTestService"/>
public sealed class WebhookTestService : IWebhookTestService
{
    private readonly IWebhookRepository _webhooks;
    private readonly IWebhookSecretStore _secrets;
    private readonly IWebhookSender _sender;
    private readonly TimeProvider _timeProvider;

    public WebhookTestService(IWebhookRepository webhooks, IWebhookSecretStore secrets, IWebhookSender sender, TimeProvider timeProvider)
    {
        _webhooks = webhooks;
        _secrets = secrets;
        _sender = sender;
        _timeProvider = timeProvider;
    }

    public async Task<ServiceOutcome<WebhookTestResult>> TestAsync(string id, CancellationToken cancellationToken)
    {
        var webhook = string.IsNullOrWhiteSpace(id) ? null : await _webhooks.GetAsync(id, cancellationToken);
        if (webhook is null)
        {
            return ServiceOutcome<WebhookTestResult>.NotFound(WebhookErrorCodes.WebhookNotFound);
        }

        var secret = await _secrets.GetValueAsync(webhook.SecretRef, cancellationToken);
        if (!WebhookSignature.IsUsable(secret))
        {
            return ServiceOutcome<WebhookTestResult>.BadRequest(WebhookErrorCodes.SecretMissing);
        }

        var eventId = WebhookEventBody.NewEventId();
        var body = WebhookEventBody.Build(
            eventId,
            WebhookEventBody.TestAction,
            _timeProvider.GetUtcNow().UtcDateTime,
            BlocksContext.GetContext()?.OrganizationId,
            null);
        var result = await _sender.SendAsync(new WebhookSendRequest(webhook.Url, eventId, body, secret!), cancellationToken);
        var errorCode = WebhookRetryPolicy.ErrorCodeOf(result);
        return ServiceOutcome<WebhookTestResult>.Ok(new WebhookTestResult(errorCode is null, result.HttpStatus, result.DurationMs, errorCode));
    }
}
