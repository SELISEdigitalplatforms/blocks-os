using DomainService.Billing.Entities;
using DomainService.Billing.Models;
using DomainService.Catalogue.Services;
using DomainService.Projects;
using Microsoft.Extensions.Logging;

namespace DomainService.Billing.Services;

public interface IEnvironmentRemovalService
{
    /// <summary>
    /// Stops billing one environment at the end of the period already paid for.
    /// </summary>
    /// <remarks>
    /// Marks its rent line, and every recurring top-up on it, as ending at the subscription's next
    /// charge. Nothing is refunded and nothing stops now: the environment runs to the end of the
    /// period, and the renewal at that boundary drops the lines and switches the tenant off.
    /// </remarks>
    Task<EnvironmentRemovalResult> RemoveAsync(string tenantGroupId, string environment, CancellationToken cancellationToken = default);

    /// <summary>Takes back a pending removal. The lines continue as if it had never been asked.</summary>
    Task<EnvironmentRemovalResult> KeepAsync(string tenantGroupId, string environment, CancellationToken cancellationToken = default);
}

/// <param name="EffectiveUtc">When billing stops. Null after a keep.</param>
public readonly record struct EnvironmentRemovalResult(bool IsSuccess, string Reason, DateTime? EffectiveUtc)
{
    public static EnvironmentRemovalResult Failed(string reason) => new(false, reason, null);
}

/// <summary>
/// Switches off one environment's tenant once it has stopped being paid for.
/// </summary>
public interface IEnvironmentDisabler
{
    /// <returns>True when the tenant is now disabled.</returns>
    Task<bool> DisableAsync(string tenantGroupId, string environment, string tenantId, CancellationToken cancellationToken = default);
}

public sealed class EnvironmentRemovalService : IEnvironmentRemovalService
{
    /// <summary>The catalogue's <c>billing.onRemove</c> value this service implements.</summary>
    public const string AtUsagePeriodEnd = "atUsagePeriodEnd";

    private readonly ISubscriptionStore _subscriptions;
    private readonly ICatalogueProvider _catalogue;
    private readonly ILogger<EnvironmentRemovalService> _logger;

    public EnvironmentRemovalService(
        ISubscriptionStore subscriptions,
        ICatalogueProvider catalogue,
        ILogger<EnvironmentRemovalService> logger)
    {
        _subscriptions = subscriptions;
        _catalogue = catalogue;
        _logger = logger;
    }

    public async Task<EnvironmentRemovalResult> RemoveAsync(string tenantGroupId, string environment, CancellationToken cancellationToken = default)
    {
        var (subscription, lines) = await FindAsync(tenantGroupId, environment, cancellationToken).ConfigureAwait(false);

        if (subscription is null)
        {
            return EnvironmentRemovalResult.Failed(BillingFailures.EnvironmentNotFound);
        }

        var onRemove = _catalogue.Catalogue.Billing.OnRemove;

        // The only removal the platform sells today. Anything else in the catalogue is a policy
        // this build does not know, and the safe reading of an unknown one is the customer's:
        // keep what they already paid for until it runs out.
        if (!string.Equals(onRemove, AtUsagePeriodEnd, StringComparison.Ordinal))
        {
            _logger.LogWarning(
                "Catalogue onRemove '{OnRemove}' is not supported; removing {Environment} of {TenantGroupId} at period end.",
                onRemove,
                environment,
                tenantGroupId);
        }

        var effective = subscription.NextChargeAtUtc;

        foreach (var line in lines)
        {
            line.EndsAtUtc = effective;
        }

        subscription.UpdatedAtUtc = DateTime.UtcNow;
        await _subscriptions.UpsertAsync(subscription, cancellationToken).ConfigureAwait(false);

        return new EnvironmentRemovalResult(true, string.Empty, effective);
    }

    public async Task<EnvironmentRemovalResult> KeepAsync(string tenantGroupId, string environment, CancellationToken cancellationToken = default)
    {
        var (subscription, lines) = await FindAsync(tenantGroupId, environment, cancellationToken).ConfigureAwait(false);

        if (subscription is null)
        {
            return EnvironmentRemovalResult.Failed(BillingFailures.EnvironmentNotFound);
        }

        // Keeping what was never being removed is not an error; there is simply nothing to undo.
        if (lines.TrueForAll(l => l.EndsAtUtc is null))
        {
            return new EnvironmentRemovalResult(true, string.Empty, null);
        }

        foreach (var line in lines)
        {
            line.EndsAtUtc = null;
        }

        subscription.UpdatedAtUtc = DateTime.UtcNow;
        await _subscriptions.UpsertAsync(subscription, cancellationToken).ConfigureAwait(false);

        return new EnvironmentRemovalResult(true, string.Empty, null);
    }

    /// <summary>
    /// The subscription and the lines that belong to one environment, or nothing when the project
    /// is not paying for it — no subscription, a cancelled one, or no rent line for it.
    /// </summary>
    private async Task<(ProjectSubscription? Subscription, List<RecurringLine> Lines)> FindAsync(
        string tenantGroupId,
        string environment,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(tenantGroupId) || string.IsNullOrWhiteSpace(environment))
        {
            return (null, []);
        }

        var subscription = await _subscriptions.GetAsync(tenantGroupId, cancellationToken).ConfigureAwait(false);

        if (subscription is null || subscription.State == SubscriptionStates.Cancelled)
        {
            return (null, []);
        }

        var lines = subscription.Lines
            .Where(l => string.Equals(l.Environment, environment, StringComparison.Ordinal))
            .ToList();

        // The environment's own rent line is what makes it "in the subscription"; top-ups alone
        // are not an environment to remove.
        return lines.Exists(l => l.Kind == "environment")
            ? (subscription, lines)
            : (null, []);
    }
}

/// <summary>
/// Disables a tenant through the same path the console's Disable uses, so a removed environment
/// ends exactly like a disabled project: people rows dropped, hosts unbound, release torn down,
/// data and certificates kept so a restore can bring it back.
/// </summary>
public sealed class ProjectEnvironmentDisabler : IEnvironmentDisabler
{
    private readonly IProjectManagementService _projectManagement;
    private readonly IProjectRepository _projects;
    private readonly ILogger<ProjectEnvironmentDisabler> _logger;

    public ProjectEnvironmentDisabler(
        IProjectManagementService projectManagement,
        IProjectRepository projects,
        ILogger<ProjectEnvironmentDisabler> logger)
    {
        _projectManagement = projectManagement;
        _projects = projects;
        _logger = logger;
    }

    public async Task<bool> DisableAsync(string tenantGroupId, string environment, string tenantId, CancellationToken cancellationToken = default)
    {
        // A line written before its environment existed has no tenant id; the group and the
        // environment still name exactly one tenant.
        if (string.IsNullOrWhiteSpace(tenantId))
        {
            var tenants = await _projects.GetByGroupIdAsync(tenantGroupId).ConfigureAwait(false);
            tenantId = tenants?.FirstOrDefault(t => string.Equals(t.Environment, environment, StringComparison.Ordinal))?.TenantId
                ?? string.Empty;
        }

        if (string.IsNullOrWhiteSpace(tenantId))
        {
            _logger.LogError("No tenant for {Environment} of {TenantGroupId}; nothing was disabled.", environment, tenantGroupId);
            return false;
        }

        var result = await _projectManagement.DisableProjectAsync(tenantId).ConfigureAwait(false);

        if (result is null || !result.IsSuccess)
        {
            _logger.LogError(
                "Disabling {TenantId} ({Environment} of {TenantGroupId}) was refused: {Reason}",
                tenantId,
                environment,
                tenantGroupId,
                result?.Errors?.Values.FirstOrDefault() ?? "unknown");
            return false;
        }

        return true;
    }
}
