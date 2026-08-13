
namespace DomainService.Projects
{
    public class UpdateProjectRequest
    {
        public ApplicationAction Action { get; set; }
        public Application Application { get; set; }
        public string? ApplicationDomain { get; set; }

        /// <summary>
        /// Opt in to removing the host's SSL certificate along with its nginx
        /// binding. Off by default: keeping the lineage lets the same host be
        /// re-added without spending one of Let's Encrypt's five weekly
        /// duplicate-certificate slots. Ignored for platform-hosted domains,
        /// whose certificates are not this project's to remove.
        /// </summary>
        public bool DeleteCertificate { get; set; }
    }

    /// <summary>
    /// Operation to perform against a project's registered application entry.
    /// </summary>
    public enum ApplicationAction
    {
        /// <summary>Register a new application with the project.</summary>
        Add = 0,

        /// <summary>Update an existing application registration.</summary>
        Edit = 1,

        /// <summary>Remove an application registration from the project.</summary>
        Delete = 2,
    }

    public class Application
    {
        public string Domain { get; set; }
        public string CookieDomain { get; set; }
        public bool IsDomainVerified { get; set; }
    }
}
