using Blocks.Genesis;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Secrets.DomainService.Entities;
using Secrets.DomainService.ResponseModel;
using Secrets.DomainService.Services;

namespace BlocksTemplate.Api.Controllers
{
    [ApiController]
    [Route("[controller]/[action]")]

    public class SecretsController : ControllerBase
    {
        private readonly ISecretManagementService _secretManagementService;
        private readonly ChangeControllerContext _changeControllerContext;

        public SecretsController(ISecretManagementService secretManagementService,
                                ChangeControllerContext changeControllerContext)
        {
            _secretManagementService = secretManagementService;
            _changeControllerContext = changeControllerContext;
        }


        [Authorize]
        [HttpPost]
        public async Task<BaseResponse> Save([FromBody] SaveSecretRequest request)
        {
            _changeControllerContext.ChangeContext(request);
            return await _secretManagementService.SaveSecretAsync(request);
        }

        [Authorize]
        [HttpGet]
        public async Task<List<Secret>> Gets([FromQuery] GetSecretsRequest request)
        {
            _changeControllerContext.ChangeContext(request);
            return await _secretManagementService.GetSecretAsync(request.SecretKey.ToLower());
        }

        [Authorize]
        [HttpGet]
        public async Task<Secret> Get([FromQuery] GetSecretRequest request)
        {
            _changeControllerContext.ChangeContext(request);
            return await _secretManagementService.SecretAsync(request.ItemId);
        }

        [Authorize]
        [HttpPost]
        public async Task<BaseResponse> Delete([FromBody] DeleteSecretRequest request)
        {
            _changeControllerContext.ChangeContext(request);
            return await _secretManagementService.DeleteSecretAsync(request);
        }
    }
}
