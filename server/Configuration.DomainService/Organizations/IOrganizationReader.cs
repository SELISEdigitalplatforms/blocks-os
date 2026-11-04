namespace Configuration.DomainService.Organizations
{
    /// <summary>An enabled organization, as much of it as mail configuration needs.</summary>
    public sealed record OrganizationSummary(string ItemId, string Name);

    /// <summary>
    /// Read-only access to the organizations blocks-iam keeps in the current project database.
    /// </summary>
    public interface IOrganizationReader
    {
        /// <summary>
        /// True for <see cref="OrganizationIds.Default"/>, and for an organization that exists and
        /// is not disabled.
        /// </summary>
        Task<bool> ExistsEnabledAsync(string organizationId, CancellationToken cancellationToken = default);

        /// <summary>
        /// One page of enabled organizations ordered by id, starting after <paramref name="after"/>
        /// (null for the first page). The Default organization is not stored, so it is never listed.
        /// </summary>
        Task<IReadOnlyList<OrganizationSummary>> GetEnabledPageAsync(string? after, int size, CancellationToken cancellationToken = default);
    }
}
