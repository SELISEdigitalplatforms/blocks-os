using Blocks.Genesis;
using Configuration.DomainService.Webhooks;
using Microsoft.AspNetCore.Mvc;

namespace BlocksOs.Api.Controllers;

/// <summary>
/// The project's webhooks (Config → Webhooks). Routing only; rules are in <see cref="IWebhookService"/>.
/// No action ever returns a secret value.
/// </summary>
[ApiController]
[Route("[controller]/[action]")]
public class WebhooksController : ControllerBase
{
    private readonly IWebhookService _service;

    public WebhooksController(IWebhookService service)
    {
        _service = service;
    }

    [HttpGet]
    [ProtectedEndPoint("blocks-os::secret-config::get")]
    public Task<IReadOnlyList<WebhookView>> Gets(CancellationToken cancellationToken) =>
        _service.GetsAsync(cancellationToken);

    [HttpGet]
    [ProtectedEndPoint("blocks-os::secret-config::get")]
    public async Task<ActionResult<WebhookView>> Get([FromQuery] string id, CancellationToken cancellationToken) =>
        this.ToActionResult(await _service.GetAsync(id, cancellationToken));

    [HttpPost]
    [ProtectedEndPoint("blocks-os::secret-config::save")]
    public async Task<ActionResult<WebhookView>> Save([FromBody] SaveWebhookRequest request, CancellationToken cancellationToken) =>
        this.ToActionResult(await _service.SaveAsync(request, cancellationToken));

    [HttpPost]
    [ProtectedEndPoint("blocks-os::secret-config::delete")]
    public async Task<ActionResult<bool>> Delete([FromBody] WebhookIdRequest request, CancellationToken cancellationToken) =>
        this.ToActionResult(await _service.DeleteAsync(request.Id, cancellationToken));
}
