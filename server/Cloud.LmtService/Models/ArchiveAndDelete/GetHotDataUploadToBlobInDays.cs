using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Cloud.LmtService.Models.ArchiveAndDelete
{
    public class GetHotDataUploadToBlobInDays
    {
        public int ColdDataSelectionDays { get; set; }
        public int ArchiveDataSelectionDays { get; set; }
        public int ColdMaxRangeDays { get; set; }
        public int ArchiveMaxRangeDays { get; set; }
        public string ColdEarliestDate { get; set; } = string.Empty;
        public string ColdLatestDate { get; set; } = string.Empty;
        public string ArchiveLatestDate { get; set; } = string.Empty;
    }
}
