using System;
using System.Collections.Generic;
using System.Text;

namespace Cloud.LmtService.Models.Logs
{
    public class LiveLogRequest
    {
        public string? Name { get; set; }
        public List<string> ServiceNames { get; set; } = [];
        public DateTime LastDate { get; set; }
    }
}
