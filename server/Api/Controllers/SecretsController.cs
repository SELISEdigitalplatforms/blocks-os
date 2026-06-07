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

        public SecretsController(ISecretManagementService secretManagementService)
        {
            _secretManagementService = secretManagementService;
        }


        [Authorize]
        [HttpPost]
        public async Task<BaseResponse> Save([FromBody] SaveSecretRequest request)
        {
            return await _secretManagementService.SaveSecretAsync(request);
        }

        [Authorize]
        [HttpGet]
        public async Task<GetSecretsResponse> Gets([FromQuery] GetSecretsRequest request)
        {
            return await _secretManagementService.GetSecretAsync(request.SecretKey.ToLower(), request.PageNumber ?? 1, request.PageSize ?? 10);
        }

        [Authorize]
        [HttpGet]
        public async Task<Secret> Get([FromQuery] GetSecretRequest request)
        {
            return await _secretManagementService.SecretAsync(request.ItemId);
        }

        [Authorize]
        [HttpPost]
        public async Task<BaseResponse> Delete([FromBody] DeleteSecretRequest request)
        {
            return await _secretManagementService.DeleteSecretAsync(request);
        }
    }
}
