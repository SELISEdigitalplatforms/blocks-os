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
    }
}
