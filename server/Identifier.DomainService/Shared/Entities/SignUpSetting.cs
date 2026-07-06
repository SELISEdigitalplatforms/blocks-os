using Blocks.Genesis;
using MongoDB.Bson.Serialization.Attributes;

namespace DomainService.Shared.Entities
{
    [BsonIgnoreExtraElements]
    public class SignUpSetting : BaseEntity
    {
        public bool IsEmailPasswordSignUpEnabled { get; set; }
        public bool IsSSoSignUpEnabled { get; set; }
    }
}
