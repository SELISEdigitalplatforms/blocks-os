using Cloud.LmtService.Models.ColdRestore;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Cloud.LmtService.Services.ColdRestore
{
    public interface IArchiveRestoreService
    {
        Task<StartArchiveRestoreResponse> StartArchiveRestoreAsync(StartArchiveRestoreRequest request, CancellationToken ct = default);
        Task ProcessRestoreAsync(ArchiveRestoreMessage message, CancellationToken ct = default);
        Task CheckPendingHydrationsAsync(CancellationToken ct = default);
        Task DeleteExpiredHydrationJobsAsync(CancellationToken ct = default);
    }
}
