using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace DomainService.Billing.Services;

/// <summary>
/// Charges subscriptions whose period has come round.
/// </summary>
/// <remarks>
/// Hourly rather than daily: a subscription's anchor is the day it was bought, so charges fall at
/// every hour of the clock and a daily pass would delay some by most of a day.
/// <para>
/// The charge is keyed by group and date, so running twice in one day cannot bill twice — which is
/// what makes it safe to run this on more than one host.
/// </para>
/// </remarks>
public sealed class RenewalBackgroundService : BackgroundService
{
    private static readonly TimeSpan Interval = TimeSpan.FromHours(1);
    private const int BatchSize = 50;

    private readonly IServiceProvider _services;
    private readonly ILogger<RenewalBackgroundService> _logger;
    private readonly TimeProvider _time;

    public RenewalBackgroundService(
        IServiceProvider services,
        ILogger<RenewalBackgroundService> logger,
        TimeProvider? timeProvider = null)
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
                await RunAsync(stoppingToken).ConfigureAwait(false);
            }
            catch (OperationCanceledException)
            {
                return;
            }
            catch (Exception exception)
            {
                // One bad pass must not end the service — the next hour tries again.
                _logger.LogError(exception, "A renewal pass failed.");
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

    internal async Task<int> RunAsync(CancellationToken cancellationToken)
    {
        using var scope = _services.CreateScope();

        var subscriptions = scope.ServiceProvider.GetRequiredService<ISubscriptionStore>();
        var renewals = scope.ServiceProvider.GetRequiredService<IRenewalService>();

        var due = await subscriptions
            .FindDueAsync(_time.GetUtcNow().UtcDateTime, BatchSize, cancellationToken)
            .ConfigureAwait(false);

        if (due.Count == 0)
        {
            return 0;
        }

        _logger.LogInformation("Renewing {Count} subscription(s).", due.Count);

        foreach (var subscription in due)
        {
            cancellationToken.ThrowIfCancellationRequested();

            try
            {
                await renewals.RenewAsync(subscription, cancellationToken).ConfigureAwait(false);
            }
            catch (OperationCanceledException)
            {
                throw;
            }
            catch (Exception exception)
            {
                // A failure here is not a decline — it never reached the provider. The period was
                // not advanced, so the next pass picks it up again.
                _logger.LogError(
                    exception,
                    "Renewing {TenantGroupId} threw; it stays due.",
                    subscription.TenantGroupId);
            }
        }

        return due.Count;
    }
}
