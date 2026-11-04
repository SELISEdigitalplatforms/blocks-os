using Blocks.Genesis;
using Configuration.DomainService.Storage.RequestModel;
using Configuration.DomainService.Storage.Services;
using Microsoft.AspNetCore.Mvc;

namespace BlocksOs.Api.Controllers
{
    [ApiController]
    [Route("[controller]/[action]")]

    public class StorageController : ControllerBase
    {
        private readonly IStorageConfigurationService _storageConfigurationService;

        public StorageController(IStorageConfigurationService storageConfigurationService)
        {
            _storageConfigurationService = storageConfigurationService;
        }

        [HttpPost]
        [ProtectedEndPoint("blocks-os::storage::mutate")]
        public async Task<BaseMutationResponse> Save([FromBody] SaveStorageConfigurationRequest request)
        {
            return await _storageConfigurationService.SaveAsync(request);
        }

        [HttpGet]
        [ProtectedEndPoint("blocks-os::storage::gets")]
        public async Task<List<StorageConfigurationResponse>> Gets([FromQuery] GetStorageConfigurationsRequest request)
        {
            return await _storageConfigurationService.GetAllAsync();
        }

        [HttpGet]
        [ProtectedEndPoint("blocks-os::storage::gets")]
        public async Task<StorageConfigurationResponse?> Get([FromQuery] GetStorageConfigurationRequest request)
        {
            return await _storageConfigurationService.GetAsync(request?.ConfigurationName ?? string.Empty);
        }

        [HttpPost]
        [ProtectedEndPoint("blocks-os::storage::mutate")]
        public async Task<BaseResponse> Delete([FromQuery] DeleteStorageConfigurationRequest request)
        {
            return await _storageConfigurationService.DeleteAsync(request?.ConfigurationName ?? string.Empty);
        }

    }
}
