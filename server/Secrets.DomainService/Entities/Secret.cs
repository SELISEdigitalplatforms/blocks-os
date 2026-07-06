using Blocks.Genesis;
using MongoDB.Bson.Serialization.Attributes;

namespace Secrets.DomainService.Entities
{
    [BsonIgnoreExtraElements]
    public class Secret : BaseEntity
    {
        public string SecretKey { get; set; } = string.Empty;
        public Dictionary<string, string> KeyValuePairs { get; set; }
        public Dictionary<string, object>? KeyPairs { get; set; }
    }
}
