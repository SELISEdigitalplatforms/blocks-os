using Blocks.Genesis;
using DomainService.Shared.Entities;

namespace DomainService.Projects
{
    public class GetAssetRequest : BaseGetsRequest<GetAssetFilter>
    {
        public string TenantGroupId { get; set; }
    }

    public class GetAssetFilter
    {
        /// <summary>Free text matched against either the repository name or its link.</summary>
        public string Search { get; set; }
        public string Name { get; set; }
        public string Link { get; set; }
    }

    public class GetAssetResponse : BaseResponse
    {
        public TenantAsset Assets { get; set; }
        public long TotalCount { get; set; }
    }
}


