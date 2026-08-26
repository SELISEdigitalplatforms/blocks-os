using Cloud.LmtService.Models.ColdRestore;
using MongoDB.Bson;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Cloud.LmtService.Repositories.ColdRestore
{
    public interface IArchiveRestoreRepository
    {
        Task CreateHydrationJobAsync(ArchiveHydrationJobRecord record, CancellationToken ct = default);

        Task<List<ArchiveHydrationJobRecord>> GetPendingHydrationJobsAsync(CancellationToken ct = default);

        Task UpdateHydrationStatusAsync(string requestId, ArchiveHydrationStatus status, DateTime? lastCheckedAt = null, DateTime? completedAt = null, string? errorMessage = null, CancellationToken ct = default);

        Task UpdateHydrationStatusByIdAsync(ObjectId id, ArchiveHydrationStatus status, DateTime? lastCheckedAt = null, DateTime? completedAt = null, string? errorMessage = null, CancellationToken ct = default);

        Task<bool> HydrationJobExistsAsync(string requestId,string blobPath, CancellationToken ct = default);
    }
}
