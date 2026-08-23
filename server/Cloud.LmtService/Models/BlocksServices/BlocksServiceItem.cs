using System.Collections.Generic;

namespace Cloud.LmtService.Models.BlocksServices
{
    public class BlocksServiceItem
    {
        public string Key { get; set; } = string.Empty;
        public string Label { get; set; } = string.Empty;
        public int SortOrder { get; set; }
        public string ApiServiceName { get; set; } = string.Empty;
        public List<string> WorkerServiceNames { get; set; } = [];
    }
}
