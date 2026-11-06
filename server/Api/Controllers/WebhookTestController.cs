using Blocks.Genesis;
using Configuration.DomainService.Webhooks;
using Microsoft.AspNetCore.Mvc;

namespace BlocksOs.Api.Controllers;

/// <summary><c>Webhooks/Test</c>: one signed sample event now; returns the HTTP status and duration. Not stored.</summary>
[ApiController]
[Route("Webhooks/[action]")]
public class WebhookTestController : ControllerBase
{
    private readonly IWebhookTestService _service;

    public WebhookTestController(IWebhookTestService service)
    {
        _service = service;
    }

    [HttpPost]
    [ProtectedEndPoint("blocks-os::secret-config::save")]
    public async Task<ActionResult<WebhookTestResult>> Test([FromBody] WebhookIdRequest request, CancellationToken cancellationToken) =>
        this.ToActionResult(await _service.TestAsync(request.Id, cancellationToken));
}
