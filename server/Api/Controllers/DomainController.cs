using Blocks.Genesis;
using DomainService.Shared;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace BlocksOs.Api.Controllers
{
 [ApiController]
 [Route("[controller]/[action]")]
 public class DomainController : ControllerBase
 {
  private readonly IDomainManagementService _domainManagementService;

  public DomainController(IDomainManagementService domainManagementService)
  {
   _domainManagementService = domainManagementService;
  }

  [Authorize]
  [HttpPost]
  public async Task<BaseResponse> Configure([FromBody] ConfigureDomainRequest request)
  {
    if (string.IsNullOrWhiteSpace(request.CookieDomain))
    {
     return new BaseResponse { IsSuccess = false, Errors = new Dictionary<string, string> { { "missing_required_fields", "domain name is missing" } } };
    }

    return await _domainManagementService.ConfigureDomainAsync(request);
  }
 }
}
