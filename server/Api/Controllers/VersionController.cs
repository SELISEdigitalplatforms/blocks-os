using System.Reflection;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace BlocksOs.Api.Controllers
{
    /// <summary>
    /// Reports the running API assembly version. Public by design (no auth) so health/deploy
    /// tooling can read it without a token. Route is <c>GET /api/version</c> via the global
    /// <see cref="GlobalApiRoutePrefixConvention"/> "api" prefix.
    /// </summary>
    [ApiController]
    [AllowAnonymous]
    [Route("[controller]")]
    public class VersionController : ControllerBase
    {
        [HttpGet]
        public IActionResult Get()
        {
            var version = Assembly.GetExecutingAssembly().GetName().Version?.ToString() ?? "unknown";
            return Ok(new VersionResponse(version));
        }
    }

    public sealed record VersionResponse(string Version);
}
