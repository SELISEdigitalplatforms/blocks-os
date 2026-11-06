namespace Configuration.DomainService.Organizations
{
    /// <summary>
    /// Organization ids as mail configurations store them.
    /// </summary>
    /// <remarks>
    /// There is no migration: a document written before organizations existed has no
    /// <c>OrganizationId</c> element, or an empty one, and belongs to the Default organization.
    /// Every read and write goes through <see cref="Normalize"/> so that rule lives in one place.
    /// </remarks>
    public static class OrganizationIds
    {
        /// <summary>The Default organization, whose configurations every organization shares.</summary>
        public const string Default = "default";

        /// <summary>Missing, empty or blank means the Default organization.</summary>
        public static string Normalize(string? organizationId) =>
            string.IsNullOrWhiteSpace(organizationId) ? Default : organizationId;

        /// <summary>The stored values that mean the Default organization (a missing element matches null).</summary>
        public static readonly IReadOnlyList<string?> StoredDefaultValues = new string?[] { null, string.Empty, Default };
    }
}
