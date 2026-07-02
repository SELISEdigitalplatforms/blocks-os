
namespace DomainService.Projects
{
    public class UpdateProjectRequest
    {
        public ApplicationAction Action { get; set; }
        public Application Application { get; set; }
        public string? ApplicationDomain { get; set; }
    }

    public enum ApplicationAction
    {
        Add,
        Edit,
        Delete
    }

    public class Application
    {
        public string Domain { get; set; }
        public string CookieDomain { get; set; }
        public bool IsDomainVerified { get; set; }
    }
}
