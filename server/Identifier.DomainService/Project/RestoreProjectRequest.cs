
using Blocks.Genesis;

namespace DomainService.Projects
{
    public class RestoreProjectRequest
    {
        public string ItemId { get; set; }
    }

    public class RestoreProjectResponse: BaseResponse
    {
        public string? ItemId { get; set; }
    }
}
