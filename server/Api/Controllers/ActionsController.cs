using Blocks.Genesis;
using Configuration.DomainService.Actions;
using Microsoft.AspNetCore.Mvc;

namespace BlocksOs.Api.Controllers;

/// <summary>The project's actions (Config → Actions). Routing only; rules are in <see cref="IActionsService"/>.</summary>
[ApiController]
[Route("[controller]/[action]")]
public class ActionsController : ControllerBase
{
    private readonly IActionsService _service;

    public ActionsController(IActionsService service)
    {
        _service = service;
    }

    [HttpGet]
    [ProtectedEndPoint("blocks-os::secret-config::get")]
    public Task<IReadOnlyList<ActionView>> Gets(CancellationToken cancellationToken) =>
        _service.GetsAsync(cancellationToken);

    /// <summary>One flag of one action. 400 <c>ACTION_NOT_FOUND</c>, <c>ACTIONS_NOT_SEEDED</c> or <c>INVALID_TARGET</c>.</summary>
    [HttpPost]
    [ProtectedEndPoint("blocks-os::secret-config::save")]
    public async Task<ActionResult<bool>> Update([FromBody] UpdateActionRequest request, CancellationToken cancellationToken) =>
        this.ToActionResult(await _service.UpdateAsync(request, cancellationToken));
}
