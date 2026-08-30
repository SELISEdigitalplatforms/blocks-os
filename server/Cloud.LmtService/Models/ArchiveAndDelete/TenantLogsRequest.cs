using Blocks.Genesis;

namespace Cloud.LmtService.Models.ArchiveAndDelete
{
    public class TenantLogsRequest: BaseGetsRequest<TenantLogsRequestByFilter>, IProjectKey
    {
        public string? ProjectKey { get; set; }
    }

    public class TenantLogsRequestByFilter
    {
        public DateTime? StartDate { get; set; }
        public DateTime? EndDate { get; set; }
    }

}
