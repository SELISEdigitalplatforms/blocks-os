using Blocks.Genesis;
using Blocks.Secrets;
using Configuration.DomainService.Shared.Secrets;
using Microsoft.AspNetCore.Authorization;
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
    /// <summary>
    /// The reason code <c>ISecretService</c> attaches when a value read targets an archived secret.
    /// </summary>
    internal const string StatusDeletedReason = "STATUS_DELETED";

    internal const string ArchivedValueMessage = "This secret is archived. Restore it to read its value.";

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
    /// The CAPTCHA and Office 365 mail configurations that point at a secret, so the Archive and
    /// Purge dialogs can warn before breaking them.
    /// </summary>
    /// <remarks>
    /// Shares the metadata read permission: the answer names configurations, not values.
    /// Advisory only — nothing refuses an archive or purge because of it. An unknown id, or one
    /// from another tenant, answers an empty list rather than 404 so existence is not revealed.
    /// </remarks>
    [HttpGet("dependents")]
    [Authorize]
    [ProtectedEndPoint("blocks-os::secret::gets")]
    public Task<SecretDependentsResult> Dependents(
        [FromQuery] string? secretId,
        [FromServices] ISecretDependentLookup lookup,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(lookup);

        if (string.IsNullOrWhiteSpace(secretId))
        {
            // Raised as the domain's validation error so the existing exception filter shapes the
            // 400 exactly like every other bad request on this controller.
            throw new SecretValidationException("secretId is required.");
        }

        return lookup.FindAsync(secretId, cancellationToken);
    }

    /// <summary>
    /// The tenant's tag catalogue, for a tag picker or a tag filter.
    /// </summary>
    /// <remarks>
    /// Shares the list permission rather than having its own: the catalogue is a list of
    /// labels, and anyone who may see the secret list may see the labels on it.
    /// </remarks>
    [HttpGet("tags")]
    [ProtectedEndPoint("blocks-os::secret::gets")]
    public Task<IReadOnlyList<SecretTagEntry>> Tags(CancellationToken cancellationToken) =>
        _secretService.GetTagsAsync(cancellationToken);

    /// <summary>
    /// Reads a secret's plaintext value. Always audited.
    /// </summary>
    [HttpGet("value")]
    [ProtectedEndPoint("blocks-os::secret::get-value")]
    public async Task<SecretValueApiResponse> Value([FromQuery] string secretId, CancellationToken cancellationToken)
    {
        var value = await ReadArchivedAsBadRequest(() => _secretService.GetValueAsync(secretId, cancellationToken));

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

        var values = await ReadArchivedAsBadRequest(() => _secretService.GetValuesAsync(request.SecretIds, cancellationToken));

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
            new UpdateSecretRequest { Name = request.Name, Description = request.Description, Tags = request.Tags },
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

    /// <summary>
    /// Permanently deletes an already-deleted secret: metadata and vault value. Shares the delete
    /// permission — it is the second half of the same capability, and only reaches secrets the
    /// soft delete has already taken out of service.
    /// </summary>
    [HttpDelete("purge")]
    [ProtectedEndPoint("blocks-os::secret::delete")]
    public async Task<BaseResponse> Purge([FromQuery] string secretId, CancellationToken cancellationToken)
    {
        await _secretService.PurgeAsync(secretId, cancellationToken);
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

    /// <summary>
    /// Re-raises a value read on an archived secret as a validation error, which the existing
    /// <see cref="SecretExceptionFilter"/> turns into 400 with reason <c>STATUS_DELETED</c>.
    /// </summary>
    /// <remarks>
    /// Done here rather than in the filter because the filter ships in the
    /// <c>SeliseBlocks.Secrets.OS</c> package, and changing it would change status codes for every
    /// service that consumes it. Every other state failure — locked included — keeps its 409, and
    /// the read has already been audited by the service, so the audit trail is unchanged.
    /// </remarks>
    private static async Task<T> ReadArchivedAsBadRequest<T>(Func<Task<T>> read)
    {
        try
        {
            return await read();
        }
        catch (SecretStateException exception) when (exception.ReasonCode == StatusDeletedReason)
        {
            throw new SecretValidationException(ArchivedValueMessage, StatusDeletedReason);
        }
    }
}
