using Blocks.Genesis;
using Microsoft.Extensions.Logging;

namespace DomainService.Billing.Services;

/// <summary>A paid order handed to the worker that builds its environments.</summary>
public sealed class ProvisionOrderCommand
{
    public string TenantGroupId { get; set; } = string.Empty;
    public string OrderId { get; set; } = string.Empty;
}

public interface IProvisioningQueue
{
    Task EnqueueAsync(string tenantGroupId, string orderId, CancellationToken cancellationToken = default);
}

/// <summary>
/// Puts a paid order on the bus.
/// </summary>
/// <remarks>
/// Best effort on purpose. A failure to enqueue is logged and swallowed, because the message is
/// not the record that work is owed — the order row is. Throwing here would fail a call whose
/// money has already moved, and the sweeper would have picked the order up anyway.
/// </remarks>
public sealed class ProvisioningQueue : IProvisioningQueue
{
    /// <summary>
    /// The declared queue. Names here must match the ones bound in
    /// <c>IdentifierConstants</c>, or the message is published to a queue nothing listens on.
    /// </summary>
    public const string QueueName = DomainService.Shared.IdentifierConstants.ProvisionOrderQueue;

    private readonly IMessageClient _messageClient;
    private readonly ILogger<ProvisioningQueue> _logger;

    public ProvisioningQueue(IMessageClient messageClient, ILogger<ProvisioningQueue> logger)
    {
        _messageClient = messageClient;
        _logger = logger;
    }

    public async Task EnqueueAsync(string tenantGroupId, string orderId, CancellationToken cancellationToken = default)
    {
        try
        {
            await _messageClient
                .SendToConsumerAsync(new ConsumerMessage<ProvisionOrderCommand>
                {
                    ConsumerName = QueueName,
                    Payload = new ProvisionOrderCommand { TenantGroupId = tenantGroupId, OrderId = orderId },
                })
                .ConfigureAwait(false);
        }
        catch (Exception exception)
        {
            _logger.LogError(
                exception,
                "Order {OrderId} could not be enqueued; the sweeper will pick it up.",
                orderId);
        }
    }
}
