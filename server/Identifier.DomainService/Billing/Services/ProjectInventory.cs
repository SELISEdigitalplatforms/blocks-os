using DomainService.Billing.Entities;
using DomainService.Catalogue.Services;
using DomainService.Projects;

namespace DomainService.Billing.Services;

public interface IProjectInventory
{
    /// <summary>
    /// What a project holds right now: its environments, the ones an order is already creating,
    /// which of them are free, and its subscription.
    /// </summary>
    /// <param name="excludeOrderId">
    /// An order to leave out of "in flight" — the one being paid, which must not count against
    /// itself.
    /// </param>
    Task<ProjectInventorySnapshot> GetAsync(
        string tenantGroupId,
        string? excludeOrderId = null,
        CancellationToken cancellationToken = default);
}

/// <summary>
/// One read of everything checkout and project creation must agree on before selling or creating
/// an environment.
/// </summary>
/// <remarks>
/// One place, so the console's Create, checkout's Start and Pay all answer "does this project
/// already have dev?" and "is its free tier taken?" the same way.
/// </remarks>
public sealed class ProjectInventory : IProjectInventory
{
    private readonly IProjectRepository _projects;
    private readonly ISubscriptionStore _subscriptions;
    private readonly ISubscriptionOrderStore _orders;
    private readonly ICatalogueProvider _catalogue;
    private readonly TimeProvider _time;

    public ProjectInventory(
        IProjectRepository projects,
        ISubscriptionStore subscriptions,
        ISubscriptionOrderStore orders,
        ICatalogueProvider catalogue,
        TimeProvider? timeProvider = null)
    {
        _projects = projects;
        _subscriptions = subscriptions;
        _orders = orders;
        _catalogue = catalogue;
        _time = timeProvider ?? TimeProvider.System;
    }

    public async Task<ProjectInventorySnapshot> GetAsync(
        string tenantGroupId,
        string? excludeOrderId = null,
        CancellationToken cancellationToken = default)
    {
        var snapshot = new ProjectInventorySnapshot();

        if (string.IsNullOrWhiteSpace(tenantGroupId))
        {
            return snapshot;
        }

        var utcNow = _time.GetUtcNow().UtcDateTime;
        var tenants = await _projects.GetByGroupIdAsync(tenantGroupId).ConfigureAwait(false) ?? [];
        var subscription = await _subscriptions.GetAsync(tenantGroupId, cancellationToken).ConfigureAwait(false);
        var orders = await _orders.ListAsync(tenantGroupId, cancellationToken).ConfigureAwait(false) ?? [];

        snapshot.Subscription = subscription;

        // Disabled tenants count. A disabled environment keeps its tenant id, which is derived
        // from the group and the environment, so a second one cannot be created beside it —
        // provisioning would adopt the disabled tenant and charge for something switched off.
        // Bringing it back is Restore, not a purchase.
        foreach (var tenant in tenants)
        {
            if (string.IsNullOrWhiteSpace(tenant?.Environment))
            {
                continue;
            }

            snapshot.Existing.Add(tenant.Environment);
            snapshot.TenantIds[tenant.Environment] = tenant.TenantId ?? string.Empty;
        }

        foreach (var order in orders)
        {
            if (order is null || string.Equals(order.ItemId, excludeOrderId, StringComparison.Ordinal))
            {
                continue;
            }

            // In flight: money taken and not yet delivered, or a charge with no answer yet.
            // A plain pending order is an open checkout tab — it holds nothing until paid.
            var inFlight = order.State is OrderStates.Paid or OrderStates.Creating
                || (order.State == OrderStates.Pending
                    && order.ChargeAttemptedAtUtc is not null
                    && order.ExpiresAtUtc > utcNow);

            if (!inFlight)
            {
                continue;
            }

            foreach (var line in order.Lines.Where(l => l.Kind == "upgrade"))
            {
                snapshot.UpgradesInFlight.Add(line.Environment);
            }

            foreach (var line in order.Lines.Where(l => l.Kind == "environment"))
            {
                snapshot.InFlight.Add(line.Environment);

                if (line.FreeTier)
                {
                    snapshot.AddFree(line.Environment);
                }
            }
        }

        var catalogue = _catalogue.Catalogue;

        foreach (var environment in snapshot.Existing)
        {
            if (catalogue.Environments.TryGetValue(environment, out var definition)
                && definition.FreeTierAvailable
                && !HasPaidLine(subscription, environment))
            {
                // An environment that offers a free tier and that nobody pays for is the free one:
                // created free by the console, or bought at the free price.
                snapshot.FreeEnvironments.Add(environment);
                snapshot.AddFree(environment);
            }
        }

        return snapshot;
    }

    private static bool HasPaidLine(ProjectSubscription? subscription, string environment) =>
        subscription is not null
        && subscription.State != SubscriptionStates.Cancelled
        && subscription.Lines.Exists(l =>
            l.Kind == "environment"
            && string.Equals(l.Environment, environment, StringComparison.Ordinal)
            && l.Amount > 0m);
}

public sealed class ProjectInventorySnapshot
{
    /// <summary>Environments the project has a tenant for, disabled ones included.</summary>
    public HashSet<string> Existing { get; } = new(StringComparer.Ordinal);

    /// <summary>Environment key to tenant id, for the environments in <see cref="Existing"/>.</summary>
    public Dictionary<string, string> TenantIds { get; } = new(StringComparer.Ordinal);

    /// <summary>Environments a paid, unfinished order is creating.</summary>
    public HashSet<string> InFlight { get; } = new(StringComparer.Ordinal);

    /// <summary>Free environments a paid, unfinished order is moving to the paid tier.</summary>
    public HashSet<string> UpgradesInFlight { get; } = new(StringComparer.Ordinal);

    /// <summary>Existing environments running on the free tier.</summary>
    public HashSet<string> FreeEnvironments { get; } = new(StringComparer.Ordinal);

    /// <summary>Free environments held or being created, per environment key.</summary>
    public Dictionary<string, int> FreeCount { get; } = new(StringComparer.Ordinal);

    public ProjectSubscription? Subscription { get; set; }

    public bool HasOrIsCreating(string environment) =>
        Existing.Contains(environment) || InFlight.Contains(environment);

    public int FreeHeld(string environment) =>
        FreeCount.TryGetValue(environment, out var count) ? count : 0;

    internal void AddFree(string environment) =>
        FreeCount[environment] = FreeHeld(environment) + 1;
}
