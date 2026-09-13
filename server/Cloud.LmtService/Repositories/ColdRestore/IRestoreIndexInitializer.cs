namespace Cloud.LmtService.Repositories.ColdRestore
{
    public interface IRestoreIndexInitializer
    {
        /// <summary>
        /// Creates any missing indexes on the restore collections. Safe to call repeatedly, and
        /// never throws — missing indexes degrade performance, they do not break correctness.
        /// </summary>
        Task EnsureIndexesAsync(CancellationToken ct = default);
    }
}
