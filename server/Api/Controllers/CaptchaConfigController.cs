using Blocks.Genesis;
using Configuration.DomainService.Captcha.RequestModel;
using Configuration.DomainService.Captcha.ResponseModel;
using Configuration.DomainService.Captcha.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace BlocksOs.Api.Controllers;

/// <summary>
/// Captcha configuration endpoints.
/// </summary>
/// <remarks>
/// Routing and request/response mapping only, mirroring <see cref="SecretsController"/>. Every
/// domain rule lives in <see cref="ICaptchaConfigService"/>, which delegates any secret-value
/// handling to the existing, unmodified <c>ISecretService</c> — nothing here calls the vault
/// directly.
/// <para>
/// No action here ever returns a secret value. Reads carry <see cref="CaptchaConfigResult.SecretId"/>
/// instead — a pointer a caller with the right permission can resolve via
/// <c>GET /secrets/value</c> on <see cref="SecretsController"/>, an endpoint this controller
/// neither calls nor duplicates.
/// </para>
/// </remarks>
[ApiController]
[Route("captcha")]
public class CaptchaConfigController : ControllerBase
{
    private readonly ICaptchaConfigService _service;

    public CaptchaConfigController(ICaptchaConfigService service)
    {
        _service = service;
    }

    [HttpPost("save")]
    [Authorize]
    //[ProtectedEndPoint("blocks-os::secret-config::save")]
    public Task<CaptchaConfigResult> Save([FromBody] SaveCaptchaConfigRequest request, CancellationToken cancellationToken) =>
        _service.SaveAsync(request, cancellationToken);

    [HttpGet("get")]
    [Authorize]
    //[ProtectedEndPoint("blocks-os::secret-config::get")]
 public async Task<ActionResult<CaptchaConfigResult>> Get(CancellationToken cancellationToken)
    {
        var result = await _service.GetAsync(cancellationToken);
        return result is null ? NotFound() : Ok(result);
    }

    [HttpDelete("delete")]
    [Authorize]
    //[ProtectedEndPoint("blocks-os::secret-config::delete")]
 public async Task<BaseResponse> Delete(CancellationToken cancellationToken)
    {
        await _service.DeleteAsync(cancellationToken);
        return new BaseResponse { IsSuccess = true };
    }
}
