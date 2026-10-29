using Cloud.LmtService.Models.ColdRestore;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Cloud.LmtService.Services.ColdRestore
{
    public interface ILogTraceRestoreParquetReader
    {
        IAsyncEnumerable<RestoreTraceRow> ReadTracesAsync(Stream stream, CancellationToken ct = default);

        IAsyncEnumerable<RestoreLogRow> ReadLogsAsync(Stream stream, CancellationToken ct = default);
    }
}
