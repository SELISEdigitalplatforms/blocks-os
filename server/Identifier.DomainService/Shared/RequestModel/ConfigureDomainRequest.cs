
using Blocks.Genesis;

namespace DomainService.Shared
{
    public class ConfigureDomainRequest
    {
        public string? ProjectKey { get; set; }
        public string CookieDomain { get; set; }
    }
}
