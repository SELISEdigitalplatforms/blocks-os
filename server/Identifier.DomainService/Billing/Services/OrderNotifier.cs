using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using DomainService.Billing.Models;
using Microsoft.Extensions.Logging;

namespace DomainService.Billing.Services;

public interface IOrderNotifier
{
    /// <summary>A step finished. Transient: it only moves a bar on a screen already open.</summary>
    Task PushProgressAsync(string userId, OrderView order, CancellationToken cancellationToken = default);

    /// <summary>The purchase reached an outcome. Persisted, so someone who left still finds it.</summary>
    Task PushStatusAsync(string userId, OrderView order, string headline, CancellationToken cancellationToken = default);
}

/// <summary>
/// Pushes order progress to the console through blocks-logic's notification hub.
/// </summary>
/// <remarks>
/// blocks-logic owns the SignalR hub and the Firebase fallback; blocks-os owns none of that and
/// should not grow its own. Its <c>Notifier/Notify</c> action is anonymous by design — its own
/// documentation says the send actions are open "because internal services call them" — so this
/// needs no token, and the endpoint must stay unreachable from outside the cluster.
/// <para>
/// Two configurations, because a purchase produces forty-two step messages and one outcome.
/// Progress is <b>not</b> persisted: missing it costs nothing, since the outcome message says what
/// happened. Storing all forty-two would bury every other notification the person has.
/// </para>
/// </remarks>
public sealed class OrderNotifier : IOrderNotifier
{
    /// <summary>Transient. Moves the bar on an open screen.</summary>
    public const string ProgressConfiguration = "subscription-order-progress";

    /// <summary>Persisted. One per outcome.</summary>
    public const string StatusConfiguration = "subscription-order-status";

    private readonly HttpClient _http;
    private readonly ILogger<OrderNotifier> _logger;

    public OrderNotifier(HttpClient http, ILogger<OrderNotifier> logger)
    {
        _http = http;
        _logger = logger;
    }

    public Task PushProgressAsync(string userId, OrderView order, CancellationToken cancellationToken = default) =>
        SendAsync(ProgressConfiguration, userId, order, string.Empty, persist: false, cancellationToken);

    public Task PushStatusAsync(string userId, OrderView order, string headline, CancellationToken cancellationToken = default) =>
        SendAsync(StatusConfiguration, userId, order, headline, persist: true, cancellationToken);

    private async Task SendAsync(
        string configurationName,
        string userId,
        OrderView order,
        string headline,
        bool persist,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(userId) || order is null)
        {
            return;
        }

        // The client keys entries by orderId and replaces rather than appends, which is what keeps
        // one purchase to one notification however many steps it has.
        var payload = new
        {
            orderId = order.OrderId,
            state = order.State,
            headline,
            stepsDone = order.StepsDone,
            stepsTotal = order.StepsTotal,
            currentStep = order.CurrentStep,
            currentEnvironment = order.CurrentEnvironment,
            attempt = order.Attempt,
            maxAttempts = order.MaxAttempts,
            environments = order.Environments,
        };

        var request = new NotifyRequest
        {
            ConfigurationName = configurationName,
            UserIds = [userId],
            ResponseKey = "orderId",
            ResponseValue = order.OrderId,
            // Stored with the offline copy, and not pushed through the socket — so the live
            // message has to carry everything the screen renders, which the payload above does.
            DenormalizedPayload = JsonSerializer.Serialize(payload),
            SaveDenormalizedPayloadAsAnObject = persist,
        };

        try
        {
            using var response = await _http
                .PostAsJsonAsync("Notifier/Notify", request, cancellationToken)
                .ConfigureAwait(false);

            if (!response.IsSuccessStatusCode)
            {
                _logger.LogWarning(
                    "Notification for order {OrderId} was refused with status {Status}.",
                    order.OrderId,
                    (int)response.StatusCode);
            }
        }
        catch (Exception exception) when (exception is not OperationCanceledException)
        {
            // A notification that does not arrive must never fail the work it describes. The order
            // is already correct in the database, and the console reads it on next load.
            _logger.LogError(exception, "Notification for order {OrderId} could not be sent.", order.OrderId);
        }
    }

    /// <summary>The shape blocks-logic expects. Mirrored, not referenced — os takes no dependency on logic.</summary>
    private sealed class NotifyRequest
    {
        [JsonPropertyName("configurationName")] public string ConfigurationName { get; set; } = string.Empty;
        [JsonPropertyName("userIds")] public List<string> UserIds { get; set; } = [];
        [JsonPropertyName("responseKey")] public string ResponseKey { get; set; } = string.Empty;
        [JsonPropertyName("responseValue")] public string ResponseValue { get; set; } = string.Empty;
        [JsonPropertyName("denormalizedPayload")] public string DenormalizedPayload { get; set; } = string.Empty;
        [JsonPropertyName("saveDenormalizedPayloadAsAnObject")] public bool SaveDenormalizedPayloadAsAnObject { get; set; }
    }
}
