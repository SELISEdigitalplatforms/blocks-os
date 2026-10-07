using MongoDB.Bson.Serialization.Attributes;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace DomainService.Entities
{
    [BsonIgnoreExtraElements]
    public class ProjectStatusTracer
    {
        [BsonId]
        public required string ProjectId { get; init; }
        public DateTime CreatedDate { get; set; } = DateTime.UtcNow;
        public bool IsCertificatesUploaded { get; set; }
        public bool IsProjectUpdated { get; set; }
        public string ErrorMessage { get; set; }
        public bool IsProjectCreationSuccess { get; set; }
        public bool IsDefaultConfigurationCopied { get; set; }
        public bool InsertedIntoProjectPeople { get; set; }

        /// <summary>Every BlocksConfiguration collection and index now exists in the project DB.</summary>
        public bool IsSeedSchemaApplied { get; set; }

        /// <summary>Indexes that could not be built (e.g. seed data breaks a unique index). They never block the project.</summary>
        public List<string> SeedSchemaErrors { get; set; } = [];
    }
}
