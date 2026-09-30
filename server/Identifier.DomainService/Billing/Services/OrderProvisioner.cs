using DomainService.Billing.Entities;
using DomainService.Billing.Models;
using Microsoft.Extensions.Logging;

namespace DomainService.Billing.Services;

/// <summary>Runs one provisioning step for one environment. The real work lives behind this.</summary>
public interface IProvisioningStepRunner
{
    /// <summary>
    /// Performs <paramref name="step"/> for one environment of an order.
    /// </summary>
    /// <returns>The tenant id once known, and whether the step succeeded.</returns>
    Task<StepOutcome> RunAsync(
        SubscriptionOrder order,
        OrderEnvironmentProgress environment,
        string step,
        CancellationToken cancellationToken = default);
}

public readonly record struct StepOutcome(bool Succeeded, string TenantId, string Error)
{
    public static StepOutcome Ok(string tenantId = "") => new(true, tenantId, string.Empty);
    public static StepOutcome Failed(string error) => new(false, string.Empty, error);
}

public interface IOrderProvisioner
{
    /// <summary>
    /// Carries an order as far as it can, resuming from wherever it stopped.
    /// </summary>
    /// <returns>True when the order finished; false when it is waiting on a retry or a human.</returns>
    Task<bool> RunAsync(string tenantGroupId, string orderId, CancellationToken cancellationToken = default);
}

/// <summary>
/// Builds an order's environments, one step at a time, and records every step as it goes.
/// </summary>
/// <remarks>
/// Idempotent by construction: the order carries how far each environment got, so a second run
/// resumes from the recorded step rather than starting the environment again. That is what makes
/// "retry, never refund" safe to apply automatically.
/// <para>
/// Attempts are counted per environment <i>and</i> step, not per order — one flaky environment must
/// not spend the budget belonging to the other six. When a step runs out, the order is left paid
/// and flagged for operations; it is never refunded and the customer is never shown a failure.
/// </para>
/// </remarks>
public sealed class OrderProvisioner : IOrderProvisioner
{
    /// <summary>
    /// Waits before each further attempt. Four gaps for five attempts, spanning about twenty
    /// minutes so a deploy or a restart passes before anyone is woken.
    /// </summary>
    public static readonly IReadOnlyList<TimeSpan> Backoff =
    [
        TimeSpan.FromSeconds(10),
        TimeSpan.FromMinutes(1),
        TimeSpan.FromMinutes(5),
        TimeSpan.FromMinutes(15),
    ];

    /// <summary>
    /// The schedule this instance uses. Injectable so a test can exercise all five attempts
    /// without waiting twenty-one minutes for them — the ladder is a policy, not a law of the
    /// code, and a test that has to sleep through it is a test nobody runs.
    /// </summary>
    private readonly IReadOnlyList<TimeSpan> _backoff;

    private readonly ISubscriptionOrderStore _orders;
    private readonly IProvisioningStepRunner _steps;
    private readonly IOrderNotifier _notifier;
    private readonly IRenewalService _renewals;
    private readonly ILogger<OrderProvisioner> _logger;
    private readonly TimeProvider _time;

    public OrderProvisioner(
        ISubscriptionOrderStore orders,
        IProvisioningStepRunner steps,
        IOrderNotifier notifier,
        IRenewalService renewals,
        ILogger<OrderProvisioner> logger,
        TimeProvider? timeProvider = null,
        IReadOnlyList<TimeSpan>? backoff = null)
    {
        _orders = orders;
        _steps = steps;
        _notifier = notifier;
        _renewals = renewals;
        _logger = logger;
        _time = timeProvider ?? TimeProvider.System;
        _backoff = backoff ?? Backoff;
    }

    /// <summary>How long to wait before attempt number <paramref name="attempt"/>, with jitter.</summary>
    /// <remarks>
    /// Jitter matters more than the numbers. A real outage fails many orders at once, and a fixed
    /// schedule would have all of them retry in lockstep and hammer the service exactly as it
    /// comes back.
    /// </remarks>
    public static TimeSpan DelayBefore(int attempt, Random? random = null) =>
        DelayBefore(attempt, Backoff, random);

    public static TimeSpan DelayBefore(int attempt, IReadOnlyList<TimeSpan> schedule, Random? random = null)
    {
        if (attempt <= 1 || schedule.Count == 0)
        {
            return TimeSpan.Zero;
        }

        var index = Math.Min(attempt - 2, schedule.Count - 1);
        var baseDelay = schedule[index];
        var jitter = ((random ?? Random.Shared).NextDouble() * 0.4) - 0.2;

        return baseDelay * (1 + jitter);
    }

    public async Task<bool> RunAsync(string tenantGroupId, string orderId, CancellationToken cancellationToken = default)
    {
        var order = await _orders.GetAsync(tenantGroupId, orderId, cancellationToken).ConfigureAwait(false);

        if (order is null)
        {
            _logger.LogWarning("Order {OrderId} was not found; nothing to provision.", orderId);
            return false;
        }

        // Only a paid order is owed work. Pending has no money behind it, and the terminal states
        // are done. A second worker arriving late must not redo a finished order.
        if (order.State is not (OrderStates.Paid or OrderStates.Creating))
        {
            return OrderStates.IsTerminal(order.State);
        }

        order.State = OrderStates.Creating;
        await SaveAsync(order, cancellationToken).ConfigureAwait(false);

        foreach (var environment in order.Progress)
        {
            var finished = await RunEnvironmentAsync(order, environment, cancellationToken).ConfigureAwait(false);

            if (!finished)
            {
                // Out of attempts. Stop here rather than racing ahead: the remaining environments
                // keep their place and the same run picks them up next time.
                order.NeedsAttention = true;
                await SaveAsync(order, cancellationToken).ConfigureAwait(false);

                _logger.LogError(
                    "Order {OrderId} needs attention: {Environment} exhausted {Max} attempts on {Step}.",
                    order.ItemId,
                    environment.Environment,
                    CheckoutService.MaxAttempts,
                    ProvisioningSteps.All[Math.Min(environment.StepsDone, ProvisioningSteps.All.Count - 1)]);

                await _notifier
                    .PushStatusAsync(
                        order.CreatedByUserId,
                        CheckoutService.ToView(order),
                        "Still working on it",
                        cancellationToken)
                    .ConfigureAwait(false);

                return false;
            }
        }

        order.State = OrderStates.Created;
        order.NeedsAttention = false;
        order.CompletedAtUtc = _time.GetUtcNow().UtcDateTime;
        await SaveAsync(order, cancellationToken).ConfigureAwait(false);

        // Only now: what was bought joins the monthly bill once it exists, never before. An order
        // that never finished must not start charging rent for environments nobody got.
        await _renewals.ApplyOrderAsync(order, cancellationToken).ConfigureAwait(false);

        await _notifier
            .PushStatusAsync(
                order.CreatedByUserId,
                CheckoutService.ToView(order),
                "Your project is ready",
                cancellationToken)
            .ConfigureAwait(false);

        return true;
    }

    private async Task<bool> RunEnvironmentAsync(
        SubscriptionOrder order,
        OrderEnvironmentProgress environment,
        CancellationToken cancellationToken)
    {
        environment.StartedAtUtc ??= _time.GetUtcNow().UtcDateTime;

        while (environment.StepsDone < ProvisioningSteps.All.Count)
        {
            cancellationToken.ThrowIfCancellationRequested();

            var step = ProvisioningSteps.All[environment.StepsDone];
            environment.Attempt++;

            if (environment.Attempt > CheckoutService.MaxAttempts)
            {
                return false;
            }

            var delay = DelayBefore(environment.Attempt, _backoff);

            if (delay > TimeSpan.Zero)
            {
                await Task.Delay(delay, cancellationToken).ConfigureAwait(false);
            }

            environment.LastAttemptAtUtc = _time.GetUtcNow().UtcDateTime;

            var outcome = await _steps
                .RunAsync(order, environment, step, cancellationToken)
                .ConfigureAwait(false);

            if (!outcome.Succeeded)
            {
                environment.LastError = outcome.Error;
                await SaveAsync(order, cancellationToken).ConfigureAwait(false);

                _logger.LogWarning(
                    "Order {OrderId}: {Environment} failed {Step} on attempt {Attempt} of {Max}.",
                    order.ItemId,
                    environment.Environment,
                    step,
                    environment.Attempt,
                    CheckoutService.MaxAttempts);

                continue;
            }

            if (!string.IsNullOrWhiteSpace(outcome.TenantId))
            {
                environment.TenantId = outcome.TenantId;
            }

            environment.StepsDone++;
            // A fresh budget for the next step: the five attempts belong to the step, not to the
            // environment's whole journey.
            environment.Attempt = 0;
            environment.LastError = string.Empty;

            if (environment.IsComplete)
            {
                environment.CompletedAtUtc = _time.GetUtcNow().UtcDateTime;
            }

            await SaveAsync(order, cancellationToken).ConfigureAwait(false);

            await _notifier
                .PushProgressAsync(order.CreatedByUserId, CheckoutService.ToView(order), cancellationToken)
                .ConfigureAwait(false);
        }

        return true;
    }

    private async Task SaveAsync(SubscriptionOrder order, CancellationToken cancellationToken)
    {
        order.UpdatedAtUtc = _time.GetUtcNow().UtcDateTime;
        await _orders.UpdateAsync(order, cancellationToken).ConfigureAwait(false);
    }
}
