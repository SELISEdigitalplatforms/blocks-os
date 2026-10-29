namespace Cloud.LmtService.Repositories.ArchiveAndDelete
{
    public interface IArchiveRepository
    {
        Task<List<string>> GetDistinctTenantIdsAsync();
    }
}
