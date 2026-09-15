using System;
using System.Collections.Generic;
using System.Text;
using Blocks.Genesis;

namespace Cloud.LmtService.Models.Trace
{
    public class GetTracesRequest : BaseGetsRequest<GetTracesRequestFilter>
    {
        public string? Search { get; set; }
    }

    public class GetTracesRequestFilter
    {
        public DateTime? StartDate { get; set; } = null;
        public DateTime? EndDate { get; set; } = null;
        public List<string> Services { get; set; } = new List<string>();
        public List<string> Excepts { get; set; } = new List<string>();
        public List<int> StatusCodes { get; set; } = new List<int>();

        // Leading digit of the HTTP status: 2 matches any 2xx, 5 any 5xx. Kept separate from
        // StatusCodes so the UI can offer classes without enumerating every code that exists.
        public List<int> StatusCodeClasses { get; set; } = new List<int>();
    }
    public class GetTracesResponse : BaseQueryListResponse<IQueryable<object>>
    {

    }
}
