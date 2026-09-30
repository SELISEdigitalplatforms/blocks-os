using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace DomainService.Billing.Services;

/// <summary>
/// Picks up paid orders nobody is working on.
/// </summary>
/// <remarks>
/// The safety net under the bus. A queued message can be lost, a worker can restart mid-job, a
/// queue can be purged — and none of those may leave a customer who paid waiting forever, which is
/// exactly what "never fail, only pending" would otherwise hide.
/// <para>
/// The work item is the order row: <c>Paid</c> or <c>Creating</c>, and untouched for longer than a
/// running job would be. Nothing is deleted and nothing is refunded; the order is simply run
/// again, resuming from the step it recorded.
/// </para>
/// </remarks>
public sealed class OrderSweeper : BackgroundService
{
    /// <summary>How long an order may sit untouched before it is assumed abandoned.</summary>
    /// <remarks>
    /// Comfortably longer than the longest backoff gap, so an order merely waiting between
    /// attempts is never mistaken for a stalled one and run twice.
    /// </remarks>
    public static readonly TimeSpan StaleAfter = TimeSpan.FromMinutes(20);

    /// <summary>
    /// How long a charge may sit without an answer before it is called out.
    /// </summary>
    /// <remarks>
    /// Long enough that the provider's own webhook retries have had a fair run — a notification
    /// is queued and retried for far longer than this, so anything still unresolved after fifteen
    /// minutes is unusual rather than merely slow.
    /// </remarks>
    public static readonly TimeSpan UnresolvedAfter = TimeSpan.FromMinutes(15);

    private static readonly TimeSpan Interval = TimeSpan.FromMinutes(5);
    private const int BatchSize = 20;

    private readonly IServiceProvider _services;
    private readonly ILogger<OrderSweeper> _logger;
    private readonly TimeProvider _time;

    public OrderSweeper(IServiceProvider services, ILogger<OrderSweeper> logger, TimeProvider? timeProvider = null)
    {
        _services = services;
        _logger = logger;
        _time = timeProvider ?? TimeProvider.System;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(Interval);

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await SweepAsync(stoppingToken).ConfigureAwait(false);
            }
            catch (OperationCanceledException)
            {
                return;
            }
            catch (Exception exception)
            {
                // A sweep that throws must not end the sweeper; the next tick tries again.
                _logger.LogError(exception, "An order sweep failed.");
            }

            try
            {
                await timer.WaitForNextTickAsync(stoppingToken).ConfigureAwait(false);
            }
            catch (OperationCanceledException)
            {
                return;
            }
        }
    }

    internal async Task<int> SweepAsync(CancellationToken cancellationToken)
    {
        using var scope = _services.CreateScope();

        var orders = scope.ServiceProvider.GetRequiredService<ISubscriptionOrderStore>();
        var provisioner = scope.ServiceProvider.GetRequiredService<IOrderProvisioner>();

        var utcNow = _time.GetUtcNow().UtcDateTime;

        // Abandoned checkouts first. Someone who opens the screen and walks away leaves a pending
        // order behind; without this they accumulate for the life of the platform. The row is
        // marked expired rather than deleted, so its idempotency key stays taken and a very late
        // duplicate still cannot charge.
        var expired = await orders.ExpireAbandonedAsync(utcNow, BatchSize, cancellationToken).ConfigureAwait(false);

        if (expired > 0)
        {
            _logger.LogInformation("Expired {Count} checkout(s) that were never paid.", expired);
        }

        // Charges we never got an answer about. Not resolved here — the provider's idempotency
        // window has long closed, so a replay would charge again rather than report. Surfaced
        // instead, because the alternative to a person looking is nobody looking.
        var unresolved = await orders
            .FindUnresolvedChargesAsync(utcNow - UnresolvedAfter, BatchSize, cancellationToken)
            .ConfigureAwait(false);

        foreach (var order in unresolved)
        {
            _logger.LogError(
                "Order {OrderId} for {TenantGroupId} was charged at {AttemptedAt} and has no outcome. "
                + "Resolve it against the provider; it will not expire on its own.",
                order.ItemId,
                order.TenantGroupId,
                order.ChargeAttemptedAtUtc);
        }

        var cutoff = utcNow - StaleAfter;
        var stale = await orders.FindUnfinishedAsync(cutoff, BatchSize, cancellationToken).ConfigureAwait(false);

        if (stale.Count == 0)
        {
            return 0;
        }

        _logger.LogInformation("Sweeping {Count} order(s) that nobody is working on.", stale.Count);

        foreach (var order in stale)
        {
            cancellationToken.ThrowIfCancellationRequested();

            try
            {
                await provisioner
                    .RunAsync(order.TenantGroupId, order.ItemId, cancellationToken)
                    .ConfigureAwait(false);
            }
            catch (OperationCanceledException)
            {
                throw;
            }
            catch (Exception exception)
            {
                // One bad order must not stop the rest of the batch.
                _logger.LogError(exception, "Sweeping order {OrderId} failed.", order.ItemId);
            }
        }

        return stale.Count;
    }
}
