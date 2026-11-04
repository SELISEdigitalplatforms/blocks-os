using System.Diagnostics;
using Microsoft.Extensions.Logging;

namespace Configuration.DomainService.Webhooks;

/// <summary>One attempt's result. <see cref="SendResult"/> is null when nothing was sent (secret missing or unusable).</summary>
public sealed record WebhookAttemptOutcome(WebhookSendResult? SendResult, string? ErrorCode);

/// <summary>Loads the secret, signs and sends one attempt of a delivery, inside a <c>webhook.attempt</c> span.</summary>
public interface IWebhookAttemptRunner
{
    Task<WebhookAttemptOutcome> RunAsync(WebhookDelivery delivery, WebhookEntry webhook, int attemptNo, CancellationToken cancellationToken);
}

/// <inheritdoc cref="IWebhookAttemptRunner"/>
public sealed class WebhookAttemptRunner : IWebhookAttemptRunner
{
    public const string ActivityName = "webhook.attempt";

    private readonly IWebhookSecretStore _secrets;
    private readonly IWebhookSender _sender;
    private readonly ActivitySource _activitySource;
    private readonly ILogger<WebhookAttemptRunner> _logger;

    public WebhookAttemptRunner(IWebhookSecretStore secrets, IWebhookSender sender, ActivitySource activitySource, ILogger<WebhookAttemptRunner> logger)
    {
        _secrets = secrets;
        _sender = sender;
        _activitySource = activitySource;
        _logger = logger;
    }

    public async Task<WebhookAttemptOutcome> RunAsync(WebhookDelivery delivery, WebhookEntry webhook, int attemptNo, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(delivery);
        ArgumentNullException.ThrowIfNull(webhook);

        using var activity = _activitySource.StartActivity(ActivityName);
        activity?.SetTag("action.name", delivery.Action);
        activity?.SetTag("action.event_id", delivery.EventId);
        activity?.SetTag("webhook.id", webhook.Id);
        activity?.SetTag("attempt", attemptNo);

        var outcome = await SendAsync(delivery, webhook, cancellationToken);
        var errorCode = outcome.SendResult is null ? outcome.ErrorCode : WebhookRetryPolicy.ErrorCodeOf(outcome.SendResult);
        activity?.SetTag("http.status", outcome.SendResult?.HttpStatus);
        activity?.SetTag("error.code", errorCode);
        if (errorCode is not null)
        {
            activity?.SetStatus(ActivityStatusCode.Error);
        }

        _logger.LogInformation(
            "Webhook {WebhookId} attempt {Attempt} for {Action} ({EventId}) to host {Host}: status {HttpStatus}, error {ErrorCode}, {DurationMs} ms",
            webhook.Id, attemptNo, delivery.Action, delivery.EventId, HostOf(webhook.Url),
            outcome.SendResult?.HttpStatus, errorCode, outcome.SendResult?.DurationMs);
        return outcome with { ErrorCode = errorCode };
    }

    /// <summary>The host only: a URL can carry a token in its path or query.</summary>
    public static string HostOf(string? url) => WebhookAddressGuard.ParseUrl(url)?.IdnHost ?? "invalid";

    private async Task<WebhookAttemptOutcome> SendAsync(WebhookDelivery delivery, WebhookEntry webhook, CancellationToken cancellationToken)
    {
        var secret = await _secrets.GetValueAsync(webhook.SecretRef, cancellationToken);
        if (string.IsNullOrEmpty(secret))
        {
            // Never send unsigned.
            return new WebhookAttemptOutcome(null, WebhookAttemptErrors.SecretMissing);
        }

        if (!WebhookSignature.IsUsable(secret))
        {
            return new WebhookAttemptOutcome(null, WebhookAttemptErrors.SecretInvalid);
        }

        var result = await _sender.SendAsync(new WebhookSendRequest(webhook.Url, delivery.EventId, delivery.Body, secret), cancellationToken);
        return new WebhookAttemptOutcome(result, null);
    }
}
