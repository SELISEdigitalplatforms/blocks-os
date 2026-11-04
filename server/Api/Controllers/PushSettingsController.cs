using Blocks.Genesis;
using Configuration.DomainService.Notification.Push;
using Microsoft.AspNetCore.Mvc;

namespace BlocksOs.Api.Controllers;

/// <summary>
/// Mobile push (Firebase) settings of the project. Routing only; every rule is in <see cref="IPushSettingsService"/>.
/// No action ever returns a Firebase value.
/// </summary>
[ApiController]
[Route("[controller]/[action]")]
public class PushSettingsController : ControllerBase
{
    private readonly IPushSettingsService _service;

    public PushSettingsController(IPushSettingsService service)
    {
        _service = service;
    }

    [HttpGet]
    [ProtectedEndPoint("blocks-os::notification::gets")]
    public Task<PushSettingsView> Get(CancellationToken cancellationToken) =>
        _service.GetAsync(cancellationToken);

    [HttpPost]
    [ProtectedEndPoint("blocks-os::notification::save")]
    public Task<BaseResponse> Save([FromBody] SavePushSettingsRequest request, CancellationToken cancellationToken) =>
        _service.SaveAsync(request, cancellationToken);
}
