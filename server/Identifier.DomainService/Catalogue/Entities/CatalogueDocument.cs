using Blocks.Genesis;
using MongoDB.Bson.Serialization.Attributes;

namespace DomainService.Catalogue.Entities;

/// <summary>
/// One published version of the catalogue and its price book, held in the platform database.
/// <para>
/// The JSON files that ship with the build are only a bootstrap: the first start inserts them as
/// version 1, and after that the database is the source. Publishing a new version writes a new
/// document rather than editing the old one, so an invoice raised last month can still be read
/// against the catalogue that produced it.
/// </para>
/// </summary>
[BsonIgnoreExtraElements]
public class CatalogueDocument : BaseEntity
{
    /// <summary>The catalogue's own version string, e.g. <c>2026-09-24.1</c>.</summary>
    public string CatalogueVersion { get; set; } = string.Empty;

    public string PriceBookVersion { get; set; } = string.Empty;

    /// <summary>Exactly one document is active. That is the one every tenant is seeded from.</summary>
    public bool IsActive { get; set; }

    /// <summary>The catalogue, verbatim, so nothing is lost in a round trip through our own model.</summary>
    public string CatalogueJson { get; set; } = string.Empty;

    public string PriceBookJson { get; set; } = string.Empty;

    /// <summary>Anything the validator objected to when this version was published.</summary>
    public List<string> Problems { get; set; } = [];

    public DateTime PublishedAtUtc { get; set; }
    public string PublishedBy { get; set; } = string.Empty;
}
