using Blocks.Genesis;
using MongoDB.Bson.Serialization.Attributes;
using System.Text.Json.Serialization;

namespace DomainService.Entities
{
    /// <summary>
    /// One registered application on a project, as the console reads it.
    /// <para>
    /// Mirrors <see cref="Applications"/> field for field so it deserializes from the same
    /// Tenants documents, and exists only to put <see cref="DomainType"/> on the wire as a name
    /// rather than the ordinal Mongo stores. The enum lives in the Genesis package and cannot be
    /// attributed there, and the API registers no global converter, so without this the console
    /// would receive a bare 0-3 and have to keep its own copy of the ordering.
    /// </para>
    /// </summary>
    [BsonIgnoreExtraElements]
    public class ApplicationDto
    {
        public string Domain { get; set; }
        public string CookieDomain { get; set; }
        public bool IsDomainVerified { get; set; }

        /// <summary>
        /// How the domain came to be on the project. Absent from documents written before the
        /// field existed, which read back as <see cref="DomainType.Unspecified"/> — treat that as
        /// "not yet classified", never as a type in its own right.
        /// </summary>
        [JsonConverter(typeof(JsonStringEnumConverter))]
        public DomainType DomainType { get; set; }
    }
}
