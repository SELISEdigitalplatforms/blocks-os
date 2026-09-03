using Blocks.Genesis;
using DomainService.Dtos;
using DomainService.Entities;

namespace DomainService.People
{
    public interface IPeopleService
    {
        Task<InviteResponse> InvitePeoplesAsync(InviteRequest requests);
        Task<BaseResponse> RemoveAccessFromProjectAsync(RemoveAccessRequest request);
        Task<GetPeoplesResponse> GetPeoplesAsync(GetPeoplesRequest request);
        Task<bool> SendProjectInvitationToNewUser(CreateUserByEmailPostEvent @event);
        Task<ConfirmInvitationResponse> ConfirmInvitationAsync(ConfirmInvitationRequest request);
        Task<BaseResponse> ResendInvitationAsync(ResendInvitationRequest request);
        Task<BaseResponse> TransferOwnershipAsync(TransferOwnershipRequest request);
    }

    public interface IPeopleRepository
    {
        Task<bool> InsertPeoplesAsync(List<ProjectPeople> projectPeoples);
        Task<bool> RemovePeoplesAsync(string email, List<string> tenantIds);
        Task<(List<GetProjectPeople> peoples, long totalCount, long peoplesTotalCount, bool isOwner)> GetPeoplesAsync(GetPeoplesRequest request);
        Task<List<ProjectPeople>> GetProjectPeoplesAsync(string userId, List<string> tenantIds);
        Task<ProjectPeople> GetProjectPeopleAsync(string id);
        Task<List<User>> GetUsersByEmailAsync(List<string> emails);
        Task<Tenant> GetProjectByIdAsync(string tenantId);
        Task<User> GetUserByIdAsync(string userId);
        Task<bool> UpdateProjectPeoples(List<string> ids);
        Task<bool> IsOwner(string userId, List<string> tenantIds);
        /// <summary>
        /// Replaces <c>AccessPolicies</c> on every one of a member's rows in a group. Called
        /// only from <c>SaveAccessPolicy</c>: grants are group-wide, so a single-row write would
        /// leave that member's rows disagreeing with each other.
        /// </summary>
        Task<bool> UpdateAccessPoliciesAsync(List<string> itemIds, List<string> accessPolicies);
        Task<bool> UpdateProjectPeopleOwnerShipAsync(List<string> ids, bool ownerShipStatus);
        Task<ProjectPeople> GetProjectPeopleByTenantIdAndUserIdAsync(string tenantId, string userId);
        Task<User> GetUserByEmailAsync(string email);
    }
}