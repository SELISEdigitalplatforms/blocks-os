using Microsoft.AspNetCore.Mvc;
using System.Reflection;

namespace BlocksTemplate.Api.Controllers
{
    [ApiController]
    [Route("[controller]")]
    public class VersionController : ControllerBase
    {
        [HttpGet]
        [Route("")]
        public IActionResult Get()
        {
            return Ok(new { version = Assembly.GetExecutingAssembly().GetName().Version?.ToString() ?? "unknown" });
        }
    }
}
