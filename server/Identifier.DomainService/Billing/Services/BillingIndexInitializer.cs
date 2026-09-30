using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace DomainService.Billing.Services;

/// <summary>
/// Creates the order indexes once at start-up.
/// </summary>
/// <remarks>
/// The unique index on group and idempotency key is not an optimisation — it is the thing that
/// makes a duplicate call safe. Without it two simultaneous presses both insert and both charge.
/// Creating an index that already exists is a no-op, so this runs on every boot.
/// </remarks>
public sealed class BillingIndexInitializer : IHostedService
{
    private readonly IServiceProvider _services;
    private readonly ILogger<BillingIndexInitializer> _logger;

    public BillingIndexInitializer(IServiceProvider services, ILogger<BillingIndexInitializer> logger)
    {
        _services = services;
        _logger = logger;
    }

    public async Task StartAsync(CancellationToken cancellationToken)
    {
        try
        {
            using var scope = _services.CreateScope();
            var store = scope.ServiceProvider.GetRequiredService<ISubscriptionOrderStore>();
            await store.EnsureIndexesAsync(cancellationToken).ConfigureAwait(false);
        }
        catch (Exception exception)
        {
            // Loud, because a missing unique index means duplicate charges are possible — but not
            // fatal, because refusing to start takes the whole console down with it.
            _logger.LogCritical(
                exception,
                "The order indexes could not be created. Duplicate-charge protection is NOT in place.");
        }
    }

    public Task StopAsync(CancellationToken cancellationToken) => Task.CompletedTask;
}
