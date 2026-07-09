namespace DomainService.People
{
    public class TransferOwnershipRequest
    {
        public string TenantGroupId { get; set; }
        public string TransferToUserEmail { get; set; }
    }
}
