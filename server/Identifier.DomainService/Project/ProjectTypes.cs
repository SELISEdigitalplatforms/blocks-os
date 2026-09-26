namespace DomainService.Projects
{
    /// <summary>
    /// What kind of project a group is, chosen once when the group is created.
    /// </summary>
    /// <remarks>
    /// Stored on the group's <see cref="DomainService.Shared.Entities.TenantAsset"/>, so every
    /// environment in the group, including ones added later, has the same type. A template
    /// project gets Connect set up in each environment without anyone running setup by hand.
    /// For now the console does that the first time an environment is opened; moving it into the
    /// provisioning worker only needs the worker to read this value.
    /// </remarks>
    public static class ProjectTypes
    {
        public const string Regular = "regular";
        public const string Template = "template";

        /// <summary>The stored form of a requested type; blank means <see cref="Regular"/>.</summary>
        public static string Normalize(string? projectType) =>
            string.IsNullOrWhiteSpace(projectType) ? Regular : projectType.Trim().ToLowerInvariant();

        public static bool IsSupported(string? projectType) =>
            Normalize(projectType) is Regular or Template;
    }
}
