
namespace DomainService.Projects
{
   public class UpdateProjectRequest
    {
       public string Domain { get; set; } = string.Empty;
       public string CookieDomain { get; set; } = string.Empty;
       public bool IsDomainVerified { get; set; }
    }
}
