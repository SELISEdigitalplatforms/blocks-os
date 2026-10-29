using Blocks.Genesis;
using DomainService.Entities;


namespace DomainService.Projects
{
    public class GetProjectResponse : BaseQueryResponse<GetProjectResponseData>
    {

    }
    public class GetProjectResponseData : Project
    {
        public string TenantSlug { get; set; }

        /// <summary>
        /// Verbatim from the tenant document. Gates third-party token trust in Genesis;
        /// lowered automatically when the last active provider disappears, raised only via
        /// UpdateThirdPartyJwtEnabled when at least one active provider exists.
        /// </summary>
        public bool IsThirdPartyJwtEnabled { get; set; }
    }
}
