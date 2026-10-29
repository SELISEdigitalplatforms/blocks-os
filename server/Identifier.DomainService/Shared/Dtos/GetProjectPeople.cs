using MongoDB.Bson.Serialization.Attributes;

namespace DomainService.Dtos
{
    [BsonIgnoreExtraElements]
    public class GetProjectPeople
    {
        [BsonId]
        public string ItemId { get; set; }  
        public string TenantId { get; set; }
        public bool IsInvitationSent { get; set; }
        public bool IsInvitationConfirmed { get; set; }
        public bool IsCreator { get; set; }
        
        public string Enviroment { get; set; }

        /// <summary>The grants stored on this row. Unioned per person by the service.</summary>
        public List<string> AccessPolicies { get; set; } = [];

        public PeopleDetails peopleDetails { get; set; }
    }

    public record  PeopleDetails
    {
        public string? Salutation { get; set; }
        public string? FirstName { get; set; }
        public string? LastName { get; set; }
        public string? Email { get; set; }
        public string? ProfileImageUrl { get; set; }
        public string UserId { get; set; }
        public bool AllowResendActivation { get; set; }

        /// <summary>
        /// False only when an administrator deactivated the account. A pending invitee who has not
        /// activated yet is still active. Defaults to true so a person whose account was not found
        /// is not shown as deactivated.
        /// </summary>
        public bool IsActive { get; set; } = true;
    }
}
