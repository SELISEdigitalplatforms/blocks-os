using Blocks.Genesis;
using Configuration.DomainService.Webhooks;
using Microsoft.AspNetCore.Mvc;

namespace BlocksOs.Api.Controllers;

/// <summary><c>Webhooks/Deliveries</c> and <c>Webhooks/Resend</c>. Rules are in <see cref="IWebhookHistoryService"/>.</summary>
[ApiController]
[Route("Webhooks/[action]")]
public class WebhookHistoryController : ControllerBase
{
    private readonly IWebhookHistoryService _service;

    public WebhookHistoryController(IWebhookHistoryService service)
    {
        _service = service;
    }

    /// <summary>History of one webhook, newest first.</summary>
    [HttpGet]
    [ProtectedEndPoint("blocks-os::secret-config::get")]
    public async Task<ActionResult<WebhookDeliveryPage>> Deliveries([FromQuery] WebhookDeliveriesQuery query, CancellationToken cancellationToken) =>
        this.ToActionResult(await _service.GetDeliveriesAsync(query, cancellationToken));

    /// <summary>Resends a Delivered or Failed row; 409 while a send of that row is in flight.</summary>
    [HttpPost]
    [ProtectedEndPoint("blocks-os::secret-config::save")]
    public async Task<ActionResult<bool>> Resend([FromBody] ResendWebhookDeliveryRequest request, CancellationToken cancellationToken) =>
        this.ToActionResult(await _service.ResendAsync(request.DeliveryId, cancellationToken));
}
