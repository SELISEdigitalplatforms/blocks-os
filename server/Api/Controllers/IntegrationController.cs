using Blocks.Genesis;
using Configuration.DomainService.Integration.Entities;
using Configuration.DomainService.Integration.RequestModel;
using Configuration.DomainService.Integration.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace BlocksOs.Api.Controllers
{
    /// <summary>
    /// Integration setup endpoints. Routing only; the rules live in <see cref="IIntegrationService"/>.
    /// </summary>
    /// <remarks>
    /// Protected by their own permissions, like Storage and Notification, so access to Integration can
    /// be granted apart from Secrets. Both permissions are seeded from
    /// <c>server/seed/integration-permissions.upsert.json</c> into the root tenant's <c>Permissions</c>.
    /// </remarks>
    [ApiController]
    [Route("[controller]/[action]")]
    public class IntegrationController : ControllerBase
    {
        private readonly IIntegrationService _integrationService;
        private readonly IIntegrationConnectService _connectService;
        private readonly IIntegrationRateLimiter _rateLimiter;

        public IntegrationController(IIntegrationService integrationService, IIntegrationConnectService connectService, IIntegrationRateLimiter rateLimiter)
        {
            _integrationService = integrationService;
            _connectService = connectService;
            _rateLimiter = rateLimiter;
        }

        /// <summary>
        /// Lists the active integration templates, optionally narrowed to one family, sorted by <c>SortOrder</c>.
        /// </summary>
        [HttpGet]
        [ProtectedEndPoint("blocks-os::integration::get")]
        public Task<List<IntegrationTemplate>> GetTemplates([FromQuery] string? family) =>
            _integrationService.GetTemplatesAsync(family);

        /// <summary>
        /// Fetches one template by key, including inactive ones when asked, so legacy setups can
        /// still resolve their base URL.
        /// </summary>
        [HttpGet]
        [ProtectedEndPoint("blocks-os::integration::get")]
        public Task<IntegrationTemplate?> GetTemplate([FromQuery] string key, [FromQuery] bool includeInactive = false) =>
            _integrationService.GetTemplateByKeyAsync(key, includeInactive);

        /// <summary>
        /// Lists the environment's integration connections. Replaces the old <c>GetSetup</c>.
        /// </summary>
        /// <remarks>
        /// The response never contains a client secret: rows carry the client id and metadata only,
        /// so a list read can never leak credential material. Records predating per-connection
        /// setups are labelled "Legacy connection".
        /// </remarks>
        [HttpGet]
        [ProtectedEndPoint("blocks-os::integration::get")]
        public async Task<ActionResult<BaseQueryResponse<List<IntegrationSetup>>>> GetConnections()
        {
            var result = await _integrationService.GetConnectionsAsync();
            return result.Errors is null ? Ok(result) : BadRequest(result);
        }

        /// <summary>
        /// Creates a connection in one server-side call. Replaces the old browser-run setup and <c>SaveSetup</c>.
        /// </summary>
        /// <remarks>
        /// Resolves the template's permissions, reuses or creates its IAM role, and creates a client
        /// credential named for this connection. This and <see cref="RegenerateSecret"/> are the only
        /// endpoints that return a client secret, and they return it exactly once. An interrupted run
        /// can be repeated without leaving duplicates behind.
        /// </remarks>
        [HttpPost]
        [ProtectedEndPoint("blocks-os::integration::save")]
        public async Task<ActionResult<RunIntegrationSetupResponse>> RunSetup([FromBody] RunIntegrationSetupRequest request)
        {
            var result = await _integrationService.RunSetupAsync(request);
            return result.IsSuccess ? Ok(result) : BadRequest(result);
        }

        /// <summary>
        /// Disconnects a connection: deletes its IAM client credential and marks the record revoked.
        /// </summary>
        /// <remarks>
        /// If IAM cannot delete the credential the record stays active and <c>iam_error</c> is
        /// returned, so a live credential is never recorded as disconnected.
        /// </remarks>
        [HttpPost]
        [ProtectedEndPoint("blocks-os::integration::save")]
        public async Task<ActionResult<BaseMutationResponse>> Disconnect([FromBody] IntegrationConnectionRequest request)
        {
            var result = await _integrationService.DisconnectAsync(request.ConnectionId);
            return result.IsSuccess ? Ok(result) : BadRequest(result);
        }

        /// <summary>
        /// Rotates a connection's client secret. The client id is unchanged; the new secret is
        /// returned once, here and nowhere else.
        /// </summary>
        [HttpPost]
        [ProtectedEndPoint("blocks-os::integration::save")]
        public async Task<ActionResult<RegenerateIntegrationSecretResponse>> RegenerateSecret([FromBody] IntegrationConnectionRequest request)
        {
            var result = await _integrationService.RegenerateSecretAsync(request.ConnectionId);
            return result.IsSuccess ? Ok(result) : BadRequest(result);
        }

        /// <summary>
        /// Reports whether the environment's permission store has every permission the template
        /// grants, so the connect flow can wait for freshly provisioned environments.
        /// </summary>
        [HttpGet]
        [ProtectedEndPoint("blocks-os::integration::get")]
        public async Task<ActionResult<CheckIntegrationReadinessResponse>> CheckReadiness([FromQuery] string templateKey)
        {
            var result = await _integrationService.CheckReadinessAsync(templateKey);
            return string.IsNullOrWhiteSpace(result.Error) ? Ok(result) : BadRequest(result);
        }

        /// <summary>
        /// Reads a connect request for the Approve screen. The first call by a logged-in user
        /// claims the request; after that only the claimer can see, approve or cancel it.
        /// </summary>
        [HttpGet]
        [Authorize]
        public async Task<ActionResult<GetIntegrationRequestResponse>> GetRequest([FromQuery] string requestId, CancellationToken cancellationToken)
        {
            var (response, errors) = await _connectService.GetRequestAsync(requestId, cancellationToken);
            return errors is null ? Ok(response) : BadRequest(new { errors });
        }

        /// <summary>
        /// Cancels a claimed connect request and redirects the browser back to the CMS with
        /// <c>error=access_denied</c> and the original state.
        /// </summary>
        [HttpPost]
        [Authorize]
        public async Task<ActionResult<CancelIntegrationRequestResponse>> Cancel([FromBody] CancelIntegrationRequest request, CancellationToken cancellationToken)
        {
            var (response, errors) = await _connectService.CancelRequestAsync(request, cancellationToken);
            return errors is null ? Ok(response) : BadRequest(new { errors });
        }

        /// <summary>
        /// Approves a claimed connect request: runs the server-side setup, stores a one-time code
        /// hash and the credential secret encrypted, and returns the redirect to the CMS carrying
        /// code, state and blocks_key. Double-approve returns the same redirect idempotently.
        /// </summary>
        /// <remarks>
        /// Must run inside the chosen environment (impersonated) with <c>blocks-os::integration::save</c>.
        /// The user must be the request's claimer.
        /// </remarks>
        [HttpPost]
        [ProtectedEndPoint("blocks-os::integration::save")]
        public async Task<ActionResult<ApproveIntegrationRequestResponse>> Approve([FromBody] ApproveIntegrationRequest request, CancellationToken cancellationToken)
        {
            var (response, errors) = await _connectService.ApproveRequestAsync(request, cancellationToken);
            return errors is null ? Ok(response) : BadRequest(new { errors });
        }

        /// <summary>
        /// Redeems a one-time code server to server: verifies PKCE S256 and the redirect URI,
        /// returns the connection's keys, and removes the stored secret. A failed attempt burns
        /// the code. Rate limited per IP; over the limit responds 429.
        /// </summary>
        [HttpPost]
        [AllowAnonymous]
        public async Task<ActionResult<ExchangeIntegrationRequestResponse>> Exchange([FromBody] ExchangeIntegrationRequest request, CancellationToken cancellationToken)
        {
            try
            {
                await _rateLimiter.EnforceAsync("Exchange", IntegrationClientIp.Resolve(HttpContext), cancellationToken);
                var (response, errors) = await _connectService.ExchangeAsync(request, cancellationToken);
                return errors is null ? Ok(response) : BadRequest(new { errors });
            }
            catch (BlocksRateLimitException)
            {
                return StatusCode(StatusCodes.Status429TooManyRequests, new { errors = new Dictionary<string, string> { ["rate_limited"] = "Too many requests. Try again later." } });
            }
        }

        /// <summary>
        /// Opens an anonymous "Connect with Blocks" request from a CMS and returns its id and expiry.
        /// Rate limited per IP; over the limit responds 429 with the <c>rate_limited</c> error.
        /// </summary>
        [HttpPost]
        [AllowAnonymous]
        public async Task<ActionResult<CreateIntegrationRequestResponse>> CreateRequest([FromBody] CreateIntegrationRequest request, CancellationToken cancellationToken)
        {
            try
            {
                await _rateLimiter.EnforceAsync("CreateRequest", IntegrationClientIp.Resolve(HttpContext), cancellationToken);
                var (response, errors) = await _connectService.CreateRequestAsync(request, cancellationToken);
                return errors is null ? Ok(response) : BadRequest(new { errors });
            }
            catch (BlocksRateLimitException)
            {
                return StatusCode(StatusCodes.Status429TooManyRequests, new { errors = new Dictionary<string, string> { ["rate_limited"] = "Too many requests. Try again later." } });
            }
        }
    }
}
