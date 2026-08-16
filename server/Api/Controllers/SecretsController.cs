using Blocks.Genesis;
using Blocks.Secrets;
using Microsoft.AspNetCore.Mvc;

namespace BlocksOs.Api.Controllers;

/// <summary>
/// Secret management endpoints.
/// </summary>
/// <remarks>
/// Routing, permissions and request/response mapping only. Every domain rule — tenant scope,
/// access lists, status, rotation, audit — lives in <see cref="ISecretService"/>, which
/// re-checks everything regardless of what the transport did.
/// <para>
/// No action returns a <see cref="Secret"/> entity. Metadata goes out as
/// <see cref="SecretResult"/>, which has no value and no vault coordinates.
/// </para>
/// </remarks>
[ApiController]
[Route("[controller]")]
public class SecretsController : ControllerBase
{
    private readonly ISecretService _secretService;

    public SecretsController(ISecretService secretService)
    {
        _secretService = secretService;
    }

    [HttpPost("set")]
    [ProtectedEndPoint("blocks-os::secret::save")]
    public async Task<SetSecretApiResponse> Set([FromBody] SetSecretRequest request, CancellationToken cancellationToken)
    {
        var secretId = await _secretService.SetAsync(request, cancellationToken);
        return new SetSecretApiResponse { SecretId = secretId };
    }

    [HttpPost("set-many")]
    [ProtectedEndPoint("blocks-os::secret::save")]
    public async Task<SetManySecretsApiResponse> SetMany([FromBody] IReadOnlyCollection<SetSecretRequest> requests, CancellationToken cancellationToken)
    {
        var secretIds = await _secretService.SetManyAsync(requests, cancellationToken);
        return new SetManySecretsApiResponse { SecretIds = secretIds };
    }

    [HttpGet("get")]
    [ProtectedEndPoint("blocks-os::secret::gets")]
    public async Task<ActionResult<SecretResult>> Get([FromQuery] string secretId, CancellationToken cancellationToken)
    {
        var secret = await _secretService.GetAsync(secretId, cancellationToken);
        return secret is null ? NotFound() : Ok(secret);
    }

    [HttpGet("gets")]
    [ProtectedEndPoint("blocks-os::secret::gets")]
    public Task<SecretListResult> Gets([FromQuery] SecretFilter filter, CancellationToken cancellationToken) =>
        _secretService.FindAsync(filter, cancellationToken);

    /// <summary>
    /// Reads a secret's plaintext value. Always audited.
    /// </summary>
    [HttpGet("value")]
    [ProtectedEndPoint("blocks-os::secret::get-value")]
    public async Task<SecretValueApiResponse> Value([FromQuery] string secretId, CancellationToken cancellationToken)
    {
        var value = await _secretService.GetValueAsync(secretId, cancellationToken);

        // The response body carries plaintext, so keep it out of every cache between here and
        // the browser.
        Response.Headers.CacheControl = "no-store, no-cache, must-revalidate";
        Response.Headers.Pragma = "no-cache";

        return new SecretValueApiResponse { SecretId = secretId, Value = value };
    }

    [HttpPost("values")]
    [ProtectedEndPoint("blocks-os::secret::get-value")]
    public async Task<SecretValuesApiResponse> Values([FromBody] GetSecretValuesApiRequest request, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(request);

        var values = await _secretService.GetValuesAsync(request.SecretIds, cancellationToken);

        Response.Headers.CacheControl = "no-store, no-cache, must-revalidate";
        Response.Headers.Pragma = "no-cache";

        return new SecretValuesApiResponse { Values = values };
    }

    [HttpPost("update")]
    [ProtectedEndPoint("blocks-os::secret::update")]
    public async Task<BaseResponse> Update([FromBody] UpdateSecretApiRequest request, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(request);

        await _secretService.UpdateAsync(
            request.SecretId,
            new UpdateSecretRequest { Name = request.Name, Description = request.Description },
            cancellationToken);

        return Success();
    }

    [HttpPost("rotate")]
    [ProtectedEndPoint("blocks-os::secret::rotate")]
    public async Task<BaseResponse> Rotate([FromBody] RotateSecretApiRequest request, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(request);

        await _secretService.RotateAsync(request.SecretId, new RotateSecretRequest { Value = request.Value }, cancellationToken);
        return Success();
    }

    [HttpPost("lock")]
    [ProtectedEndPoint("blocks-os::secret::lock")]
    public async Task<BaseResponse> Lock([FromBody] SecretIdRequest request, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(request);

        await _secretService.LockAsync(request.SecretId, cancellationToken);
        return Success();
    }

    /// <summary>Unlocks a secret. Shares the lock permission — they are one capability.</summary>
    [HttpPost("unlock")]
    [ProtectedEndPoint("blocks-os::secret::lock")]
    public async Task<BaseResponse> Unlock([FromBody] SecretIdRequest request, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(request);

        await _secretService.UnlockAsync(request.SecretId, cancellationToken);
        return Success();
    }

    [HttpDelete("delete")]
    [ProtectedEndPoint("blocks-os::secret::delete")]
    public async Task<BaseResponse> Delete([FromQuery] string secretId, CancellationToken cancellationToken)
    {
        await _secretService.DeleteAsync(secretId, cancellationToken);
        return Success();
    }

    [HttpPost("restore")]
    [ProtectedEndPoint("blocks-os::secret::restore")]
    public async Task<BaseResponse> Restore([FromBody] SecretIdRequest request, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(request);

        await _secretService.RestoreAsync(request.SecretId, cancellationToken);
        return Success();
    }

    [HttpPost("access")]
    [ProtectedEndPoint("blocks-os::secret::access")]
    public async Task<BaseResponse> Access([FromBody] UpdateSecretAccessApiRequest request, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(request);

        await _secretService.UpdateAccessAsync(request.SecretId, request.Access, cancellationToken);
        return Success();
    }

    [HttpGet("audit")]
    [ProtectedEndPoint("blocks-os::secret::audit")]
    public Task<SecretAuditListResult> Audit([FromQuery] SecretAuditFilter filter, CancellationToken cancellationToken) =>
        _secretService.GetAuditLogsAsync(filter, cancellationToken);

    private static BaseResponse Success() => new() { IsSuccess = true };
}
