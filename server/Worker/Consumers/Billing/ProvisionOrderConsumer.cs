using Blocks.Genesis;
using DomainService.Billing.Services;

namespace Worker.Consumers.Billing;

/// <summary>
/// Builds the environments a paid order bought.
/// </summary>
/// <remarks>
/// The prompt half of the pair. The durable half is the order row itself: one sitting in
/// <c>paid</c> with no completion is what <see cref="OrderSweeper"/> picks up when this message is
/// lost, the worker restarts, or the queue is purged. So this may fail freely — nothing is
/// forgotten, only delayed.
/// <para>
/// Provisioning is idempotent and resumes from the step the order recorded, which is why a message
/// delivered twice is harmless.
/// </para>
/// </remarks>
public sealed class ProvisionOrderConsumer : IConsumer<ProvisionOrderCommand>
{
    private readonly IOrderProvisioner _provisioner;
    private readonly ILogger<ProvisionOrderConsumer> _logger;

    public ProvisionOrderConsumer(IOrderProvisioner provisioner, ILogger<ProvisionOrderConsumer> logger)
    {
        _provisioner = provisioner;
        _logger = logger;
    }

    public async Task Consume(ProvisionOrderCommand command)
    {
        if (command is null
            || string.IsNullOrWhiteSpace(command.TenantGroupId)
            || string.IsNullOrWhiteSpace(command.OrderId))
        {
            _logger.LogWarning("A provision command arrived without an order to work on.");
            return;
        }

        _logger.LogInformation("Provisioning order {OrderId}.", command.OrderId);

        var finished = await _provisioner
            .RunAsync(command.TenantGroupId, command.OrderId)
            .ConfigureAwait(false);

        if (!finished)
        {
            // Not an error: the order is waiting between attempts, or waiting for a human. Either
            // way the money is kept and the sweeper will come back to it.
            _logger.LogInformation("Order {OrderId} is not finished yet.", command.OrderId);
        }
    }
}
