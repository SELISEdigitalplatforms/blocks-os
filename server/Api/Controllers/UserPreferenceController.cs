using DomainService.Preference;
using DomainService.Preference.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace BlocksOs.Api.Controllers
{
    /// <summary>
    /// The signed-in user's own settings, by key (<see cref="UserPreferenceKeys"/>), such as the
    /// console sidebar's favourites and app order, so they follow the user across browsers.
    /// </summary>
    /// <remarks>
    /// Deliberately <c>[Authorize]</c> only, with no resource name and no project policy, like
    /// <see cref="PeopleController.GetMyAccess"/>: every action reads or writes the caller's own
    /// rows and no one else's, so there is nothing a grant could add. Routing and response mapping
    /// only; the rules live in <see cref="IUserPreferenceService"/>.
    /// </remarks>
    [ApiController]
    [Route("[controller]/[action]")]
    public class UserPreferenceController : ControllerBase
    {
        private readonly IUserPreferenceService _service;

        public UserPreferenceController(IUserPreferenceService service)
        {
            _service = service;
        }

        /// <summary>The caller's value for a key; <c>value</c> is null when never saved.</summary>
        [HttpGet]
        [Authorize]
        public async Task<IActionResult> Get([FromQuery] GetUserPreferenceRequest request, CancellationToken cancellationToken)
        {
            var result = await _service.GetAsync(request, cancellationToken);
            return result.IsSuccess ? Ok(result) : BadRequest(result);
        }

        /// <summary>Sets the caller's value for a key, replacing any earlier one.</summary>
        [HttpPost]
        [Authorize]
        public async Task<IActionResult> Save([FromBody] SaveUserPreferenceRequest request, CancellationToken cancellationToken)
        {
            var result = await _service.SaveAsync(request, cancellationToken);
            return result.IsSuccess ? Ok(result) : BadRequest(result);
        }
    }
}
