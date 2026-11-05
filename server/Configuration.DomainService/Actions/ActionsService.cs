using Blocks.Genesis;
using Configuration.DomainService.Shared.Secrets;
using Configuration.DomainService.Shared.Services;
using Microsoft.Extensions.Logging;

namespace Configuration.DomainService.Actions;

/// <summary>Rules of the Actions page: list the root catalog with the tenant's flags and switch one target of one action.</summary>
public interface IActionsService
{
    /// <summary>Every catalog action with the tenant's flags; empty when the catalog is not seeded.</summary>
    Task<IReadOnlyList<ActionView>> GetsAsync(CancellationToken cancellationToken);

    Task<ServiceOutcome<bool>> UpdateAsync(UpdateActionRequest request, CancellationToken cancellationToken);
}

/// <inheritdoc cref="IActionsService"/>
public sealed class ActionsService : IActionsService
{
    private readonly IActionsRepository _repository;
    private readonly ILogger<ActionsService> _logger;

    public ActionsService(IActionsRepository repository, ILogger<ActionsService> logger)
    {
        _repository = repository;
        _logger = logger;
    }

    public async Task<IReadOnlyList<ActionView>> GetsAsync(CancellationToken cancellationToken)
    {
        var catalog = await _repository.GetCatalogAsync(cancellationToken);
        if (catalog is null)
        {
            return [];
        }

        var enabled = (await _repository.GetAllAsync(cancellationToken))
            .Where(d => d is not null && !string.IsNullOrEmpty(d.Name))
            .GroupBy(d => d.Name, StringComparer.Ordinal)
            .ToDictionary(g => g.Key, g => g.First(), StringComparer.Ordinal);
        return [.. catalog.Where(d => d is not null).Select(d => ViewOf(d, enabled.GetValueOrDefault(d.Name)))];
    }

    // Label, service and payload come from the catalog; only the flags come from the tenant's item.
    private static ActionView ViewOf(ActionDefinition catalogEntry, ActionDefinition? tenantEntry) =>
        ActionView.From(catalogEntry) with
        {
            Workflow = tenantEntry?.Workflow ?? false,
            Function = tenantEntry?.Function ?? false,
            Webhook = tenantEntry?.Webhook ?? false
        };

    public Task<ServiceOutcome<bool>> UpdateAsync(UpdateActionRequest request, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(request);
        return UpdateCoreAsync(request, cancellationToken);
    }

    private async Task<ServiceOutcome<bool>> UpdateCoreAsync(UpdateActionRequest request, CancellationToken cancellationToken)
    {
        var flagField = ActionTargets.FlagField(request.Target);
        if (flagField is null)
        {
            return ServiceOutcome<bool>.BadRequest(ActionErrorCodes.InvalidTarget);
        }

        if (string.IsNullOrWhiteSpace(request.Name))
        {
            return ServiceOutcome<bool>.BadRequest(ActionErrorCodes.ActionNotFound);
        }

        var catalog = await _repository.GetCatalogAsync(cancellationToken);
        if (catalog is null)
        {
            return ServiceOutcome<bool>.BadRequest(ActionErrorCodes.ActionsNotSeeded);
        }

        var catalogEntry = catalog.Find(d => d is not null && string.Equals(d.Name, request.Name, StringComparison.Ordinal));
        if (catalogEntry is null)
        {
            return ServiceOutcome<bool>.BadRequest(ActionErrorCodes.ActionNotFound);
        }

        if (request.Enabled)
        {
            await _repository.EnableAsync(catalogEntry, flagField, cancellationToken);
        }
        else
        {
            await _repository.DisableAsync(catalogEntry.Name, flagField, cancellationToken);
        }

        _logger.LogInformation("Action {Action} target {Target} set to {Enabled}", LogSafe.Value(request.Name), flagField, request.Enabled);
        return ServiceOutcome<bool>.Ok(true);
    }
}
