using Microsoft.AspNetCore.Mvc;
using System.Reflection;

namespace BlocksTemplate.Api.Controllers
{
    [ApiController]
    [Route("[controller]")]
    public class VersionController : ControllerBase
    {
        [HttpGet]
        public IActionResult Get()
        {
            var version = Assembly.GetExecutingAssembly().GetName().Version?.ToString() ?? "unknown";

            return Ok(new { version });
        }
    }
}
