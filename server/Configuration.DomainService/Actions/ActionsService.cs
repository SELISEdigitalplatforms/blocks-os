using Configuration.DomainService.Shared.Secrets;
using Configuration.DomainService.Shared.Services;
using Microsoft.Extensions.Logging;

namespace Configuration.DomainService.Actions;

/// <summary>Rules of the Actions page: list the tenant's actions and switch one target of one action.</summary>
public interface IActionsService
{
    /// <summary>The tenant's actions; empty when none are seeded.</summary>
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
        var definitions = await _repository.GetAllAsync(cancellationToken);
        return definitions is null
            ? []
            : [.. definitions.Where(d => d is not null).Select(ActionView.From)];
    }

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

        var result = await _repository.SetFlagAsync(request.Name, flagField, request.Enabled, cancellationToken);
        switch (result)
        {
            case ActionFlagUpdate.Updated:
                _logger.LogInformation("Action {Action} target {Target} set to {Enabled}", LogSafe.Value(request.Name), flagField, request.Enabled);
                return ServiceOutcome<bool>.Ok(true);
            case ActionFlagUpdate.NotSeeded:
                return ServiceOutcome<bool>.BadRequest(ActionErrorCodes.ActionsNotSeeded);
            default:
                return ServiceOutcome<bool>.BadRequest(ActionErrorCodes.ActionNotFound);
        }
    }
}
