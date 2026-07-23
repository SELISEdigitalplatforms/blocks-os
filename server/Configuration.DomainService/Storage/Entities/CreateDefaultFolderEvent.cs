using MongoDB.Bson.Serialization.Attributes;

namespace Configuration.DomainService.Storage.Entities;

[BsonIgnoreExtraElements]
public class CreateDefaultFolderEvent
{
    public required string ItemId { get; set; }
    public required string ConfigurationName { get; set; }
    public required string StorageStrategy { get; set; }

}

