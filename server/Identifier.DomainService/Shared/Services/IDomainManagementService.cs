using Blocks.Genesis;
using DomainService.Shared.Entities;

namespace DomainService.Shared
{
    public interface IDomainManagementService
    {
        Task<BaseResponse> ConfigureDomainAsync(ConfigureDomainRequest request);
        Task<(bool, string)> DisableDomainBindingAsync(DisableDomainBindingRequest request);

        /// <summary>The DNS records and API base URL for every domain on the current project.</summary>
        Task<DomainSetupGuideResponse> GetDomainSetupGuideAsync();

        /// <summary>
        /// Configures a domain like <see cref="ConfigureDomainAsync"/>, reporting each step to
        /// <paramref name="onProgress"/> as it finishes.
        /// </summary>
        Task<BaseResponse> ConfigureDomainWithProgressAsync(ConfigureDomainRequest request, Func<DomainSetupProgress, Task> onProgress);
    }
}
