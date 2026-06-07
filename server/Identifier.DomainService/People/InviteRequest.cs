using Blocks.Genesis;

namespace DomainService.People
{
    public class InviteRequest
    {
       public Dictionary<string, List<EnviromentDetails>> Invitations { get; set; } = [];
       public required string GroupId { get; set; }
    }

    public class EnviromentDetails
    {
        public string TenantId { get; set; }
        public List<string> Roles { get; set; } = [];
    }
   

    public class InviteResponse : BaseResponse
    {
        public string? ItemId { get; set; }
    }
}
